import Foundation

public struct DailyGoals: Codable, Equatable {
    public let keystrokes: Int
    public let clicks: Int
    public init(keystrokes: Int, clicks: Int) { self.keystrokes = keystrokes; self.clicks = clicks }

    /// Each goal contributes half; excess in one cannot complete the other.
    public func percent(keystrokes: Int, clicks: Int) -> Int {
        guard self.keystrokes > 0, self.clicks > 0 else { return 0 }
        let keys = min(1, Double(max(0, keystrokes)) / Double(self.keystrokes))
        let mouse = min(1, Double(max(0, clicks)) / Double(self.clicks))
        return Int(floor((keys + mouse) * 50))
    }
}

/// Only the authenticated account's goals and aggregate totals are cached.
public struct GoalSyncState: Codable, Equatable {
    public struct OtherDevices: Codable, Equatable {
        public let day: String
        public let keystrokes: Int
        public let clicks: Int
    }
    public let deviceId: String
    public let goals: DailyGoals?
    public let otherDevices: OtherDevices

    public func percent(localKeystrokes: Int, localClicks: Int, day: String) -> Int? {
        goals?.percent(
            keystrokes: localKeystrokes + (otherDevices.day == day ? otherDevices.keystrokes : 0),
            clicks: localClicks + (otherDevices.day == day ? otherDevices.clicks : 0)
        )
    }
}
