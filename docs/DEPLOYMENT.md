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
