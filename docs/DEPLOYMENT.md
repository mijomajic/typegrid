# Deployment

Next.js App Router on Vercel’s Node runtime; Neon Postgres in Frankfurt. Four production environment values are sufficient: `DATABASE_URL`, `APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (plus any provider-injected pooled URL). No secrets use a `NEXT_PUBLIC_` prefix.

1. Create a dedicated Postgres database. Use a separate database for local and preview development.
2. Set `DATABASE_URL` locally and run `npm run db:migrate`. Schema changes run as a transaction and do not run on ordinary requests.
3. Register a GitHub OAuth app. Use exact redirect URIs: `https://typegrid.dev/api/auth/callback` and optionally a dedicated local callback. Never enable wildcard redirects.
4. Add the four required variables to Vercel, set `APP_URL=https://typegrid.dev`, deploy with `vercel --prod`, and attach the domain.
5. Verify `/api/health`, real OAuth, device pairing, ingestion, profile privacy and revocation. Health reports process availability; it is not a database connectivity probe.

The root has no Sites metadata or Cloudflare runtime. The repository is compatible with ordinary Next.js hosting. Postgres is accessed through parameterized SQL and a small connection pool; use Neon’s pooled connection URL in serverless environments.

## Operational boundaries

- The beta uses five-second dashboard polling and agent heartbeat sync. Polling pauses in hidden browser tabs. Usage grows with active nodes; monitor Vercel function usage and Neon quotas before promoting widely.
- GitHub public API requests use bounded timeouts and no token retention. Public unauthenticated GitHub rate limits apply.
- Request logging deliberately excludes request bodies, tokens and raw exception messages. Platform request URLs may appear in provider logs; configure provider retention/access for OAuth callback routes.
- The ingest endpoint rejects extra fields and checks cumulative bounds. Leaderboard scores are unverified self-reports, not anti-cheat guarantees.
- Device revocation preserves historical stats. Account deletion removes live rows via foreign-key cascades.
- Export is authenticated and excludes session/device secrets and their hashes.
- `LOCAL_DEMO_AUTH` has no effect with `NODE_ENV=production`. Do not enable it on a publicly accessible development server.

## Release source installer

From the reviewed v0.1.6 checkout, run `sh scripts/package-release.sh /tmp/typegrid-v0.1.6-release`, tag that same source as `v0.1.6`, and upload both generated assets to the GitHub release. The packager includes only explicitly allowed source directories. The one-line installer downloads those pinned assets and compiles with Apple’s Swift compiler. Checksums detect corruption, not compromise of the repository owner’s release account. This beta does not claim notarization, hardware-wide verification, or a signed auto-update channel.

For v0.1.6, apply the additive database migration before deploying the web app.
Publish the source release before deploying its pinned installer. Older agents
continue syncing normally; rerun the install command to enable connection status.
Connected means the paired agent reports the tool configured and its local receiver
running; it does not prove the tool has exported usage yet.

## v0.1.7 onboarding
Apply the migration before deploying. Existing profile visibility is preserved.
New profiles default public and must confirm visibility before pairing approval.
The agent reports only whether Input Monitoring is available alongside its existing
aggregate heartbeat. Publish the v0.1.7 source assets before deploying the installer.

## v0.1.8 click counting

1. Run `npm run db:migrate` to add the bounded, default-zero `buckets.clicks` column. Existing profiles and their visibility are untouched.
2. Deploy the updated API and website with the installer still pinned to v0.1.7 if v0.1.8 source assets are not yet published.
3. Publish the v0.1.8 source archive and checksum, then deploy the v0.1.8 installer. Existing users rerun the install command to update.

Old clients can keep sending keyboard-only payloads. Cumulative click totals use monotonic upserts, so retries or older clients cannot erase them. Saved native buckets without clicks decode as zero.

## v0.2.0 desktop workspace

See [DESKTOP.md](DESKTOP.md) for the coordinated native/API rollout. Apply the additive `desktop_logins` migration, publish the universal Mac app and checksum assets, and deploy the `/app` workspace plus desktop authentication endpoints.

## v0.2.1 source installation

