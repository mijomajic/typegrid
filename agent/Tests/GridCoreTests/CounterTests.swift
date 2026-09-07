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
        XCTAssertEqual(keys,["hour","keystrokes","activeSeconds","sessions","devKeystrokes","peakWpm"])
    }
}
