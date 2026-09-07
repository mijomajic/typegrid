import Foundation
import Network
import GridCore

struct CodingQueue: Codable { let deviceId: String; let buckets: [CodingBucket] }

func trackCoding(_ provider: String, arguments: [String]) throws {
    guard ["claude","codex"].contains(provider) else { throw NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:"Use typegrid track claude or typegrid track codex."]) }
    let dirs = ["/opt/homebrew/bin","/usr/local/bin",FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin").path]
    guard let binary = dirs.map({$0+"/"+provider}).first(where: {FileManager.default.isExecutableFile(atPath:$0)}) else { throw NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:"Install \(provider) first."]) }
    let config = loadConfig()
    guard config.token != nil else { throw NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:"Run typegrid pair first."]) }
    let secret=UUID().uuidString
    let listener=try startCodingReceiver(provider,secret:secret,portNumber:0,persistent:false)
    defer {listener.cancel()}
    guard let port=listener.port else {return}
    let endpoint = "http://127.0.0.1:\(port.rawValue)/v1/metrics"
    let process = Process();process.executableURL=URL(fileURLWithPath:binary)
    var env = ProcessInfo.processInfo.environment
    env["OTEL_METRICS_EXPORTER"]="otlp";env["OTEL_LOGS_EXPORTER"]="none";env["OTEL_TRACES_EXPORTER"]="none"
    env["OTEL_EXPORTER_OTLP_METRICS_PROTOCOL"]="http/json";env["OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"]=endpoint
    env["OTEL_EXPORTER_OTLP_METRICS_HEADERS"]="Authorization=Bearer \(secret)";env["OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE"]="CUMULATIVE"
    env["OTEL_METRIC_EXPORT_INTERVAL"]="10000"
    if provider == "claude" { env["CLAUDE_CODE_ENABLE_TELEMETRY"]="1";process.arguments=arguments }
    else {
        process.arguments=["-c","otel.exporter=\"none\"","-c","otel.trace_exporter=\"none\"","-c","otel.metrics_exporter={otlp-http={endpoint=\"\(endpoint)\",protocol=\"json\",headers={Authorization=\"Bearer \(secret)\"}}}"]+arguments
    }
    process.environment=env
    process.standardInput=FileHandle.standardInput;process.standardOutput=FileHandle.standardOutput;process.standardError=FileHandle.standardError
    print("TypeGrid · tracking \(provider) tokens and work time. Sign in normally inside \(provider).")
    try process.run();process.waitUntilExit()
}

func startCodingReceiver(_ provider:String,secret:String,portNumber:UInt16,persistent:Bool) throws -> NWListener {
    let config=loadConfig()
    let params = NWParameters.tcp
    params.requiredLocalEndpoint = .hostPort(host:"127.0.0.1",port:NWEndpoint.Port(rawValue:portNumber) ?? .any)
    let listener = try NWListener(using:params)
    let queue = DispatchQueue(label:"dev.typegrid.coding")
    let ready = DispatchSemaphore(value:0)
    var failed = false
    listener.stateUpdateHandler = { state in if case .ready = state { ready.signal() }; if case .failed = state { failed=true;ready.signal() } }
    let stateURL = root.appendingPathComponent("coding-state-\(provider).json")
    struct State: Codable { let deviceId:String; let metrics:CodingMetrics }
    let old = persistent ? (try? JSONDecoder().decode(State.self,from:Data(contentsOf:stateURL))) : nil
    var metrics = old?.deviceId == config.deviceId ? old!.metrics : CodingMetrics()
    let streamId = persistent ? (provider == "codex" ? config.codexStream : config.claudeStream) ?? UUID().uuidString : UUID().uuidString
    let queueURL = root.appendingPathComponent("coding-\(streamId).json")
    listener.newConnectionHandler = { connection in
        connection.start(queue:queue)
        var buffer = Data()
        func reply(_ code:Int) {
            let response = "HTTP/1.1 \(code) \(code == 200 ? "OK" : "Rejected")\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}"
            connection.send(content:Data(response.utf8),completion:.contentProcessed {_ in connection.cancel()})
        }
        func receive() {
            connection.receive(minimumIncompleteLength:1,maximumLength:65536) { data,_,done,error in
                if let data { buffer.append(data) }
                guard buffer.count <= 1_064_960 else { reply(413);return }
                if let range = buffer.range(of:Data("\r\n\r\n".utf8)) {
                    let header = String(decoding:buffer[..<range.lowerBound],as:UTF8.self)
                    let lines = header.components(separatedBy:"\r\n")
                    var fields:[String:String] = [:]
                    for line in lines.dropFirst() { let parts = line.split(separator:":",maxSplits:1); if parts.count == 2 { fields[parts[0].lowercased()] = parts[1].trimmingCharacters(in:.whitespaces) } }
                    guard lines.first == "POST /v1/metrics HTTP/1.1", fields["authorization"] == "Bearer \(secret)", fields["content-type"]?.hasPrefix("application/json") == true, fields["content-encoding"] == nil, let length = Int(fields["content-length"] ?? ""), length >= 0, length <= 1_048_576 else { reply(400);return }
                    if buffer.count-range.upperBound >= length {
                        do {
                            try metrics.accept(buffer.subdata(in:range.upperBound..<(range.upperBound+length)),provider:provider)
                            try save(CodingQueue(deviceId:config.deviceId ?? "",buckets:Array(metrics.buckets.values)),to:queueURL)
                            if persistent { try save(State(deviceId:config.deviceId ?? "",metrics:metrics),to:stateURL) }
                            reply(200)
                        } catch { reply(400) }
                        return
                    }
                }
                if done || error != nil { connection.cancel() } else { receive() }
            }
        }
        receive()
        queue.asyncAfter(deadline:.now()+10) { connection.cancel() }
    }
    listener.start(queue:queue)
    guard ready.wait(timeout:.now()+5) == .success, !failed, listener.port != nil else { listener.cancel(); throw NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:"Could not start the local metrics receiver."]) }
    return listener
}
