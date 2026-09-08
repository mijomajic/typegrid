import XCTest
@testable import GridCore
final class CounterTests: XCTestCase {
    func testCountsWithoutContentAndDeduplicatesActiveSeconds() {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800000000)
        for _ in 0..<10 { c.record(at: t, isDev: true) }
        let b = c.buckets.values.first!
        XCTAssertEqual(b.keystrokes,10); XCTAssertEqual(b.activeSeconds,1); XCTAssertEqual(b.devKeystrokes,10); XCTAssertEqual(b.sessions,1); XCTAssertEqual(b.peakWpm,2)
    }
    func testSessionsAndHourRollover() {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800000000)
        c.record(at:t);c.record(at:t.addingTimeInterval(65));c.record(at:t.addingTimeInterval(3600))
        XCTAssertEqual(c.buckets.count,2);XCTAssertEqual(c.buckets.values.reduce(0){$0+$1.sessions},3)
    }
    func testPersistenceAndRetention() throws {
        var c = Counter();let t = Date(timeIntervalSince1970:1800000000);c.record(at:t)
        let data = try JSONEncoder().encode(c.buckets)
        let restored = try JSONDecoder().decode([String:Bucket].self,from:data)
        XCTAssertEqual(restored,c.buckets)
        c.prune(now:t.addingTimeInterval(31*86400));XCTAssertTrue(c.buckets.isEmpty)
        let keys = Set((try JSONSerialization.jsonObject(with: JSONEncoder().encode(restored.values.first!)) as! [String:Any]).keys)
        XCTAssertEqual(keys,["hour","keystrokes","clicks","mouseActiveSeconds","activeSeconds","sessions","devKeystrokes","peakWpm"])
    }
    func testClicksStaySeparateAndRollOver() throws {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800000000)
        c.recordClick(at: t); c.recordClick(at: t)
        let clickOnly = c.buckets.values.first!
        XCTAssertEqual(clickOnly.clicks, 2)
        XCTAssertEqual(clickOnly.keystrokes, 0)
        XCTAssertEqual(clickOnly.activeSeconds, 0)
        XCTAssertEqual(clickOnly.sessions, 0)
        XCTAssertEqual(clickOnly.peakWpm, 0)
        c.record(at: t, isDev: true)
        c.recordClick(at: t.addingTimeInterval(3600))
        XCTAssertEqual(c.buckets.count, 2)
        XCTAssertEqual(c.buckets.values.reduce(0) { $0 + $1.clicks }, 3)
        XCTAssertEqual(c.buckets.values.reduce(0) { $0 + $1.keystrokes }, 1)
        XCTAssertEqual(c.buckets.values.reduce(0) { $0 + $1.devKeystrokes }, 1)
        let restored = try JSONDecoder().decode([String: Bucket].self, from: JSONEncoder().encode(c.buckets))
        XCTAssertEqual(restored, c.buckets)
    }
    func testLegacyBucketsKeepTypingHistory() throws {
        let legacy = Data(#"{"hour":"2027-01-15T08:00:00Z","keystrokes":100,"activeSeconds":20,"sessions":1,"devKeystrokes":70,"peakWpm":20}"#.utf8)
        let restored = try JSONDecoder().decode(Bucket.self, from: legacy)
        XCTAssertEqual(restored.clicks, 0)
        XCTAssertEqual(restored.keystrokes, 100)
        XCTAssertEqual(restored.devKeystrokes, 70)
        XCTAssertEqual(restored.activeSeconds, 20)
    }
    func testClickLimitAndRetention() {
        let t = Date(timeIntervalSince1970: 1800000000)
        let key = ISO8601DateFormatter().string(from: t)
        var bucket = Bucket(hour: key); bucket.clicks = 359999
        var c = Counter(buckets: [key: bucket])
        c.recordClick(at: t); c.recordClick(at: t)
        XCTAssertEqual(c.buckets[key]?.clicks, 360000)
        c.prune(now: t.addingTimeInterval(31 * 86400))
        XCTAssertTrue(c.buckets.isEmpty)
    }
    func testMouseActivityStopsAtThreeSecondsAndDoesNotDoubleCount() {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800000000)
        c.recordMouseActivity(at: t)
        c.advanceMouseActivity(to: t.addingTimeInterval(2.5))
        XCTAssertEqual(c.buckets.values.first!.mouseActiveSeconds, 2.5, accuracy: 0.0001)
        c.advanceMouseActivity(to: t.addingTimeInterval(3))
        c.advanceMouseActivity(to: t.addingTimeInterval(300))
        XCTAssertEqual(c.buckets.values.first!.mouseActiveSeconds, 3)
        XCTAssertEqual(c.buckets.values.first!.clicks, 0)
        XCTAssertEqual(c.buckets.values.first!.activeSeconds, 0)
        c.recordMouseActivity(at: t.addingTimeInterval(300))
        c.advanceMouseActivity(to: t.addingTimeInterval(301))
        XCTAssertEqual(c.buckets.values.first!.mouseActiveSeconds, 4)
    }
    func testMouseActivityExtendsAndPauseStopsImmediately() {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800000000)
        c.recordClick(at: t)
        c.recordMouseActivity(at: t.addingTimeInterval(2))
        c.stopMouseActivity(at: t.addingTimeInterval(4))
        c.advanceMouseActivity(to: t.addingTimeInterval(100))
        XCTAssertEqual(c.buckets.values.first!.mouseActiveSeconds, 4)
        XCTAssertEqual(c.buckets.values.first!.clicks, 1)
        c.recordMouseActivity(at: t.addingTimeInterval(100))
        c.advanceMouseActivity(to: t.addingTimeInterval(110))
        XCTAssertEqual(c.buckets.values.first!.mouseActiveSeconds, 7)
    }
    func testMouseTimeSplitsHoursAndDoesNotRestoreActiveTimer() throws {
        var c = Counter(); let t = Date(timeIntervalSince1970: 1800003599)
        c.recordMouseActivity(at: t)
        c.advanceMouseActivity(to: t.addingTimeInterval(30))
        let sorted = c.buckets.values.sorted { $0.hour < $1.hour }
        XCTAssertEqual(sorted.map { $0.mouseActiveSeconds }, [1, 2])
        let saved = try JSONEncoder().encode(c.buckets)
        var restored = Counter(buckets: try JSONDecoder().decode([String: Bucket].self, from: saved))
        restored.advanceMouseActivity(to: t.addingTimeInterval(100))
        XCTAssertEqual(restored.buckets, c.buckets)
    }
}
