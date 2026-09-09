import XCTest
@testable import GridCore

final class DailyGoalsTests: XCTestCase {
    func testBothTargetsMustBeReached() {
        let goals = DailyGoals(keystrokes: 20000, clicks: 3000)
        XCTAssertEqual(goals.percent(keystrokes: 0, clicks: 0), 0)
        XCTAssertEqual(goals.percent(keystrokes: 10000, clicks: 1500), 50)
        XCTAssertEqual(goals.percent(keystrokes: 100000, clicks: 0), 50)
        XCTAssertEqual(goals.percent(keystrokes: 20000, clicks: 2999), 99)
        XCTAssertEqual(goals.percent(keystrokes: 19999, clicks: 3000), 99)
        XCTAssertEqual(goals.percent(keystrokes: 30000, clicks: 4000), 100)
    }
    func testOtherDevicesAndUTCRollover() throws {
        let data = Data(#"{"deviceId":"mac-a","username":"sample","goals":{"keystrokes":20000,"clicks":3000},"otherDevices":{"day":"2026-09-10","keystrokes":10000,"clicks":1500}}"#.utf8)
        let state = try JSONDecoder().decode(GoalSyncState.self, from: data)
        XCTAssertEqual(state.percent(localKeystrokes: 10000, localClicks: 1500, day: "2026-09-10"), 100)
        XCTAssertEqual(state.percent(localKeystrokes: 0, localClicks: 0, day: "2026-09-11"), 0)
        XCTAssertEqual(state.percent(localKeystrokes: 10000, localClicks: 1500, day: "2026-09-11"), 50)
        let restored = try JSONDecoder().decode(GoalSyncState.self, from: JSONEncoder().encode(state))
        XCTAssertEqual(restored.deviceId, "mac-a")
        XCTAssertEqual(restored.goals, state.goals)
    }
    func testUnconfiguredAndDisabledGoals() throws {
        let data = Data(#"{"deviceId":"mac-a","username":"sample","goals":null,"otherDevices":{"day":"2026-09-10","keystrokes":0,"clicks":0}}"#.utf8)
        let state = try JSONDecoder().decode(GoalSyncState.self, from: data)
        XCTAssertNil(state.percent(localKeystrokes: 10000, localClicks: 1500, day: "2026-09-10"))
        XCTAssertEqual(DailyGoals(keystrokes: 0, clicks: 1).percent(keystrokes: 10, clicks: 10), 0)
    }
}
