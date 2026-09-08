import XCTest
@testable import GridCore
final class ReleaseVersionTests: XCTestCase {
    func testStableVersionsCompareNumericallyWithoutDowngrades() {
        XCTAssertTrue(ReleaseVersion("v0.2.0")! > ReleaseVersion("0.1.19")!)
        XCTAssertTrue(ReleaseVersion("1.10.0")! > ReleaseVersion("1.9.9")!)
        XCTAssertEqual(ReleaseVersion("v0.2.0")!.description, "0.2.0")
        for value in ["1", "1.2", "1.2.3.4", "1.2.3-beta", "../1.2.3", "01.2.3", "1.-2.3", "1.2.٣", "1.2.3\n", ""] { XCTAssertNil(ReleaseVersion(value), value) }
    }
    func testChecksumIsUnambiguousAndBoundToTheSourceAsset() {
        let digest = String(repeating: "a", count: 64)
        XCTAssertEqual(ReleaseValidation.sourceChecksum(digest + "  typegrid-source.tar.gz\n"), digest)
        XCTAssertNil(ReleaseValidation.sourceChecksum(digest + "  other.tar.gz"))
        XCTAssertNil(ReleaseValidation.sourceChecksum("bad  typegrid-source.tar.gz"))
        XCTAssertNil(ReleaseValidation.sourceChecksum(String(repeating: digest + "  typegrid-source.tar.gz\n", count: 2)))
    }
    func testArchiveCannotEscapeItsStagingDirectory() {
        XCTAssertTrue(ReleaseValidation.safeArchiveEntry("typegrid/agent/Sources/TypeGrid/App.swift"))
        XCTAssertTrue(ReleaseValidation.safeArchiveEntry("typegrid/"))
        for value in ["/typegrid/a", "typegrid/../a", "typegrid/./a", "other/file", "typegrid\\file", ""] { XCTAssertFalse(ReleaseValidation.safeArchiveEntry(value), value) }
    }
}
