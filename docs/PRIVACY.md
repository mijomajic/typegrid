# We count. We don’t read.

## The boundary

`agent/Sources/TypeGrid/App.swift` installs a listen-only CGEvent tap for keyboard, mouse-button, movement, drag, and scroll notifications. Its event parameter is deliberately unnamed. It cannot enter the counter API: `Counter.record(at:isDev:)` accepts only the current clock and a local category boolean. `Counter.recordClick(at:)` accepts only the current clock and increments a combined click total. No click coordinates or button identities are stored. Movement, dragging, clicks, and scrolling reset a separate three-second active mouse timer. Only accumulated active mouse seconds are persisted and synced; its event timing state stays in memory. No event coordinates are read. Button releases are excluded, and movement/scrolling never increment clicks. Clicks never change typing metrics. There are no calls to read Unicode strings, key codes, event flags, the clipboard, window titles, browser URLs or paths.

The operating system grants the process broad Input Monitoring permission. Our promise is enforced by the code path, not by pretending that permission is narrower than it is. Review the source before granting it. macOS Secure Input is respected.

## Persistent and transmitted data

Only this allowlisted shape is accepted by ingestion:

```json
{
  "buckets": [
    {
      "hour": "2026-09-07T10:00:00Z",
      "keystrokes": 140,
      "clicks": 35,
      "mouseActiveSeconds": 12.5,
      "activeSeconds": 30,
      "sessions": 1,
      "devKeystrokes": 90,
      "peakWpm": 28
    }
  ]
}
```

The request carries a random device credential in an Authorization header. No machine hostname, operating-system username or serial number is sent. Device names start as “Mac”. Unknown keys, strings in numeric fields, out-of-range values, and non-hour timestamps are rejected. Replayed or out-of-order snapshots cannot double-count because each `(device, hour)` stores monotonically increasing cumulative counters.

The agent keeps hourly counts for 30 days, including already-synced buckets to preserve cumulative state after restart. Last-active second and current-minute counters exist only in memory. They cannot reconstruct typed content.

## App categories

The foreground app’s bundle identifier is checked locally when the app changes and on each sync tick. Only allowlist membership (dev/general) affects counters. Identifiers are not logged, persisted, or sent. `typegrid classify off` disables this feature. Terminals count as dev apps even when used for non-development work; this is an approximation.

## Identity and exposure

GitHub OAuth requests `read:user`. We store GitHub’s stable numeric ID, login and avatar along with your editable TypeGrid profile. The access token is discarded after identifying you. Public GitHub API stats are fetched only when you connect/refresh the integration.

New profiles are public by default. Choose private during onboarding or in Settings. Existing users’ privacy choices are preserved. Public mode exposes username, GitHub-hosted avatar, bio, daily counts, derived achievements, levels and streaks. Detailed hourly patterns, sessions, device credentials and integration responses stay private. Avatar URLs are restricted to GitHub’s avatar host to prevent arbitrary tracking pixels.

Sessions use random, hashed, revocable tokens, HttpOnly cookies, SameSite=Lax, Secure in production, and 30-day expiry. Mutation endpoints check Origin; device endpoints use independent bearer credentials and rate limits. There is no client-side authorization shortcut.

## Limits, hosting, retention

Aggregate timing is still personal data. The server receives frequent updates and may infer when you are active. HTTPS hides content in transit from observers; it does not hide your IP address from the host. Vercel and Neon process operational data under their policies. There is no advertising or third-party analytics script. Rate limiting stores a one-way hash of the request IP with a short expiry; expired entries are periodically removed.

Server aggregates remain until account deletion. Revoking a device stops new uploads but preserves historical stats. Account deletion cascades through sessions, devices, pairings and counters in the active database. Hosting backups may retain data under provider retention policies; we do not claim immediate erasure from every backup. Local uninstall preserves local data unless you delete its folder explicitly.

No tracker can guarantee mathematically exact counts across hardware, permissions, Secure Input and crashes. TypeGrid is a personal stats toy, not a monitoring or forensic product. No event sequence is available for reconstruction, and TypeGrid never attempts reconstruction.

## Optional coding activity

When you connect Claude Code or Codex to TypeGrid, a local metrics-only receiver reduces documented counters to hourly token totals and work seconds. Provider credentials remain with the coding tool. No prompts or transcripts are stored or uploaded. Public profiles include AI totals. See [coding activity](CODING.md) for exact metric meanings and limitations.

Your profile history includes all synced daily keystroke and AI token totals.
Only the signed-in owner can access hourly activity, active typing time, sessions,
peak speed and AI time details. The public-appearance preview uses the public
response shape even for the owner. A private profile remains inaccessible to others.
