import Foundation

public struct CodingBucket: Codable {
    public var hour: String
    public var provider: String
    public var tokens: Int = 0
    public var workSeconds: Double = 0
}
// Only these OTLP fields are decoded. Resources, identities, logs and traces are ignored.
private struct Envelope: Decodable {
    var resourceMetrics: [Resource]
    struct Resource: Decodable { var scopeMetrics: [Scope] }
    struct Scope: Decodable { var metrics: [Metric] }
    struct Metric: Decodable { var name: String; var sum: Series?; var histogram: Series? }
    struct Series: Decodable { var aggregationTemporality: Int; var dataPoints: [Point] }
    struct Point: Decodable {
        var startTimeUnixNano: String
        var asInt: String?
        var asDouble: Double?
        var sum: Double?
        var attributes: [Attribute]?
    }
    struct Attribute: Decodable {
        var key: String; var value: Value
        enum CodingKeys: String, CodingKey { case key, value }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy:CodingKeys.self)
            key = try c.decode(String.self,forKey:.key)
            value = key == "token_type" ? try c.decode(Value.self,forKey:.value) : Value(stringValue:nil)
        }
    }
    struct Value: Decodable { var stringValue: String? }
}
public struct CodingMetrics: Codable {
    public var buckets: [String: CodingBucket] = [:]
    var previous: [String: Double] = [:]
    public init() {}
    public mutating func accept(_ data: Data, provider: String, now: Date = Date()) throws {
        guard data.count <= 1_048_576, ["claude", "codex"].contains(provider) else { return }
        let envelope = try JSONDecoder().decode(Envelope.self,from:data)
        var sums: [String: Double] = [:]
        var kinds: [String: String] = [:]
        for resource in envelope.resourceMetrics { for scope in resource.scopeMetrics { for metric in scope.metrics {
            let kind: String
            switch (provider,metric.name) {
            case ("claude","claude_code.token.usage"), ("codex","codex.turn.token_usage"): kind="tokens"
            case ("claude","claude_code.active_time.total"), ("codex","codex.turn.e2e_duration_ms"): kind="time"
            default: continue
            }
            guard let series = metric.sum ?? metric.histogram, series.aggregationTemporality == 2 else { continue }
            for point in series.dataPoints {
                guard point.startTimeUnixNano.count <= 20, let start = Double(point.startTimeUnixNano), start > 0 else { continue }
                if provider == "codex" && kind == "tokens" {
                    guard point.attributes?.contains(where: { $0.key == "token_type" && $0.value.stringValue == "total" }) == true else { continue }
                }
                guard let value = point.asDouble ?? point.asInt.flatMap(Double.init) ?? point.sum, value.isFinite, value >= 0, value <= 1e12 else { continue }
                // A cumulative series starts at process creation. Collapse dimensions before taking its delta.
                let key = provider + ":" + metric.name + ":" + point.startTimeUnixNano
                sums[key,default:0] += value; kinds[key] = kind
            }
        }}}
        let date = ISO8601DateFormatter(); let h = Date(timeIntervalSince1970:floor(now.timeIntervalSince1970/3600)*3600)
        let hour = date.string(from:h), bucketKey = provider + ":" + hour
        var bucket = buckets[bucketKey] ?? CodingBucket(hour:hour,provider:provider)
        for (key,value) in sums {
            let delta = max(0,value-(previous[key] ?? 0))
            previous[key] = max(value,previous[key] ?? 0)
            if kinds[key] == "tokens" { bucket.tokens += min(Int(delta),100_000_000) }
            else { bucket.workSeconds += min(provider == "codex" ? delta/1000 : delta,86400) }
        }
        if !sums.isEmpty { buckets[bucketKey] = bucket }
        let cutoff = now.addingTimeInterval(-30*86400)
        buckets = buckets.filter { (date.date(from:$0.value.hour) ?? .distantPast) >= cutoff }
        previous = previous.filter { key,_ in
            guard let timestamp = Double(key.split(separator:":").last ?? "") else { return false }
            return timestamp/1e9 >= cutoff.timeIntervalSince1970
        }
    }
}
