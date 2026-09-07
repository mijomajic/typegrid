import Foundation
func codingSetupError(_ message:String)->NSError {NSError(domain:"TypeGrid",code:1,userInfo:[NSLocalizedDescriptionKey:message])}
func configureCoding(_ provider:String,disconnect:Bool=false) throws {
 guard ["codex","claude"].contains(provider) else {throw codingSetupError("Choose codex or claude.")}
 var config=loadConfig()
 if disconnect && config.codingProviders?.contains(provider) != true {return}
 guard config.deviceId != nil else {throw codingSetupError("Pair TypeGrid first.")}
 if config.codingSecret == nil {config.codingSecret=UUID().uuidString+UUID().uuidString}
 if config.codexStream == nil {config.codexStream=UUID().uuidString}
 if config.claudeStream == nil {config.claudeStream=UUID().uuidString}
 let secret=config.codingSecret!
 let home=FileManager.default.homeDirectoryForCurrentUser
 let file=home.appendingPathComponent(provider == "codex" ? ".codex/config.toml" : ".claude/settings.json")
 try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
 if provider == "codex" {
    let begin="# BEGIN TYPEGRID METRICS",end="# END TYPEGRID METRICS"
    var text=(try? String(contentsOf:file,encoding:.utf8)) ?? ""
    if let first=text.range(of:begin),let last=text.range(of:end,range:first.lowerBound..<text.endIndex) {text.removeSubrange(first.lowerBound..<last.upperBound)}
    if !disconnect {
        guard !text.contains("[otel"), !text.components(separatedBy:"\n").contains(where:{$0.trimmingCharacters(in:.whitespaces).hasPrefix("otel.")}) else {throw codingSetupError("Codex already has telemetry configured. TypeGrid left it unchanged; combine the exporters manually or remove the existing configuration first.")}
        text += """

\(begin)
[otel]
exporter = "none"
trace_exporter = "none"
log_user_prompt = false
[otel.metrics_exporter.otlp-http]
endpoint = "http://127.0.0.1:43189/v1/metrics"
protocol = "json"
[otel.metrics_exporter.otlp-http.headers]
Authorization = "Bearer \(secret)"
\(end)

"""
    }
    try text.write(to:file,atomically:true,encoding:.utf8)
 } else {
    var settings:[String:Any]=[:]
    if FileManager.default.fileExists(atPath:file.path) {
        guard let object=try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as? [String:Any] else {throw codingSetupError("Claude settings are not a JSON object; nothing changed.")};settings=object
    }
    var env=settings["env"] as? [String:Any] ?? [:]
    let values=["CLAUDE_CODE_ENABLE_TELEMETRY":"1","OTEL_METRICS_EXPORTER":"otlp","OTEL_LOGS_EXPORTER":"none","OTEL_TRACES_EXPORTER":"none","OTEL_EXPORTER_OTLP_METRICS_PROTOCOL":"http/json","OTEL_EXPORTER_OTLP_METRICS_ENDPOINT":"http://127.0.0.1:43190/v1/metrics","OTEL_EXPORTER_OTLP_METRICS_HEADERS":"Authorization=Bearer \(secret)","OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE":"CUMULATIVE","OTEL_METRIC_EXPORT_INTERVAL":"10000"]
    if disconnect {for (key,value) in values where env[key] as? String == value {env.removeValue(forKey:key)}}
    else {
        for (key,value) in values {if let existing=env[key], existing as? String != value {throw codingSetupError("Claude already has a different telemetry setting (\(key)). Nothing changed.")}}
        for (key,value) in values {env[key]=value}
    }
    settings["env"]=env
    try JSONSerialization.data(withJSONObject:settings,options:[.prettyPrinted,.sortedKeys]).write(to:file,options:.atomic)
 }
 try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:file.path)
 var providers=Set(config.codingProviders ?? [])
 if disconnect {providers.remove(provider)} else {providers.insert(provider)}
 config.codingProviders=Array(providers).sorted()
 try save(config,to:configURL)
}
