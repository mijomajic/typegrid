import AppKit
import CryptoKit
import GridCore

let typegridVersion = "0.2.2"

final class AutomaticUpdates {
    private(set) var statusText = "Updates enabled"
    private var busy = false
    private var timer: Timer?
    private var ready: (app: URL, directory: URL)?
    var didChange: (() -> Void)?
    var canRestart: () -> Bool = { false }
    var prepareToRestart: () throws -> Void = {}
    var enabled: Bool {
        get { UserDefaults.standard.object(forKey: "automaticUpdates") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "automaticUpdates"); statusText = newValue ? "Updates enabled" : "Automatic updates off"; didChange?(); if newValue { check() } }
    }
    func start() {
        if let cached = UserDefaults.standard.dictionary(forKey: "pendingSourceUpdate") as? [String: String],
           let name = cached["app"], name.hasPrefix(".TypeGrid-update-"), name.hasSuffix(".app"), !name.contains("/"),
           let identifier = cached["directory"], UUID(uuidString: identifier) != nil,
           let version = cached["version"], let candidate = ReleaseVersion(version), candidate > ReleaseVersion(typegridVersion)! {
            let app = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent(name)
            let directory = root.appendingPathComponent("Updates/" + identifier)
            if FileManager.default.fileExists(atPath: app.path), FileManager.default.fileExists(atPath: directory.path) { ready = (app, directory) }
        }
        statusText = enabled ? "Updates enabled" : "Automatic updates off"
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { [weak self] _ in self?.check() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in self?.check() }
    }
    func check(manual: Bool = false) {
        guard !busy, manual || enabled else { return }
        if ready != nil { installIfReady(manual: manual); return }
        if !manual, let date = UserDefaults.standard.object(forKey: "lastUpdateCheck") as? Date, Date().timeIntervalSince(date) < 6 * 3600 { return }
        UserDefaults.standard.set(Date(), forKey: "lastUpdateCheck")
        busy = true; statusText = "Checking for updates…"; didChange?()
        Task { @MainActor in
            do {
                guard let release = try await UpdateInstaller.latest(after: typegridVersion) else {
                    busy = false; statusText = "TypeGrid is up to date"; didChange?()
                    if manual { message("You’re up to date", "TypeGrid \(typegridVersion) is the latest stable version.") }
                    return
                }
                if manual && !enabled {
                    let alert = NSAlert(); alert.messageText = "TypeGrid \(release) is available"
                    alert.informativeText = "Download, verify, and install this update? TypeGrid will restart when it is ready. Your saved counts and pairing are preserved."
                    alert.addButton(withTitle: "Install update"); alert.addButton(withTitle: "Later")
                    if alert.runModal() != .alertFirstButtonReturn { busy = false; statusText = "Update available"; didChange?(); return }
                }
                statusText = "Preparing TypeGrid \(release)…"; didChange?()
                ready = try await UpdateInstaller.prepare(version: release)
                if let ready { UserDefaults.standard.set(["app": ready.app.lastPathComponent, "directory": ready.directory.lastPathComponent, "version": release], forKey: "pendingSourceUpdate") }
                busy = false; statusText = "Update ready — restarting when setup finishes"; didChange?()
                installIfReady(manual: manual)
            } catch {
                busy = false; statusText = "Update unavailable — try again"; didChange?()
                if manual { message("Couldn’t update TypeGrid", error.localizedDescription) }
            }
        }
    }
    func installIfReady(manual: Bool = false) {
        guard let ready, !busy, manual || (enabled && canRestart()) else { return }
        if manual {
            let alert = NSAlert(); alert.messageText = "Restart to finish updating?"
            alert.informativeText = "Your counts are saved before TypeGrid restarts."
            alert.addButton(withTitle: "Restart now"); alert.addButton(withTitle: "Later")
            guard alert.runModal() == .alertFirstButtonReturn else { return }
        }
        do {
            try UpdateInstaller.validateReady(ready.app)
            try prepareToRestart()
            try UpdateInstaller.apply(staged: ready.app, directory: ready.directory)
            UserDefaults.standard.removeObject(forKey: "pendingSourceUpdate")
            NSApp.terminate(nil)
        } catch {
            self.ready = nil
            UserDefaults.standard.removeObject(forKey: "pendingSourceUpdate")
            statusText = "Update needs attention — check again"; didChange?()
            if manual { message("Couldn’t finish updating", error.localizedDescription) }
        }
    }
    private func message(_ title: String, _ detail: String) {
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = detail; alert.runModal()
    }
}

