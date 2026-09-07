import XCTest
@testable import GridCore
final class CodingMetricsTests: XCTestCase {
    func testDeltaWindowsReplayAndPersistence() throws {
        var metrics=CodingMetrics()
        func payload(_ end:String,_ count:Int)->Data {
            Data("""
            {"resourceMetrics":[{"scopeMetrics":[{"metrics":[{"name":"codex.turn.token_usage","histogram":{"aggregationTemporality":1,"dataPoints":[{"startTimeUnixNano":"1788780000000000000","timeUnixNano":"\(end)","sum":\(count),"attributes":[{"key":"token_type","value":{"stringValue":"total"}}]}]}}]}]}]}
            """.utf8)
        }
        let now=Date(timeIntervalSince1970:1788780100)
        try metrics.accept(payload("1788780060000000000",100),provider:"codex",now:now)
        metrics=try JSONDecoder().decode(CodingMetrics.self,from:JSONEncoder().encode(metrics))
        try metrics.accept(payload("1788780060000000000",100),provider:"codex",now:now)
        try metrics.accept(payload("1788780120000000000",50),provider:"codex",now:now)
        XCTAssertEqual(metrics.buckets.values.reduce(0){$0+$1.tokens},150)
    }

 func testCumulativeReplayAndPrivateAttributes() throws {
  let now=Date(), start=String(Int64(now.timeIntervalSince1970*1e9))
  func packet(_ n:Int,_ temporality:Int=2)->Data { Data("""
  {"resourceMetrics":[{"resource":{"attributes":[{"key":"email","value":{"stringValue":"PRIVATE"}}]},"scopeMetrics":[{"metrics":[{"name":"claude_code.token.usage","sum":{"aggregationTemporality":\(temporality),"dataPoints":[{"startTimeUnixNano":"\(start)","asInt":"\(n)","attributes":[{"key":"prompt","value":{"stringValue":"PRIVATE"}}]}]}},{"name":"prompt","sum":{"aggregationTemporality":2,"dataPoints":[]}}]}]}]}
  """.utf8) }
  var m=CodingMetrics();try m.accept(packet(120),provider:"claude",now:now);try m.accept(packet(120),provider:"claude",now:now);try m.accept(packet(100),provider:"claude",now:now);try m.accept(packet(150),provider:"claude",now:now)
  XCTAssertEqual(m.buckets.values.first?.tokens,150)
  try m.accept(packet(1000,1),provider:"claude",now:now)
  XCTAssertEqual(m.buckets.values.first?.tokens,150)
  XCTAssertFalse(String(decoding:try JSONEncoder().encode(m),as:UTF8.self).contains("PRIVATE"))
 }
 func testCodexTotalExcludesOverlappingCategories() throws {
  let start=String(Int64(Date().timeIntervalSince1970*1e9))
  let points=["total","input","cached_input","output","reasoning_output"].map { "{\"startTimeUnixNano\":\"\(start)\",\"sum\":100,\"attributes\":[{\"key\":\"token_type\",\"value\":{\"stringValue\":\"\($0)\"}}]}" }.joined(separator:",")
  let data=Data("{\"resourceMetrics\":[{\"scopeMetrics\":[{\"metrics\":[{\"name\":\"codex.turn.token_usage\",\"histogram\":{\"aggregationTemporality\":2,\"dataPoints\":[\(points)]}}]}]}]}".utf8)
  var m=CodingMetrics();try m.accept(data,provider:"codex");XCTAssertEqual(m.buckets.values.first?.tokens,100)
 }
}
