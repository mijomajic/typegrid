import Foundation
import CryptoKit
import GridCore

func cursorSessionEnded() throws {
    let config=loadConfig()
    guard config.codingProviders?.contains("cursor") == true, let device=config.deviceId else {return}
    let data=FileHandle.standardInput.readData(ofLength:65537)
    guard data.count<=65536 else{return}
    // Decode only the documented random session identifier and duration.
    guard let event=CursorSessionMetric.decode(data) else{return}
    let digest=Array(SHA256.hash(data:Data((device+":"+event.session_id).utf8)).prefix(16))
    let id=UUID(uuid:(digest[0],digest[1],digest[2],digest[3],digest[4],digest[5],digest[6],digest[7],digest[8],digest[9],digest[10],digest[11],digest[12],digest[13],digest[14],digest[15]))
    let file=root.appendingPathComponent("coding-\(id.uuidString).json")
    let old=(try? JSONDecoder().decode(CodingQueue.self,from:Data(contentsOf:file)))?.buckets.first
    let hour=old?.hour ?? ISO8601DateFormatter().string(from:Date(timeIntervalSince1970:floor(Date().timeIntervalSince1970/3600)*3600))
    // Preserve first receipt hour and use maximum duration so repeat delivery is idempotent.
    let bucket=CodingBucket(hour:hour,provider:"cursor",tokens:0,workSeconds:max(old?.workSeconds ?? 0,event.duration_ms/1000))
    try save(CodingQueue(deviceId:device,buckets:[bucket]),to:file)
}
func configureCursor(_ disconnect:Bool) throws {
    var config=loadConfig()
    guard config.deviceId != nil else{throw codingSetupError("Pair TypeGrid first.")}
    let file=FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".cursor/hooks.json")
    var settings:[String:Any]=[:]
    if FileManager.default.fileExists(atPath:file.path){guard let object=try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as? [String:Any] else{throw codingSetupError("Cursor hooks configuration is invalid; nothing changed.")};settings=object}
    guard settings["hooks"] == nil || settings["hooks"] is [String:Any] else {throw codingSetupError("Cursor hooks configuration is invalid; nothing changed.")}
    var hooks=settings["hooks"] as? [String:Any] ?? [:]
    guard hooks["sessionEnd"] == nil || hooks["sessionEnd"] is [[String:Any]] else {throw codingSetupError("Cursor session hooks are invalid; nothing changed.")}
    var entries=hooks["sessionEnd"] as? [[String:Any]] ?? []
    let binary=FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin/typegrid").path
    let command="'"+binary.replacingOccurrences(of:"'",with:"'\\''")+"' cursor-session-end"
    entries.removeAll{$0["command"] as? String == command}
    if !disconnect {entries.append(["command":command])}
    hooks["sessionEnd"]=entries;settings["hooks"]=hooks
    if settings["version"] == nil {settings["version"]=1}
    try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
    try JSONSerialization.data(withJSONObject:settings,options:[.prettyPrinted,.sortedKeys]).write(to:file,options:.atomic)
    try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:file.path)
    var providers=Set(config.codingProviders ?? [])
    if disconnect {providers.remove("cursor")} else{providers.insert("cursor")}
    config.codingProviders=Array(providers).sorted();try save(config,to:configURL)
}
