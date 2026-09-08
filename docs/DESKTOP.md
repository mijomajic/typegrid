# Menu-bar app and browser workspace

As of 0.2.1, the primary installation is the one-line source installer. The unsigned DMG is no longer linked from the frontend. TypeGrid runs in the menu bar; dashboard, leaderboard, and pairing open in the default browser. Existing desktop authentication endpoints remain available for older clients.

See [INSTALL.md](INSTALL.md) for onboarding, update checks, and the Input Monitoring limitation.

## Release 0.2.1

1. Run `npm test`, `npm run typecheck`, `npm run build`, and `swift test --package-path agent`.
2. Run `sh scripts/package-release.sh /absolute/output/path` and publish `typegrid-source.tar.gz` and `SHA256SUMS` from the matching source revision as v0.2.1 before deploying the website's pinned installer.
3. Deploy the frontend and installer together. No new database migration is needed for this change.
4. Existing 0.2.0 users run the install command once to migrate away from the downloaded app. Later source-installed releases check, build, and restart automatically. The old 0.2.0 updater expects binary assets and cannot bootstrap the new source updater without that one-time install.

`scripts/package-macos.sh` remains a developer packaging tool, not the public installation path. Do not promote its ad-hoc-signed DMG as a notarized download.

## Update guarantees and limitations

Updates are downloaded from the fixed GitHub release repository over HTTPS with redirect and size restrictions. SHA-256 checksums detect corruption, not compromise of the release account. Archive paths and file types are validated before extraction or running build scripts. Staged app identity, version, and code-signature integrity are verified before replacement. Builds happen off the main thread while counting continues; counts are saved before restart. The existing app is restored if replacement or the launch request fails. A successful launch request does not prove that the new process remains healthy.

Pairing, counters, preferences, and visibility choices are preserved. The updater does not edit Input Monitoring permissions. Ad-hoc signing cannot guarantee permission continuity across native updates; stable certificate signing is still required for that experience.
