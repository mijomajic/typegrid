import AppKit
import Foundation
import GridCore

let typegridVersion = ReleaseVersion.current.description

func fetchUpdate(completion: @escaping (Result<UpdateRelease, Error>) -> Void) {
    // Public release metadata only. No pairing token, cookies, or activity data.
    let session = URLSession(configuration: .ephemeral)
    var request = URLRequest(url: URL(string: "https://api.github.com/repos/mijomajic/typegrid/releases/latest")!)
    request.timeoutInterval = 20
    request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
    request.setValue("TypeGrid/\(ReleaseVersion.current)", forHTTPHeaderField: "User-Agent")
    session.dataTask(with: request) { data, response, error in
        defer { session.finishTasksAndInvalidate() }
        do {
            if let error { throw error }
            guard (response as? HTTPURLResponse)?.statusCode == 200, let data, data.count <= 1_000_000 else {
                throw codingSetupError("Could not check releases. Please try again later.")
            }
            let release = try JSONDecoder().decode(UpdateRelease.self, from: data)
            guard release.version != nil, release.kind != nil else {
                throw codingSetupError("The latest release is not ready to install yet. Please try again later.")
            }
            completion(.success(release))
        } catch { completion(.failure(error)) }
    }.resume()
}

func installedAppURL() throws -> URL {
    let binary = (Bundle.main.executableURL ?? URL(fileURLWithPath: CommandLine.arguments[0])).standardizedFileURL.resolvingSymlinksInPath()
    let app = binary.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    guard app.lastPathComponent == "TypeGrid.app", binary.lastPathComponent == "TypeGrid",
          FileManager.default.fileExists(atPath: app.appendingPathComponent("Contents/Resources/update.sh").path) else {
        throw codingSetupError("Install TypeGrid.app first, then use ~/.local/bin/typegrid update.")
    }
    return app
}

func runUpdate(_ release: UpdateRelease, detached: Bool) throws {
    guard let version = release.version, version > ReleaseVersion.current, let kind = release.kind else { return }
    let app = try installedAppURL()
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard !updateIsRunning() else { throw codingSetupError("An update is already running.") }
    try? FileManager.default.removeItem(at: root.appendingPathComponent("update-result"))
    // This copy survives replacement of the bundle and shutdown of its launch job.
    let script = root.appendingPathComponent("update-worker-\(UUID().uuidString).sh")
    try FileManager.default.copyItem(at: app.appendingPathComponent("Contents/Resources/update.sh"), to: script)
    let arguments = [script.path, version.description, kind, app.path]
    if detached {
        let job = "dev.typegrid.update.\(UUID().uuidString)"
        let log = root.appendingPathComponent("update.log")
        try Data().write(to: log, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: log.path)
        guard launch(["submit", "-l", job, "-o", log.path, "-e", log.path, "--", "/bin/sh"] + arguments + [job, "restart", root.path]) == 0 else {
            try? FileManager.default.removeItem(at: script)
            throw codingSetupError("Could not start the updater. Try typegrid update in Terminal.")
        }
    } else {
        defer { try? FileManager.default.removeItem(at: script) }
        let process = Process(); process.executableURL = URL(fileURLWithPath: "/bin/sh"); process.arguments = arguments
        try process.run(); process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw codingSetupError("Update failed. The previous app is retained; see the error above.") }
    }
}

func updateIsRunning() -> Bool {
    guard let contents = try? String(contentsOf: root.appendingPathComponent("update.lock"), encoding: .utf8),
          let pid = Int32(contents.trimmingCharacters(in: .whitespacesAndNewlines)), pid > 0 else { return false }
    return kill(pid, 0) == 0 || errno == EPERM
}

func updateFromTerminal(checkOnly: Bool) throws {
    let done = DispatchSemaphore(value: 0)
    var result: Result<UpdateRelease, Error>?
    fetchUpdate { result = $0; done.signal() }
    done.wait()
    let release = try result!.get()
    guard let version = release.version, version > ReleaseVersion.current else {
        print("TypeGrid \(ReleaseVersion.current) is up to date."); return
    }
    print("TypeGrid \(version) is available (installed: \(ReleaseVersion.current)).")
    if checkOnly { print("Run typegrid update to install and relaunch."); return }
    if release.kind == "source" {
        print("This release builds locally. macOS may ask you to approve Input Monitoring again. Pairing and settings are preserved.")
    }
    try runUpdate(release, detached: false)
}

