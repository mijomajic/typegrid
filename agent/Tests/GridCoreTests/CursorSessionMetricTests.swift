import XCTest
@testable import GridCore

final class CursorSessionMetricTests: XCTestCase {
    func testOnlyDurationAndSessionIdentifierAreDecoded() throws {
        let data = Data(#"{"session_id":"random-session","duration_ms":12500,"prompt":"must be discarded","error_message":{"private":"ignored"}}"#.utf8)
        let metric = try XCTUnwrap(CursorSessionMetric.decode(data))
        XCTAssertEqual(metric.duration_ms, 12500)
        XCTAssertEqual(metric.session_id, "random-session")
    }
    func testRejectsInvalidAndOversizedEvents() {
        for input in [#"{"session_id":"x","duration_ms":-1}"#, #"{"session_id":"","duration_ms":12}"#, #"{"session_id":"x","duration_ms":864000001}"#, #"{"session_id":"x","duration_ms":"12"}"#] {
            XCTAssertNil(CursorSessionMetric.decode(Data(input.utf8)))
        }
        XCTAssertNil(CursorSessionMetric.decode(Data(repeating: 32, count: 65537)))
    }
}
