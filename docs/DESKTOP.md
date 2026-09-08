# TypeGrid desktop app

TypeGrid 0.2.0 opens a regular Mac window for the workspace, with stats, leaderboard, integrations, profile, and settings. AppKit and WebKit are supplied by macOS; no Electron, embedded server, or third-party native dependency is added. The workspace still needs a network connection. The menu-bar agent keeps counting offline and when the window is closed. Quit stops tracking.

## Sign-in and pairing

GitHub authentication uses the system authentication browser once, then returns to the app. A random verifier stays in memory in the initiating app. The server stores only its SHA-256 challenge with a ten-minute request, attaches an account only after successful GitHub OAuth, and atomically deletes that request when the correct proof is exchanged. The resulting HTTP-only session is placed in the app's own WebKit cookie store. An agent token cannot create an account session. Closing or abandoning sign-in expires the request.

The native Connect screen lets a user choose profile visibility and pair this Mac without a Terminal command. No tracking starts on a new unpaired installation. Existing pairings, counters, and visibility choices are preserved. External links open in the browser; stats and workspace navigation stay in TypeGrid. Exports use a native save dialog.

## Automatic updates

Automatic updates default on and can be disabled in the menu-bar menu. TypeGrid checks the official repository's latest stable GitHub release at most once every six hours, starting fifteen seconds after launch. Manual **Check for Updates…** bypasses that interval.

Updates download the universal Mac app archive and its checksum from the fixed `mijomajic/typegrid` release. Downloads enforce HTTPS, a restricted GitHub redirect list, and size limits. Stable semantic versions are compared numerically; older, equal, prerelease, or malformed releases are not installed. The updater verifies SHA-256, rejects archive traversal and link entries, checks the app bundle ID and version, verifies its code signature's integrity, and checks that its executable reports the expected version. It then stages the app beside the current bundle.

Automatic installation waits for the workspace window to close. Counts are saved before the old app exits. A separate helper waits for exit, replaces only the application bundle, and restores the old app if replacement or relaunch fails. Pairing, counters, preferences, and coding queues are outside the bundle and are not removed. Updates need write access to the app's containing folder. Network or validation failures leave the installed version intact; a manual check shows the error and automatic checks retry later.

The current packaging is locally ad-hoc signed, not Developer ID signed or notarized. The checksum is served by the same trusted GitHub release account as the app, not by an independent signing authority. macOS may require manual first-open approval or Input Monitoring reapproval. Developer ID signing and notarization are needed for a frictionless public download and permission continuity; this implementation does not bypass macOS security controls.

## Build and rollout

1. Run `npm test`, `npm run typecheck`, `npm run build`, and `swift test --package-path agent`.
2. On a Mac, run `sh scripts/package-macos.sh /absolute/output/path`. It builds a universal Apple Silicon / Intel app, `TypeGrid.dmg`, `TypeGrid-universal.tar.gz`, and their checksum files. The staging build never installs over the running app or touches login items.
3. Run `sh scripts/package-release.sh /absolute/output/path` for the source archive and `SHA256SUMS`.
4. Apply the database migration for `desktop_logins` before deploying the new API. Existing web and device sessions remain valid.
5. Publish all v0.2.0 assets before enabling the pinned download/installer links on the website. Ship the web and native changes together; the new desktop sign-in endpoints must be available before users open the new app.
6. Existing users install this version once. Later stable releases use the automatic updater, with the same universal archive/checksum asset names.

Public marketing and privacy pages stay at `/` and `/privacy`. The application lives under `/app`. Existing `/dashboard`, `/leaderboard`, `/settings`, and other workspace URLs redirect to their `/app/...` equivalents. Public shareable profiles stay at `/u/:username`. The marketing page never fetches account data; all personal APIs still enforce server-side authorization.

For a disposable local database, `tests/desktop-api-check.mjs` verifies PKCE proof binding, expiration, origin checks, and single-use redemption without contacting GitHub. The provider authorization step is simulated in that test; a real GitHub OAuth and macOS authentication-session check is still part of release acceptance.