final class UpdateController: NSObject {
    var canInstall: () -> Bool = { true }
    private let defaults = UserDefaults.standard
    private var timer: Timer?
    private var checking = false
    private var installing = false
    private var updateFailed = false
    private let checkItem = NSMenuItem(title: "Check for updates…", action: #selector(checkManually), keyEquivalent: "")
    private let checksItem = NSMenuItem(title: "Automatically check for updates", action: #selector(toggleChecks), keyEquivalent: "")
    private let installsItem = NSMenuItem(title: "Install signed updates automatically", action: #selector(toggleInstalls), keyEquivalent: "")

    func addMenuItems(to menu: NSMenu) {
        let previous = defaults.object(forKey: "automaticUpdates") as? Bool
        defaults.register(defaults: ["checkForUpdates": previous ?? true, "installUpdates": previous ?? false])
        menu.addItem(withTitle: "TypeGrid \(ReleaseVersion.current)", action: nil, keyEquivalent: "")
        for item in [checkItem, checksItem, installsItem] { item.target = self; menu.addItem(item) }
        refreshPreferences()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.tick() }
    }

    private func refreshPreferences() {
        checksItem.state = defaults.bool(forKey: "checkForUpdates") ? .on : .off
        installsItem.state = defaults.bool(forKey: "installUpdates") ? .on : .off
    }

    @objc func toggleChecks() {
        let enabled = !defaults.bool(forKey: "checkForUpdates")
        defaults.set(enabled, forKey: "checkForUpdates")
        if !enabled { defaults.set(false, forKey: "installUpdates") }
        refreshPreferences()
    }

    @objc private func toggleInstalls() {
        let enabled = !defaults.bool(forKey: "installUpdates")
        defaults.set(enabled, forKey: "installUpdates")
        if enabled { defaults.set(true, forKey: "checkForUpdates") }
        refreshPreferences()
    }

    private func tick() {
        let result = (try? String(contentsOf: root.appendingPathComponent("update-result"), encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
        if result == "failed" {
            installing = false
            updateFailed = true
            checkItem.title = "Update failed — try again…"
            try? FileManager.default.removeItem(at: root.appendingPathComponent("update-result"))
            // Leave errors visible; don't start an automatic retry on this tick.
            defaults.set(Date().timeIntervalSince1970, forKey: "lastUpdateCheck")
            return
        }
        if result == "installing" {
            installing = updateIsRunning()
            checkItem.title = installing ? "Installing update…" : "Update interrupted — try again…"
            if !installing { updateFailed = true; try? FileManager.default.removeItem(at: root.appendingPathComponent("update-result")) }
            return
        }
        if result == "updated" { installing = false; try? FileManager.default.removeItem(at: root.appendingPathComponent("update-result")) }
        guard !checking, !installing, defaults.bool(forKey: "checkForUpdates"),
              Date().timeIntervalSince1970 - defaults.double(forKey: "lastUpdateCheck") >= 86400 else { return }
        check(manual: false)
    }

    @objc func checkManually() {
        guard !checking else { return }
        if updateFailed {
            let alert = NSAlert(); alert.messageText = "The last update did not finish"
            alert.informativeText = "You can retry the update or view the updater’s download and build log. Terminal updates also show errors directly in Terminal."
            alert.addButton(withTitle: "Try again"); alert.addButton(withTitle: "View update log"); alert.addButton(withTitle: "Later")
            let response = alert.runModal()
            if response == .alertSecondButtonReturn { NSWorkspace.shared.open(root.appendingPathComponent("update.log")); return }
            guard response == .alertFirstButtonReturn else { return }
            updateFailed = false
        }
        if installing {
            let alert = NSAlert(); alert.messageText = "TypeGrid is updating"
            alert.informativeText = "You can keep working. TypeGrid will restart when the update is ready."
            alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "View update log")
            if alert.runModal() == .alertSecondButtonReturn { NSWorkspace.shared.open(root.appendingPathComponent("update.log")) }
            return
        }
        check(manual: true)
    }

    private func check(manual: Bool) {
        checking = true; checkItem.title = "Checking for updates…"
        defaults.set(Date().timeIntervalSince1970, forKey: "lastUpdateCheck")
        fetchUpdate { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.checking = false
                self.checkItem.title = "Check for updates…"
                do {
                    let release = try result.get()
                    guard let version = release.version, version > ReleaseVersion.current else {
                        if manual { self.showMessage("You’re up to date", "TypeGrid \(ReleaseVersion.current) is the latest version.") }
                        return
                    }
                    self.checkItem.title = "Update to TypeGrid \(version)…"
                    if !manual {
                        if release.kind == "signed", self.defaults.bool(forKey: "checkForUpdates"), self.defaults.bool(forKey: "installUpdates") {
                            try self.install(release)
                        }
                        return
                    }
                    let alert = NSAlert(); alert.messageText = "TypeGrid \(version) is available"
                    alert.informativeText = "The update will preserve your pairing, counts, and settings, then restart TypeGrid."
                    if release.kind == "source" {
                        alert.informativeText += " This release builds locally. macOS may require Input Monitoring approval again."
                    }
                    alert.addButton(withTitle: "Update and restart"); alert.addButton(withTitle: "Later")
                    if alert.runModal() == .alertFirstButtonReturn { try self.install(release) }
                } catch {
                    self.checkItem.title = "Update unavailable — try again…"
                    if manual { self.showMessage("Update needs attention", error.localizedDescription) }
                }
            }
        }
    }

    private func install(_ release: UpdateRelease) throws {
        guard canInstall() else { throw codingSetupError("Finish connecting this Mac before updating TypeGrid.") }
        try runUpdate(release, detached: true)
        installing = true; checkItem.title = "Installing update…"
    }

    private func showMessage(_ title: String, _ detail: String) {
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = detail; alert.runModal()
    }
}
