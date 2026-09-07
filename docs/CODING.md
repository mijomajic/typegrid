# Coding activity

TypeGrid 0.1.3 adds a local connection for **Claude Code and Codex CLI**. Sign in inside the coding tool as usual, including with a supported subscription. TypeGrid never requests or stores that provider's credentials.

After installing/upgrading TypeGrid and pairing your Mac, launch a new session with:

```sh
~/.local/bin/typegrid track claude
# or
~/.local/bin/typegrid track codex
```

Arguments are passed to the tool. Existing sessions, IDE extensions, and Codex desktop sessions are not retroactively connected. The TypeGrid background agent must be running to upload aggregates. Close the tracked session and launch the tool normally to disconnect. No provider config files are modified.

## What counts

- Claude Code: `claude_code.token.usage` (all token categories, including cache) and `claude_code.active_time.total` (seconds).
- Codex: `codex.turn.token_usage`, **only `token_type=total`**, and `codex.turn.e2e_duration_ms`, converted to seconds.
- Claude's active time and Codex's full turn duration have different meanings. They are labeled separately and are not ranked as hours worked.
- AI tokens have a separate daily/weekly/monthly/all-time leaderboard. Keystroke XP is unchanged. Token totals are self-reported and for fun, not a verified performance ranking.
- Billing, subscription limits, and cost estimates are not included.

## Privacy and operation

The launcher starts a temporary receiver bound to **127.0.0.1 on a random port**, protected by a per-launch random authorization value. Only `/v1/metrics` with JSON and a bounded Content-Length is accepted. Logs and traces are disabled in the launcher. Unknown metric names, identities, resources, prompts, paths, tool details, and attributes are discarded. Only Codex's fixed `token_type` category is interpreted.

Only cumulative metrics are supported; delta temporality is ignored to avoid counting replays twice. Cumulative snapshots are reduced to increases and grouped by UTC hour of receipt. Cached tokens are included; totals are not equivalent to fresh generated tokens. Late exports are attributed to the hour received. Provider versions with different names/temporality may show no stats.

Local queue files contain only a TypeGrid device ID, provider, hour, token count, and work seconds. They are mode 0600 and bound to the pairing that created them. Queues retain at most 30 days of hourly data. Uploads retry idempotently; the server uses maximum counters per random local stream. No transcript file is opened. AI totals are private unless the profile is public. Account deletion cascades to AI counters; export includes them.

Validated: native parser fixtures, repeated/out-of-order payloads, both CLI launchers, Codex configuration initialization, HTTP API privacy/revocation/public ranking. A real model-completion export has not yet been verified on this Mac; no synthetic usage is added to your profile.

## Other providers

Gemini CLI has official telemetry but its adapter is not shipped yet. Cursor's documented usage API requires team admin access; TypeGrid does not use private account scraping or a fake personal OAuth flow.

## Sources

- [Claude Code metrics](https://code.claude.com/docs/en/monitoring-usage)
- [Codex metrics and exporter configuration](https://developers.openai.com/codex/config-advanced/)
- [Codex metric names](https://github.com/openai/codex/blob/main/codex-rs/otel/src/metrics/names.rs)
- [Gemini CLI telemetry](https://geminicli.com/docs/cli/telemetry/)
- [Cursor Admin API](https://cursor.com/docs/account/teams/admin-api)
