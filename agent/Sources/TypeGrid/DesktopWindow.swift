import AppKit
import AuthenticationServices
import CryptoKit
import WebKit

/// App-owned navigation only; this never reads other windows, tabs, or browsing activity.
final class DesktopWindow: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, ASWebAuthenticationPresentationContextProviding, WKDownloadDelegate, NSToolbarDelegate {
    private let base: URL
    private let webView: WKWebView
    private var authentication: ASWebAuthenticationSession?
    private var signInRequest: String?
    private let errorPanel = NSStackView()
    private let errorLabel = NSTextField(wrappingLabelWithString: "")
    var didClose: (() -> Void)?

    init(server: String) {
        let configured = URL(string: server)
        base = configured.flatMap { url in
            url.scheme == "https" || (url.scheme == "http" && ["localhost", "127.0.0.1"].contains(url.host ?? "")) ? url : nil
        } ?? URL(string: "https://typegrid.dev")!
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "TypeGridDesktop"
        webView = WKWebView(frame: .zero, configuration: configuration)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 760), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "TypeGrid"
        window.minSize = NSSize(width: 720, height: 500)
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("TypeGridWorkspace")
        window.center()
        super.init(window: window)
        window.delegate = self
        let toolbar = NSToolbar(identifier: "TypeGridNavigation")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        window.toolbar = toolbar
        window.toolbarStyle = .unifiedCompact
        webView.navigationDelegate = self
        webView.uiDelegate = self
        let content = NSView()
        webView.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(webView)
        NSLayoutConstraint.activate([webView.leadingAnchor.constraint(equalTo: content.leadingAnchor), webView.trailingAnchor.constraint(equalTo: content.trailingAnchor), webView.topAnchor.constraint(equalTo: content.topAnchor), webView.bottomAnchor.constraint(equalTo: content.bottomAnchor)])
        window.contentView = content
        errorPanel.orientation = .vertical
        errorPanel.alignment = .centerX
        errorPanel.spacing = 18
        errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.addArrangedSubview(errorLabel)
        errorPanel.addArrangedSubview(NSButton(title: "Try again", target: self, action: #selector(retry)))
        content.addSubview(errorPanel)
        NSLayoutConstraint.activate([
            errorPanel.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            errorPanel.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            errorPanel.widthAnchor.constraint(lessThanOrEqualToConstant: 420)
        ])
        errorPanel.isHidden = true
        navigate("/app/dashboard")
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func show(path: String? = nil) {
        if let path { navigate(path) }
        NSApp.setActivationPolicy(.regular)
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    func navigate(_ path: String) {
        guard let url = URL(string: path, relativeTo: base)?.absoluteURL, sameOrigin(url) else { return }
        errorPanel.isHidden = true
        webView.isHidden = false
        webView.load(URLRequest(url: url))
    }
    @objc private func retry() { navigate("/app/dashboard") }
    func windowWillClose(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        didClose?()
    }
    private func sameOrigin(_ url: URL) -> Bool {
        url.scheme == base.scheme && url.host == base.host && url.port == base.port
    }
    private func failed(_ message: String) {
        webView.isHidden = true
        errorLabel.stringValue = message
        errorPanel.isHidden = false
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { errorPanel.isHidden = true; webView.isHidden = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed("Your workspace couldn’t load. Check your connection. The menu-bar agent keeps counting and saves totals locally.") }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed("Your workspace couldn’t load. Try again when you’re online.") }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if sameOrigin(url) {
            if url.path == "/api/auth/github" {
                decisionHandler(.cancel)
                signIn()
            } else { decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow) }
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated && ["https", "http", "typegrid"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.navigationType == .linkActivated {
            if sameOrigin(url), url.path.hasPrefix("/app/") || url.path.hasPrefix("/u/") { webView.load(navigationAction.request) }
            else if ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let response = navigationResponse.response as? HTTPURLResponse,
           response.value(forHTTPHeaderField: "Content-Disposition")?.hasPrefix("attachment") == true { decisionHandler(.download) }
        else { decisionHandler(.allow) }
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "typegrid-export.json"
        panel.begin { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { [.init("back"), .init("reload"), .flexibleSpace] }
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] { [.init("back"), .init("reload"), .flexibleSpace] }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        let item = NSToolbarItem(itemIdentifier: id)
        item.label = id.rawValue == "back" ? "Back" : "Reload"
        item.toolTip = item.label
        item.image = NSImage(systemSymbolName: id.rawValue == "back" ? "chevron.left" : "arrow.clockwise", accessibilityDescription: item.label)
        item.target = self
        item.action = id.rawValue == "back" ? #selector(goBack) : #selector(reload)
        return item
    }
    @objc private func goBack() { if webView.canGoBack { errorPanel.isHidden = true; webView.isHidden = false; webView.goBack() } }
    @objc private func reload() { errorPanel.isHidden = true; webView.isHidden = false; webView.reload() }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window! }
    private func post(_ path: String, object: [String: String]) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: URL(string: path, relativeTo: base)!)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(base.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forHTTPHeaderField: "Origin")
        request.httpBody = try JSONEncoder().encode(object)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { throw URLError(.userAuthenticationRequired) }
        return (data, response)
    }
    private func signIn() {
        guard authentication == nil, signInRequest == nil else { return }
        signInRequest = "starting"
        errorPanel.isHidden = true
        Task { @MainActor in
            do {
                var bytes = [UInt8](repeating: 0, count: 32)
                guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw URLError(.unknown) }
                let verifier = Data(bytes).base64URLEncoded
                let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded
                let (data, _) = try await post("/api/auth/desktop/start", object: ["challenge": challenge])
                struct Started: Decodable { let request: String; let authorizationUrl: URL }
                let started = try JSONDecoder().decode(Started.self, from: data)
                guard sameOrigin(started.authorizationUrl), started.authorizationUrl.path == "/api/auth/github" else { throw URLError(.badURL) }
                signInRequest = started.request
                let session = ASWebAuthenticationSession(url: started.authorizationUrl, callbackURLScheme: "typegrid") { [weak self] callback, error in
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        defer { self.authentication = nil; self.signInRequest = nil }
                        guard error == nil, let callback, callback.scheme == "typegrid", callback.host == "signin",
                              URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "request" })?.value == started.request else {
                            self.failed("Sign-in was cancelled or expired. Choose Continue with GitHub to try again.")
                            return
                        }
                        do {
                            let (_, response) = try await self.post("/api/auth/desktop/exchange", object: ["request": started.request, "verifier": verifier])
                            let headers = response.allHeaderFields.reduce(into: [String: String]()) { result, entry in
                                if let key = entry.key as? String, let value = entry.value as? String { result[key] = value }
                            }
                            let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: self.base)
                            guard let sessionCookie = cookies.first(where: { $0.name == "tg_session" }) else { throw URLError(.userAuthenticationRequired) }
                            await self.webView.configuration.websiteDataStore.httpCookieStore.setCookie(sessionCookie)
                            self.navigate("/app/connect")
                        } catch { self.failed("We couldn’t finish sign-in. Please try again from the app.") }
                    }
                }
                session.presentationContextProvider = self
                authentication = session
                if !session.start() { throw URLError(.userAuthenticationRequired) }
            } catch {
                authentication = nil; signInRequest = nil
                failed("Sign-in is unavailable. Check your connection and try again.")
            }
        }
    }
}
private extension Data {
    var base64URLEncoded: String { base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}
