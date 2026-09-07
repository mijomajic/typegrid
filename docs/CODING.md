# Coding activity

TypeGrid 0.1.5 collects coding metrics inside the background Mac app. **No tracker terminal is required.**

1. Install or upgrade TypeGrid, then pair your Mac.
2. Open Integrations on typegrid.dev and click **Connect**, or use Connect Codex / Connect Claude Code / Connect Cursor in the TypeGrid menu.
3. Confirm the local setup and restart the coding tool once. Use it normally after that.

The setup configures a metrics-only exporter in your user-level `~/.codex/config.toml` or `~/.claude/settings.json`. Existing unrelated settings are preserved. A conflicting telemetry configuration is left untouched with an error instead of being silently replaced. Provider sign-in remains inside the coding tool; TypeGrid never requests its credentials.

The collector runs with TypeGrid at login. Closing Terminal does not stop it. Quitting TypeGrid stops collection until it is reopened. Disconnect through the TypeGrid menu, then restart the coding tool once. Previously synced stats are retained.

Command-line setup is also available, and returns immediately:

```sh
~/.local/bin/typegrid connect codex
~/.local/bin/typegrid connect claude
~/.local/bin/typegrid connect cursor
# Undo only TypeGrid-owned settings:
~/.local/bin/typegrid disconnect codex
~/.local/bin/typegrid disconnect claude
~/.local/bin/typegrid disconnect cursor
```

Codex desktop and CLI use the global Codex configuration; clients that override exporters or use a different configuration directory may not report. Existing desktop processes need a restart. A fresh model-completion export from the desktop app has not yet been verified on the development Mac; the local receiver and configuration are verified independently. Claude Code connects sessions that read its user settings. No historical transcript import is performed.

## What counts

- Claude Code: `claude_code.token.usage` (all token categories, including cache) and `claude_code.active_time.total` (seconds).
- Codex: `codex.turn.token_usage`, **only `token_type=total`**, and `codex.turn.e2e_duration_ms`, converted to seconds.
- Claude's active time and Codex's full turn duration have different meanings. They are labeled separately and are not ranked as hours worked.
- AI tokens have a separate daily/weekly/monthly/all-time leaderboard. Keystroke XP is unchanged. Token totals are self-reported and for fun, not a verified performance ranking.
- Billing, subscription limits, and cost estimates are not included.

## Privacy and operation

The Mac agent starts receivers bound to **127.0.0.1 on ports 43189 (Codex) and 43190 (Claude)**, protected by a per-install random authorization value. Only `/v1/metrics` with JSON and a bounded Content-Length is accepted. TypeGrid configures logs and traces off. Unknown metric names, identities, resources, prompts, paths, tool details, and attributes are discarded. Only Codex's fixed `token_type` category is interpreted.

Cumulative metric checkpoints survive TypeGrid restarts. Only cumulative metrics are supported; delta temporality is ignored to avoid counting replays twice. Cumulative snapshots are reduced to increases and grouped by UTC hour of receipt. Cached tokens are included; totals are not equivalent to fresh generated tokens. Late exports are attributed to the hour received. Provider versions with different names/temporality may show no stats.

Local queue files contain only a TypeGrid device ID, provider, hour, token count, and work seconds. They are mode 0600 and bound to the pairing that created them. Queues retain at most 30 days of hourly data. Uploads retry idempotently; the server uses maximum counters per random local stream. No transcript file is opened. AI totals are private unless the profile is public. Account deletion cascades to AI counters; export includes them.

Validated: native parser fixtures, repeated/out-of-order payloads, both CLI launchers, Codex configuration initialization, background receiver HTTP checks, HTTP API privacy/revocation/public ranking. A real model-completion export has not yet been verified on this Mac; no synthetic usage is added to your profile.

## Cursor

Cursor connects through an additive `sessionEnd` entry in `~/.cursor/hooks.json`. Existing hooks are preserved. Only elapsed session duration is counted when the session ends, including idle time. A device-scoped hash of the session identifier prevents repeat delivery from counting twice; the raw identifier is not stored. No prompts, responses, paths, or error messages are retained. Personal token totals are not exposed by this hook. TypeGrid does not scrape accounts or invent a personal OAuth flow.

## Sources

- [Claude Code metrics](https://code.claude.com/docs/en/monitoring-usage)
- [Codex metrics and exporter configuration](https://developers.openai.com/codex/config-advanced/)
- [Codex metric names](https://github.com/openai/codex/blob/main/codex-rs/otel/src/metrics/names.rs)
- [Cursor hooks](https://cursor.com/docs/hooks)
- [Cursor Admin API](https://cursor.com/docs/account/teams/admin-api)
