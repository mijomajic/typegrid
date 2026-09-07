<div align="center">

# TypeGrid

**Every keystroke counts. Make yours count.**

A tiny native agent. Live personal stats. A little friendly competition.

[Website](https://typegrid.dev) · [Install](#install) · [Privacy](docs/PRIVACY.md) · [Contributing](CONTRIBUTING.md)

**We count. We don’t read.**

</div>

![TypeGrid interface illustration — example data](docs/preview.svg)

TypeGrid is a free, open-source stats network for developers and people who live on computers. It counts keyboard **events**, never their contents. No AI integration is required to track your activity.

## What you get

- Live keystroke counts, estimated words, active typing time, sessions and peak speed
- Hourly patterns, daily records, streaks, XP, levels and achievements
- GitHub sign-in, editable profiles, and opt-in public leaderboards
- Daily, weekly, monthly and all-time rankings (UTC calendar periods)
- A native Swift macOS menu-bar agent with pause, background startup and offline retry
- Public GitHub repository, follower and recent-event statistics
- Data export, device revocation and account deletion

**v0.1 is a public beta.** macOS is the first supported platform. AI integrations are researched and documented, but not enabled yet. No fake OAuth buttons or transcript scraping. [Integration support matrix →](docs/INTEGRATIONS.md)

## Install

macOS 13+, Apple Silicon or Intel, with [Apple Command Line Tools](https://developer.apple.com/xcode/resources/).

```sh
curl -fsSL https://typegrid.dev/install.sh | sh
```

The installer downloads the versioned source release, verifies its SHA-256 checksum, and compiles the dependency-free Swift agent locally. It opens your browser for GitHub sign-in and pairing, then starts the menu-bar agent. Building from source avoids requiring an unsigned prebuilt binary to bypass Gatekeeper. The installer creates a locally ad-hoc-signed TypeGrid.app; Developer ID signing and notarization are not included.

1. Enter the pairing code shown by your terminal on the Connect page.
2. Grant **Input Monitoring** to **TypeGrid.app** in Applications in System Settings → Privacy & Security.
3. Run `~/.local/bin/typegrid restart` after granting permission.
4. Open [your dashboard](https://typegrid.dev/dashboard) and type normally.

Inspect before installing:

```sh
curl -fsSL https://typegrid.dev/install.sh -o /tmp/typegrid-install.sh
less /tmp/typegrid-install.sh
sh /tmp/typegrid-install.sh
```

The app goes in `/Applications/TypeGrid.app` (or `~/Applications` when needed), with a CLI symlink in `~/.local/bin`. Add that directory to your PATH if necessary. See [installation, startup, troubleshooting and uninstall](docs/INSTALL.md).

## Small by design

```text
macOS key-down event
    │  callback never reads event contents
    ▼
Hourly aggregate counters ── local queue, 30-day expiry
    │  HTTPS every 5 seconds, authenticated device
    ▼
Next.js API → Postgres → live dashboard / opt-in leaderboard
```

No Electron. No key-code access. No event history. No window titles. No clipboard. No screens. No browsing history. No prompt logs. Foreground app identifiers are classified locally into **dev/general** and discarded. Classification is optional.

The server sees hourly cumulative counts refreshed every five seconds; it never receives individual keystroke timestamps. Aggregate timing can still reveal habits. [Read the complete privacy model and limits.](docs/PRIVACY.md)

## Run locally

Node 22.13+ and Postgres 15+:

```sh
git clone https://github.com/mijomajic/typegrid.git
cd typegrid
npm ci
cp .env.example .env.local
# Set DATABASE_URL, APP_URL, GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.
npm run db:migrate
npm run dev
```

Register a GitHub OAuth app with callback `http://127.0.0.1:3000/api/auth/callback`. Set `APP_URL=http://127.0.0.1:3000`. Production uses `https://typegrid.dev/api/auth/callback`.

For isolated development, `LOCAL_DEMO_AUTH=1` enables `POST /api/auth/local` with a same-origin header. This route is **disabled in production regardless of environment settings**. It is a test account, never a bypass for real accounts. Use a separate database for development.

Build and connect the native agent:

```sh
swift build --package-path agent -c release
TYPEGRID_SERVER=http://127.0.0.1:3000 agent/.build/release/typegrid pair
agent/.build/release/typegrid start
```

## How the numbers work

| Metric          | Definition                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| Keystrokes      | Key-down events, including repeats and shortcuts; modifier-only presses may not count |
| Estimated words | `floor(keystrokes / 5)`; not actual words                                             |
| Active typing   | Unique seconds containing an event, not time spent at your computer                   |
| Session         | First event after at least 60 seconds of silence; a restart begins a session          |
| Peak WPM        | Maximum `floor(events / 5)` in a fixed UTC minute, capped at 1,200                    |
| Streak          | Consecutive active UTC days; yesterday counts until today ends                        |
| XP / level      | `floor(keys / 10)` XP; `floor(sqrt(XP / 100)) + 1`                                    |
| Dev activity    | Events in a small local allowlist of editors, terminals and coding apps               |

Multiple devices add together. Overlapping active seconds are not deduplicated across machines. Secure Input and permission restrictions can make counts incomplete. Stats are self-reported and leaderboards are for fun, not verified competition or employee evaluation.

## Deploy

The public product runs on **Vercel + Neon Postgres**. No GPT Sites runtime.

```sh
vercel link
vercel env add DATABASE_URL production
vercel env add APP_URL production
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
npm run db:migrate  # use the intended production database
vercel --prod
vercel domains add typegrid.dev typegrid
```

[Deployment guide and security details →](docs/DEPLOYMENT.md)

## Verify

```sh
npm test
npm run typecheck
npm run build
swift test --package-path agent
swift build --package-path agent -c release
```

`node tests/api-check.mjs` checks pairing, replay-safe ingestion, rejection of text fields, origin validation, private/public visibility, export and revocation against a running **development** server. It creates and removes a disposable `local-test` account. Do not point it at a database with a valuable account named `local-test`.

## Contribute

Keep it small. Help with a reviewed Linux/Windows native tracker, accessibility, or metrics-only AI adapters. [Contribution guide](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [MIT license](LICENSE).