private enum UpdateInstaller {
    static let repo = "https://github.com/mijomajic/typegrid/releases/download/"
    static func failure(_ message: String) -> NSError { NSError(domain: "TypeGridUpdate", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    static func download(_ url: URL, limit: Int) async throws -> Data {
        var request = URLRequest(url: url)
        request.timeoutInterval = 90
        request.setValue("TypeGrid/" + typegridVersion, forHTTPHeaderField: "User-Agent")
        let session = URLSession(configuration: .ephemeral, delegate: UpdateRedirectPolicy(limit: limit), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let (temporary, response) = try await session.download(for: request)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              let bytes = try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize, bytes <= limit else { throw failure("The release download was unavailable or larger than expected. Try again later.") }
        return try Data(contentsOf: temporary)
    }
    static func latest(after installed: String) async throws -> String? {
        struct Release: Decodable { let tag_name: String; let draft: Bool; let prerelease: Bool }
        let data = try await download(URL(string: "https://api.github.com/repos/mijomajic/typegrid/releases/latest")!, limit: 1_000_000)
        let release = try JSONDecoder().decode(Release.self, from: data)
        guard !release.draft, !release.prerelease, release.tag_name.hasPrefix("v"), let newest = ReleaseVersion(release.tag_name), let current = ReleaseVersion(installed) else { throw failure("The release version could not be verified.") }
        return newest > current ? newest.description : nil
    }
    static func prepare(version: String) async throws -> (app: URL, directory: URL) {
        let current = Bundle.main.bundleURL
        guard current.pathExtension == "app", Bundle.main.bundleIdentifier == "dev.typegrid.agent",
              FileManager.default.isWritableFile(atPath: current.deletingLastPathComponent().path) else { throw failure("Install TypeGrid.app in Applications or your personal Applications folder to enable automatic updates.") }
        let directory = root.appendingPathComponent("Updates/" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let staged = current.deletingLastPathComponent().appendingPathComponent(".TypeGrid-update-" + UUID().uuidString + ".app")
        do {
            let base = URL(string: repo + "v" + version + "/")!
            let asset = "typegrid-source.tar.gz"
            let manifest = try await download(base.appendingPathComponent("SHA256SUMS"), limit: 16_384)
            guard let text = String(data: manifest, encoding: .utf8), let checksum = ReleaseValidation.sourceChecksum(text, asset: asset) else { throw failure("The update checksum is missing or invalid.") }
            let source = try await download(base.appendingPathComponent(asset), limit: 50_000_000)
            let actual = SHA256.hash(data: source).map { String(format: "%02x", $0) }.joined()
            guard checksum == actual else { throw failure("The update failed checksum verification. Your current app is unchanged.") }
            let archive = directory.appendingPathComponent("source.tar.gz")
            try source.write(to: archive, options: .atomic)
            try await Task.detached(priority: .utility) {
                let listing = try run("/usr/bin/tar", ["-tzf", archive.path], capture: true)
                guard let entries = String(data: listing, encoding: .utf8), !entries.isEmpty,
                      entries.split(whereSeparator: \.isNewline).allSatisfy({ ReleaseValidation.safeArchiveEntry(String($0), root: "typegrid") }) else { throw failure("The update archive has invalid entries.") }
                // Only directories and regular files are permitted; no symlinks or hardlinks.
                let details = try run("/usr/bin/tar", ["-tvzf", archive.path], capture: true)
                guard let lines = String(data: details, encoding: .utf8), lines.split(whereSeparator: \.isNewline).allSatisfy({ $0.first == "-" || $0.first == "d" }) else { throw failure("The update archive contains unsupported file types.") }
                _ = try run("/usr/bin/tar", ["-xzf", archive.path, "-C", directory.path])
                do { _ = try run("/usr/bin/xcrun", ["--find", "swift"]) }
                catch { throw failure("Apple Command Line Tools are needed to build this update. Install them, then choose Check for Updates again.") }
                let unpacked = directory.appendingPathComponent("TypeGrid.app")
                let installer = directory.appendingPathComponent("typegrid/agent/scripts/install-app.sh")
                _ = try run("/bin/sh", [installer.path], environment: ["TYPEGRID_STAGE_APP": unpacked.path])
                guard let bundle = Bundle(url: unpacked), bundle.bundleIdentifier == "dev.typegrid.agent",
                      bundle.infoDictionary?["CFBundleShortVersionString"] as? String == version else { throw failure("The prepared app does not match the expected release.") }
                _ = try run("/usr/bin/codesign", ["--verify", "--deep", "--strict", unpacked.path])
                let reportedVersion = try run(unpacked.appendingPathComponent("Contents/MacOS/TypeGrid").path, ["version"], capture: true)
                guard String(data: reportedVersion, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) == version else { throw failure("This update cannot run on this Mac.") }
                try FileManager.default.moveItem(at: unpacked, to: staged)
            }.value
            return (staged, directory)
        } catch {
            try? FileManager.default.removeItem(at: staged)
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
    }
    @discardableResult static func run(_ executable: String, _ arguments: [String], capture: Bool = false, environment: [String: String] = [:]) throws -> Data {
        let process = Process(); process.executableURL = URL(fileURLWithPath: executable); process.arguments = arguments
        var inherited = ProcessInfo.processInfo.environment
        for (key, value) in environment { inherited[key] = value }
        process.environment = inherited
        let output = Pipe()
        process.standardOutput = capture ? output.fileHandleForWriting : FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        let data = capture ? output.fileHandleForReading.readDataToEndOfFile() : Data()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw failure("The update couldn’t be prepared. Check your connection and free disk space, then try again.") }
        return data
    }
    static func validateReady(_ app: URL) throws {
        guard Bundle.main.bundleURL.pathExtension == "app", let bundle = Bundle(url: app), bundle.bundleIdentifier == "dev.typegrid.agent",
              let text = bundle.infoDictionary?["CFBundleShortVersionString"] as? String,
              let version = ReleaseVersion(text), version > ReleaseVersion(typegridVersion)! else { throw failure("The staged update is no longer valid. Check for updates again.") }
        _ = try run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app.path])
    }
    static func apply(staged: URL, directory: URL) throws {
        let current = Bundle.main.bundleURL
        let script = directory.appendingPathComponent("apply.sh")
        guard let bundledHelper = Bundle.main.url(forResource: "apply-update", withExtension: "sh") else { throw failure("The update helper is missing. Reinstall TypeGrid to repair it.") }
        try Data(contentsOf: bundledHelper).write(to: script, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
        let process = Process(); process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = [script.path, String(ProcessInfo.processInfo.processIdentifier), current.path, staged.path, directory.path]
        process.standardOutput = FileHandle.nullDevice; process.standardError = FileHandle.nullDevice
        try process.run()
    }

}
private final class UpdateRedirectPolicy: NSObject, URLSessionTaskDelegate, URLSessionDownloadDelegate {
    let limit: Int64
    init(limit: Int) { self.limit = Int64(limit) }
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {}
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        if totalBytesWritten > limit || totalBytesExpectedToWrite > limit { downloadTask.cancel() }
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        let allowed = ["github.com", "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]
        completionHandler(request.url?.scheme == "https" && allowed.contains(request.url?.host ?? "") ? request : nil)
    }
}
