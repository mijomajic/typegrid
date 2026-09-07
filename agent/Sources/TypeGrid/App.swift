import AppKit
import ApplicationServices
import Foundation
import GridCore
import Darwin

let root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/TypeGrid", isDirectory: true)
let configURL = root.appendingPathComponent("config.json")
let countersURL = root.appendingPathComponent("counters.json")
struct Config: Codable {
    var server = "https://typegrid.dev"
    var token: String? = nil
    var deviceId: String? = nil
    var classify = true
}
func save<T: Encodable>(_ object: T, to url: URL) throws {
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    let data = try JSONEncoder().encode(object)
    try data.write(to: url, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
}
func loadConfig() -> Config { (try? JSONDecoder().decode(Config.self, from: Data(contentsOf: configURL))) ?? Config() }
func request(_ path: String, config: Config, body: Data, completion: @escaping (Result<Data, Error>) -> Void) {
    guard let base = URL(string: config.server), base.scheme == "https" || (base.scheme == "http" && ["localhost", "127.0.0.1"].contains(base.host ?? "")), let url = URL(string: path, relativeTo: base) else {
        completion(.failure(NSError(domain: "TypeGrid", code: 1, userInfo: [NSLocalizedDescriptionKey: "Use HTTPS, or HTTP on localhost only."]))); return
    }
    var req = URLRequest(url: url); req.httpMethod = "POST"; req.timeoutInterval = 15
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token = config.token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    req.httpBody = body
    URLSession.shared.dataTask(with: req) { data, response, error in
        if let error { completion(.failure(error)); return }
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status), let data else {
            completion(.failure(NSError(domain: "TypeGrid", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: "Sync unavailable. Check your connection or pair again if revoked."]))); return
        }
        completion(.success(data))
    }.resume()
}
func blockingRequest(_ path: String, config: Config, object: [String: String]) throws -> [String: Any] {
    let semaphore = DispatchSemaphore(value: 0)
    var result: Result<Data, Error>?
    request(path, config: config, body: try JSONEncoder().encode(object)) { result = $0; semaphore.signal() }
    semaphore.wait()
    return try JSONSerialization.jsonObject(with: result!.get()) as? [String: Any] ?? [:]
}
func pair() throws {
    var config = loadConfig()
    if let server = ProcessInfo.processInfo.environment["TYPEGRID_SERVER"] { config.server = server }
    let start = try blockingRequest("/api/devices/start", config: config, object: [:])
    guard let secret = start["secret"] as? String, let code = start["code"] as? String, let url = start["verificationUrl"] as? String else { throw NSError(domain: "TypeGrid", code: 1) }
    print("Connect this Mac to the Grid.\nOpen \(url) and enter: \(code)\nThis code expires in 10 minutes. Only approve the code from this terminal.")
    if let page = URL(string: url) { NSWorkspace.shared.open(page) }
    for _ in 0..<120 {
        Thread.sleep(forTimeInterval: 5)
        let result = try blockingRequest("/api/devices/poll", config: config, object: ["secret": secret])
        if let token = result["token"] as? String, let id = result["deviceId"] as? String {
            // Counters belong to a pairing. Never reattribute old activity to a different account.
            config.token = token; config.deviceId = id
            try save(config, to: configURL); try save([String: Bucket](), to: countersURL)
            print("Connected. Run typegrid start to enable background tracking."); return
        }
    }
    print("Pairing expired. Run typegrid pair to try again.")
}

