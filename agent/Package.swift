// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "TypeGrid", platforms: [.macOS(.v13)], products: [.executable(name: "typegrid", targets: ["TypeGrid"])], targets: [.target(name: "GridCore"), .executableTarget(name: "TypeGrid", dependencies: ["GridCore"]), .testTarget(name: "GridCoreTests", dependencies: ["GridCore"])])
