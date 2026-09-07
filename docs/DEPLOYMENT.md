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

After tagging `v0.1.2`, create `typegrid-source.tar.gz` with `git archive --prefix=typegrid/ v0.1.2`, generate `SHA256SUMS`, and upload both to the GitHub release. The one-line installer downloads those pinned assets and compiles with Apple’s Swift compiler. Checksums detect corruption, not compromise of the repository owner’s release account. This beta does not claim notarization, hardware-wide verification, or a signed auto-update channel.
