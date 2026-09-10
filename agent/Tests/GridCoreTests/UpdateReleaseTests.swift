import XCTest
@testable import GridCore

final class UpdateReleaseTests: XCTestCase {
    func testVersionsCompareNumericallyAndRejectShellInput() throws {
        XCTAssertLessThan(try XCTUnwrap(ReleaseVersion("0.1.9")), try XCTUnwrap(ReleaseVersion("0.1.10")))
        XCTAssertLessThan(try XCTUnwrap(ReleaseVersion("0.99.99")), try XCTUnwrap(ReleaseVersion("1.0.0")))
        XCTAssertEqual(ReleaseVersion("0.1.9"), ReleaseVersion("0.1.9"))
        for value in ["", "1.2", "1.2.3.4", "1..3", "01.2.3", "1.2.3-beta", "1.2.3\n", "1.2.$(id)", "1.2.999999999999999999", "1.٢.3"] {
            XCTAssertNil(ReleaseVersion(value), value)
        }
    }

    private func release(tag: String = "v0.1.10", names: [String] = ["typegrid-source.tar.gz", "SHA256SUMS"], host: String = "https://github.com", draft: Bool = false, prerelease: Bool = false) throws -> UpdateRelease {
        let data = try JSONSerialization.data(withJSONObject: [
            "tag_name": tag, "draft": draft, "prerelease": prerelease,
            "assets": names.map { ["name": $0, "browser_download_url": "\(host)/mijomajic/typegrid/releases/download/\(tag)/\($0)"] }
        ])
        return try JSONDecoder().decode(UpdateRelease.self, from: data)
    }

    func testOnlyCompleteStableOfficialReleasesAreEligible() throws {
        XCTAssertEqual(try release().kind, "source")
        XCTAssertEqual(try release(names: ["TypeGrid-macos.zip", "typegrid-source.tar.gz", "SHA256SUMS"]).kind, "signed")
        XCTAssertNil(try release(names: ["typegrid-source.tar.gz"]).kind)
        XCTAssertNil(try release(names: ["SHA256SUMS"]).kind)
        XCTAssertNil(try release(draft: true).kind)
        XCTAssertNil(try release(prerelease: true).kind)
        XCTAssertNil(try release(tag: "v0.1.10-rc.1").kind)
        XCTAssertNil(try release(host: "https://github.com.evil.example").kind)
        XCTAssertNil(try release(host: "http://github.com").kind)
        XCTAssertNil(try release(names: ["typegrid-source.tar.gz", "SHA256SUMS", "SHA256SUMS"]).kind)
    }
}
