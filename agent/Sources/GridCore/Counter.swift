import Foundation

public struct Bucket: Codable, Equatable {
    public var hour: String
    public var keystrokes = 0
    public var clicks = 0
    public var activeSeconds = 0
    public var sessions = 0
    public var devKeystrokes = 0
    public var peakWpm = 0
    public init(hour: String) { self.hour = hour }
    private enum CodingKeys: String, CodingKey {
        case hour, keystrokes, clicks, activeSeconds, sessions, devKeystrokes, peakWpm
    }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        hour = try values.decode(String.self, forKey: .hour)
        keystrokes = try values.decode(Int.self, forKey: .keystrokes)
        clicks = try values.decodeIfPresent(Int.self, forKey: .clicks) ?? 0
        activeSeconds = try values.decode(Int.self, forKey: .activeSeconds)
        sessions = try values.decode(Int.self, forKey: .sessions)
        devKeystrokes = try values.decode(Int.self, forKey: .devKeystrokes)
        peakWpm = try values.decode(Int.self, forKey: .peakWpm)
    }
}

/// Counts event occurrence only. No event object, character, or key code can enter this API.
public struct Counter {
    public private(set) var buckets: [String: Bucket]
    private var lastSecond: Int?
    private var minute: Int?
    private var minuteKeys = 0
    public init(buckets: [String: Bucket] = [:]) { self.buckets = buckets }
    public mutating func record(at date: Date = Date(), isDev: Bool = false) {
        let second = Int(date.timeIntervalSince1970)
        let hourDate = Date(timeIntervalSince1970: Double(second / 3600 * 3600))
        let key = ISO8601DateFormatter().string(from: hourDate)
        var b = buckets[key] ?? Bucket(hour: key)
        b.keystrokes = min(360000, b.keystrokes + 1)
        if isDev { b.devKeystrokes = min(b.keystrokes, b.devKeystrokes + 1) }
        if lastSecond != second { b.activeSeconds = min(3600, b.activeSeconds + 1) }
        if lastSecond == nil || second - lastSecond! >= 60 { b.sessions = min(3600, b.sessions + 1) }
        if minute != second / 60 { minute = second / 60; minuteKeys = 0 }
        minuteKeys += 1
        // Fixed UTC minute window; estimated words = events / 5, not literal words.
        b.peakWpm = min(1200, max(b.peakWpm, minuteKeys / 5))
        lastSecond = second
        buckets[key] = b
    }
    /// One mouse-button down event; no button identity, position, or event data is retained.
    public mutating func recordClick(at date: Date = Date()) {
        let second = Int(date.timeIntervalSince1970)
        let hourDate = Date(timeIntervalSince1970: Double(second / 3600 * 3600))
        let key = ISO8601DateFormatter().string(from: hourDate)
        var b = buckets[key] ?? Bucket(hour: key)
        b.clicks = min(360000, b.clicks + 1)
        buckets[key] = b
    }
    public mutating func prune(now: Date = Date()) {
        let cutoff = ISO8601DateFormatter().string(from: now.addingTimeInterval(-30 * 86400))
        buckets = buckets.filter { $0.key >= cutoff }
    }
}
