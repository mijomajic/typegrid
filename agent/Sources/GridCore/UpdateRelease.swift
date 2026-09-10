import Foundation

public struct UpdateRelease: Decodable {
    public struct Asset: Decodable {
        public let name: String
        public let browser_download_url: String
    }
    public let tag_name: String
    public let draft: Bool
    public let prerelease: Bool
    public let assets: [Asset]

    public var version: ReleaseVersion? {
        guard !draft, !prerelease, tag_name.hasPrefix("v") else { return nil }
        return ReleaseVersion(String(tag_name.dropFirst()))
    }

    // Never execute a URL supplied by release notes or an arbitrary asset host.
    public func hasAsset(_ name: String) -> Bool {
        guard let version else { return false }
        let expected = "https://github.com/mijomajic/typegrid/releases/download/v\(version)/\(name)"
        return assets.filter { $0.name == name && $0.browser_download_url == expected }.count == 1
    }

    public var kind: String? {
        guard version != nil, hasAsset("SHA256SUMS") else { return nil }
        if hasAsset("TypeGrid-macos.zip") { return "signed" }
        if hasAsset("typegrid-source.tar.gz") { return "source" }
        return nil
    }
}
