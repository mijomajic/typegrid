# Integration support — researched September 7, 2026

Core keystroke tracking works without any of these integrations.

| Tool        | Legitimate support                                                                                 | TypeGrid v0.1.5                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GitHub      | OAuth authorization code + PKCE; public user REST API and public events                            | Sign-in plus public repository/follower counts and up to 100 recent public events; no retained OAuth token |
| Claude Code | Opt-in OpenTelemetry metrics include token usage and cost; logs can include sensitive event fields | Background Mac receiver collects tokens and active time; see CODING.md                                                                            |
| Codex       | Official configurable OpenTelemetry support, with version-dependent exporters and metric fields    | Background Mac receiver collects tokens and active time; see CODING.md; no account OAuth or transcript parsing                                    |
| Cursor | Official local sessionEnd hooks; team APIs separately offer usage metrics | Background session duration through a local hook; no personal token totals |

GitHub’s public events endpoint is an activity window, not a complete contribution graph, commit count, or annual total. We label it **recent public events**. APIs may be rate-limited; refreshing is limited to once every five minutes per account. No private repository scope is requested. The connected integration is optional even after GitHub sign-in.

## Primary sources

- [GitHub OAuth and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub REST public user data](https://docs.github.com/en/rest/users/users#get-a-user)
- [GitHub public events](https://docs.github.com/en/rest/activity/events#list-public-events-for-a-user)
- [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Codex advanced configuration](https://developers.openai.com/codex/config-advanced/)
- [Codex official metrics source](https://github.com/openai/codex/blob/main/codex-rs/otel/src/metrics/names.rs)
- [Cursor Admin API](https://cursor.com/docs/account/teams/admin-api)

See [coding activity setup and limitations](CODING.md).

## Adapter rules

1. Explicit opt-in; never scan account cookies, private browser storage, or conversation files.
2. A local receiver must accept only an allowlist of numeric metric names and safe categories. Drop all unrecognized attributes before persistence or network transmission.
3. Do not accept raw OTel logs or traces. They can contain prompts, tool arguments, paths and URLs even when a UI calls them “telemetry”.
4. Preserve original units and temporality; cumulative counters must not be repeatedly added as deltas.
5. Costs are reported values or clearly labeled estimates, never invented from token counts without a verified price/version.
6. Provider/version fixtures and privacy rejection tests must pass before a Connect button becomes available.

- [Cursor session hooks](https://cursor.com/docs/hooks)
