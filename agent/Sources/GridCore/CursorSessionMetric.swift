import Foundation

/// Only the two documented fields needed for elapsed session statistics are decoded.
public struct CursorSessionMetric: Decodable {
    public let session_id: String
    public let duration_ms: Double

    public static func decode(_ data: Data) -> CursorSessionMetric? {
        guard data.count <= 65536,
              let event = try? JSONDecoder().decode(Self.self, from: data),
              !event.session_id.isEmpty, event.session_id.count <= 128,
              event.duration_ms.isFinite, (0...864000000).contains(event.duration_ms)
        else { return nil }
        return event
    }
}