final class Agent: NSObject, NSApplicationDelegate {
    var counter = Counter()
    var tap: CFMachPort?
    var status: NSStatusItem!
    var timer: Timer?
    var paused = false
    var inFlight = false
    var statusText = "Waiting for activity"
    var isDev = false
    var config = loadConfig()
    var codingAcknowledged: [String: Data] = [:]
    var codingInFlight = false
    var acknowledged: [String: Bucket] = [:]
    var lastDevice: String?
    let devApps: Set<String> = ["com.microsoft.VSCode", "com.todesktop.230313mzl4w4u92", "com.apple.dt.Xcode", "com.apple.Terminal", "com.googlecode.iterm2", "dev.warp.Warp-Stable", "com.sublimetext.4", "com.jetbrains.intellij", "com.jetbrains.pycharm", "com.jetbrains.WebStorm", "com.openai.codex", "com.mitchellh.ghostty"]
    func applicationDidFinishLaunching(_ notification: Notification) {
        lastDevice = config.deviceId
        if let data = try? Data(contentsOf: countersURL), let buckets = try? JSONDecoder().decode([String: Bucket].self, from: data) { counter = Counter(buckets: buckets) }
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let icon = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { rect in
            NSColor.labelColor.setFill()
            for row in 0..<5 { for col in 0..<5 {
                if row == 0 || col == 2 {
                    NSBezierPath(ovalIn: NSRect(x: 1 + CGFloat(col) * 3.3, y: 14.2 - CGFloat(row) * 3.3, width: 2.6, height: 2.6)).fill()
                }
            }}
            return true
        }
        icon.isTemplate = true
        status.button?.image = icon
        status.button?.setAccessibilityLabel("TypeGrid")
        let menu = NSMenu()
        menu.addItem(withTitle: "TypeGrid · starting", action: nil, keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Open dashboard", action: #selector(dashboard), keyEquivalent: "")
        menu.addItem(withTitle: "Pause / resume", action: #selector(toggle), keyEquivalent: "")
        menu.addItem(withTitle: "Quit TypeGrid", action: #selector(quit), keyEquivalent: "")
        for item in menu.items { item.target = self }; status.menu = menu
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(appChanged), name: NSWorkspace.didActivateApplicationNotification, object: nil)
        appChanged()
        installTap()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.tick() }
    }
    func installTap() {
        if !CGPreflightListenEventAccess() {
            statusText = "Allow Input Monitoring, then restart TypeGrid"
            CGRequestListenEventAccess()
            status.button?.toolTip = statusText
            return
        }
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly, eventsOfInterest: CGEventMask(1 << CGEventType.keyDown.rawValue), callback: { _, type, _, info in
            // Deliberately unnamed event argument: no key code, text, flags or timestamp is read.
            guard let info else { return nil }
            let agent = Unmanaged<Agent>.fromOpaque(info).takeUnretainedValue()
            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput { if let tap = agent.tap { CGEvent.tapEnable(tap: tap, enable: true) }; return nil }
            if type == .keyDown && !agent.paused { agent.counter.record(isDev: agent.isDev) }
            // Listen-only event taps cannot alter or suppress the input event.
            return nil
        }, userInfo: Unmanaged.passUnretained(self).toOpaque())
        guard let tap else { statusText = "Input Monitoring unavailable. Restart after allowing access."; return }
        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }
    @objc func appChanged() { isDev = config.classify && devApps.contains(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "") }
    @objc func dashboard() { if let url = URL(string: config.server + "/dashboard") { NSWorkspace.shared.open(url) } }
    @objc func toggle() { paused.toggle(); tick() }
    @objc func quit() { try? save(counter.buckets, to: countersURL); NSApplication.shared.terminate(nil) }
    func tick() {
        config = loadConfig()
        if config.deviceId != lastDevice { counter = Counter(); acknowledged = [:]; lastDevice = config.deviceId }
        appChanged(); counter.prune()
        if !codingInFlight, let files = try? FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil) {
            for file in files where file.lastPathComponent.hasPrefix("coding-") && file.pathExtension == "json" {
                guard let streamId = UUID(uuidString:String(file.deletingPathExtension().lastPathComponent.dropFirst(7))), let data = try? Data(contentsOf:file), codingAcknowledged[file.lastPathComponent] != data, let codingQueue = try? JSONDecoder().decode(CodingQueue.self,from:data), codingQueue.deviceId == config.deviceId else { continue }
                let buckets = codingQueue.buckets
                struct CodingUpload: Encodable { let streamId:String; let buckets:[CodingBucket] }
                let recent = buckets.filter { (ISO8601DateFormatter().date(from:$0.hour) ?? .distantPast) > Date().addingTimeInterval(-30*86400) }
                if recent.isEmpty { try? FileManager.default.removeItem(at:file); continue }
                codingInFlight=true
                let snapshotConfig = config
                DispatchQueue.global(qos:.utility).async { [weak self] in
                    var succeeded = true
                    for offset in stride(from:0,to:recent.count,by:48) {
                        guard let payload = try? JSONEncoder().encode(CodingUpload(streamId:streamId.uuidString,buckets:Array(recent[offset..<min(offset+48,recent.count)]))) else { succeeded=false;break }
                        let done=DispatchSemaphore(value:0)
                        var ok=false
                        request("/api/coding/ingest",config:snapshotConfig,body:payload) { result in
                            if case .success = result { ok=true }; done.signal()
                        }
                        done.wait(); if !ok { succeeded=false;break }
                    }
                    let completed = succeeded
                    DispatchQueue.main.async {
                        self?.codingInFlight=false
                        if completed { self?.codingAcknowledged[file.lastPathComponent]=data }
                    }
                }
                break
            }
        }
        do { try save(counter.buckets, to: countersURL) } catch { statusText = "Cannot save counters. Check disk space." }
        let today = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let total = counter.buckets.values.filter { $0.hour.hasPrefix(today) }.reduce(0) { $0 + $1.keystrokes }
        status.menu?.items.first?.title = paused ? "Tracking paused" : tap == nil ? "Allow Input Monitoring" : "\(total.formatted()) keystrokes today"
        status.menu?.items.first(where: { $0.action == #selector(toggle) })?.title = paused ? "Resume tracking" : "Pause tracking"
        status.button?.appearsDisabled = paused || tap == nil
        status.button?.toolTip = "TypeGrid — \(statusText). We count. We don’t read."
        guard config.token != nil, !inFlight else { return }
        let pending = counter.buckets.values.filter { acknowledged[$0.hour] != $0 }.sorted { $0.hour < $1.hour }.prefix(48)
        let batch = Array(pending)
        guard let data = try? JSONEncoder().encode(["buckets": batch]) else { return }
        inFlight = true
        let sendingDevice = config.deviceId
        request("/api/ingest", config: config, body: data) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }; self.inFlight = false
                switch result {
                case .success:
                    if self.config.deviceId == sendingDevice { for b in batch { self.acknowledged[b.hour] = b } }
                    self.statusText = "Connected to the Grid"
                case .failure: self.statusText = "Offline — aggregates queued locally"
                }
            }
        }
    }
}
func launch(_ args: [String]) -> Int32 {
    let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/launchctl"); p.arguments = args
    do { try p.run(); p.waitUntilExit(); return p.terminationStatus } catch { return 1 }
}
func start() throws {
    let binary = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL.resolvingSymlinksInPath().path
    let plistURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/dev.typegrid.agent.plist")
    try FileManager.default.createDirectory(at: plistURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    let plist: [String: Any] = ["Label": "dev.typegrid.agent", "ProgramArguments": [binary, "run"], "RunAtLoad": true, "KeepAlive": false, "ProcessType": "Interactive"]
    let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
    try data.write(to: plistURL, options: .atomic)
    _ = launch(["bootout", "gui/\(getuid())/dev.typegrid.agent"])
    guard launch(["bootstrap", "gui/\(getuid())", plistURL.path]) == 0 else { print("Could not start. Run typegrid run to diagnose."); return }
    print("TypeGrid started. It will launch at sign-in. Allow Input Monitoring in macOS System Settings, then run typegrid restart.")
}
@main struct Main {
    static func main() {
        let command = CommandLine.arguments.dropFirst().first ?? (Bundle.main.bundleIdentifier == "dev.typegrid.agent" ? "run" : "help")
        do {
            switch command {
            case "is-paired": exit(loadConfig().token == nil ? 1 : 0)
            case "pair": try pair()
            case "track":
                guard CommandLine.arguments.count >= 3 else { throw NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:"Use typegrid track claude or typegrid track codex."]) }
                try trackCoding(CommandLine.arguments[2],arguments:Array(CommandLine.arguments.dropFirst(3)))
            case "run":
                try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                let lock = open(root.appendingPathComponent("agent.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
                guard lock >= 0, flock(lock, LOCK_EX | LOCK_NB) == 0 else { print("TypeGrid is already running."); return }
                defer { close(lock) }
                let app = NSApplication.shared; app.setActivationPolicy(.accessory); let agent = Agent(); app.delegate = agent; withExtendedLifetime(agent) { app.run() }
            case "start", "restart": try start()
            case "stop": _ = launch(["bootout", "gui/\(getuid())/dev.typegrid.agent"]); print("TypeGrid stopped. Run typegrid start to resume.")
            case "classify": var c = loadConfig(); c.classify = CommandLine.arguments.last != "off"; try save(c, to: configURL); print("App classification \(c.classify ? "on" : "off").")
            case "status": let c = loadConfig(); print("TypeGrid 0.1.3\nServer: \(c.server)\nPaired: \(c.token != nil)\nInput Monitoring: \(CGPreflightListenEventAccess())\nApp classification: \(c.classify)")
            default: print("TypeGrid 0.1.3 — We count. We don’t read.\n\ntypegrid pair       Connect this Mac\ntypegrid start      Start at login and now\ntypegrid stop       Stop tracking\ntypegrid restart    Restart after granting access\ntypegrid status     Check permissions and pairing\ntypegrid classify off  Disable dev-app classification\n\nDocs: https://typegrid.dev/connect")
            }
        } catch { fputs("TypeGrid: \(error.localizedDescription)\n", stderr); exit(1) }
    }
}
