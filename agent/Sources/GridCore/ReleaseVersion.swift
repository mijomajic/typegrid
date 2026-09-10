import Foundation

public struct ReleaseVersion: Comparable, Equatable, CustomStringConvertible {
    public static let current = ReleaseVersion("0.2.3")!
    public let major: Int
    public let minor: Int
    public let patch: Int
    public init?(_ value: String) {
        let raw = value.hasPrefix("v") ? String(value.dropFirst()) : value
        let parts = raw.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3, parts.allSatisfy({ !$0.isEmpty && $0.count <= 8 && $0.allSatisfy({ $0.isASCII && $0.isNumber }) && ($0 == "0" || !$0.hasPrefix("0")) }),
              let major = Int(parts[0]), let minor = Int(parts[1]), let patch = Int(parts[2]) else { return nil }
        self.major = major; self.minor = minor; self.patch = patch
    }
    public var description: String { "\(major).\(minor).\(patch)" }
    public static func < (lhs: Self, rhs: Self) -> Bool { (lhs.major, lhs.minor, lhs.patch) < (rhs.major, rhs.minor, rhs.patch) }
}

public enum ReleaseValidation {
    public static func sourceChecksum(_ manifest: String, asset: String = "typegrid-source.tar.gz") -> String? {
        let matching = manifest.split(whereSeparator: \.isNewline).compactMap { line -> String? in
            let fields = line.split(whereSeparator: \.isWhitespace)
            guard fields.count == 2, fields[1] == Substring(asset), fields[0].count == 64,
                  fields[0].allSatisfy({ $0.isASCII && $0.isHexDigit }) else { return nil }
            return String(fields[0]).lowercased()
        }
        return matching.count == 1 ? matching[0] : nil
    }
    public static func safeArchiveEntry(_ entry: String, root: String = "typegrid") -> Bool {
        let parts = entry.split(separator: "/", omittingEmptySubsequences: true)
        return !entry.hasPrefix("/") && !entry.contains("\\") && !entry.contains("\0") &&
            parts.first == Substring(root) && parts.allSatisfy({ $0 != "." && $0 != ".." })
    }
}