The public entry point is the source installer again, with the workspace in the browser and automatic source updates in the menu-bar agent. Publish v0.2.1 source assets before deploying the pinned installer. Existing 0.2.0 desktop installations migrate by running that installer once. See [DESKTOP.md](DESKTOP.md). No schema migration is introduced.

## v0.2.2 daily goals

Apply the additive `users.daily_goals` migration before deployment. It defaults to
null and does not change profile visibility or existing counts. Browser goal
updates require the signed-in user's session and matching Origin. `/api/me` and
export include the owner's goals; public profiles and leaderboards do not.

New agents request `goalSync` on the existing authenticated ingest heartbeat.
The response contains the paired owner's targets and today's aggregate counts
from other devices. The agent adds its live local counts, caches goals per pairing,
and discards other-device totals at midnight UTC. Old clients remain compatible.
During a rollout or rollback, a new agent retries without `goalSync` if an older
server rejects the optional field, so counting and uploads continue. Publish the
v0.2.2 source archive and checksum before promoting the website and installer.
The existing automatic updater downloads and locally compiles this release.

## v0.2.3 built-in updater

Run all repository checks, then `sh scripts/package-release.sh /tmp/typegrid-v0.2.3-release`. Publish the reviewed source as tag `v0.2.3` with **all three** generated assets: `typegrid-source.tar.gz`, `typegrid-update.sh`, and `SHA256SUMS`. Only then deploy the website with its v0.2.3 installer. The bootstrap pins the version and verifies the update helper; the helper verifies the selected archive. Do not mark a release latest until all assets are uploaded. The archive uses a source allowlist and includes `agent/VERSION`.

The application checks the public GitHub `/releases/latest` API. Only a newer stable `vMAJOR.MINOR.PATCH` release with the expected assets under this repository is eligible. Drafts, prereleases, missing checksums, arbitrary download hosts, and downgrades are rejected. Keep version values in `agent/VERSION`, `ReleaseVersion.swift`, `public/install.sh`, `package.json`, and the lockfile aligned; the test suite verifies this. Increment `agent/BUILD` for each release so the macOS bundle build number also increases.

v0.2.0 and older need one final bootstrap install because they have no update command. Newer clients use the menu or `typegrid update`. Existing pairing, aggregates, privacy choices, and integrations stay in place. This change adds no database migration; apply any other pending feature migrations before releasing the combined checkout.

### Signed production releases

An Apple Development certificate is not a Developer ID distribution certificate. Enroll in the Apple Developer Program, create a **Developer ID Application** identity, and configure a `notarytool` Keychain profile. Keep credentials in Keychain or protected CI secrets, never in this repository.

```sh
TYPEGRID_SIGN_ID='Developer ID Application: Your Organization (TEAMID)' \
TYPEGRID_NOTARY_PROFILE='typegrid-notary' \
sh scripts/package-signed-release.sh /tmp/typegrid-signed-release
```

This builds a universal arm64/x86_64 app, signs with Hardened Runtime, submits it to Apple, staples and verifies notarization, and adds `TypeGrid-macos.zip` to the checksum manifest. Upload the ZIP along with the three source assets. Set `RELEASE_KIND=signed` in `public/install.sh` for that published version so first installations use the notarized app without requiring Swift or Command Line Tools. Existing updaters prefer the signed ZIP automatically.

The updater verifies Developer ID signing, the bundle identifier, Gatekeeper acceptance, the expected version, and (when already signed) the installed app's team before executing the new app or its helper. Never re-sign a downloaded signed app locally. Use the same bundle ID, app location, and developer team for future releases. A transition from ad-hoc signing may require one final consent; test the full permission-retention flow on macOS 13+ with two real signed versions before claiming hardware-wide verification.

The first signed release must have a newer version than the last source release so existing clients receive the migration. The automatic-install preference is opt-in and only applies to signed releases. Source updates remain manual while there is no Developer ID distribution identity. Checksums protect against corruption, not a compromised release account; signed updates additionally enforce Apple's trust and installed team continuity.

The v0.2.1/v0.2.2 `TYPEGRID_STAGE_APP` contract remains supported so existing automatic updaters can install v0.2.3. The release preserves the deployed daily-goals and streak UI; no schema change is required.
