# Install, operate, uninstall

## Requirements

macOS 13+, Intel or Apple Silicon. Install Apple Command Line Tools if `xcrun --find swift` fails:

```sh
xcode-select --install
```

The source installer builds locally, then pairs and starts the agent:

```sh
curl -fsSL https://typegrid.dev/install.sh | sh
```

To install without pairing: `curl -fsSL https://typegrid.dev/install.sh | TYPEGRID_NO_PAIR=1 sh`.

## Updates and permissions

Use **Updates → Check for updates…** in the toolbar menu, or run `typegrid update` in Terminal. `typegrid update --check` checks without installing. The updater verifies and builds the release, preserves pairing and goals, saves counts, and relaunches. See the v0.2.3 update details below.

Source builds remain ad-hoc signed and may require renewed Input Monitoring approval. Choose **Updates → Restart TypeGrid** if macOS requests a relaunch. Stable Developer ID signing is needed for permission continuity; no permission resets or TCC modifications are performed.

## Pairing and recovery

```sh
~/.local/bin/typegrid pair
~/.local/bin/typegrid start
```

The installer handles pairing and startup automatically; the commands above are for manual recovery. The browser prefills the code. The browser and terminal display an expiring pairing code. Only approve a code you initiated on your own machine. The browser never receives the long-lived device token. The server stores only its SHA-256 hash. Re-pairing resets the local queue to avoid attributing a previous account’s activity to another user.

## Permissions and startup

System Settings → Privacy & Security → Input Monitoring → add **TypeGrid.app** from Applications (use Command-Shift-G in the file picker). The installer creates `/Applications/TypeGrid.app` (or `~/Applications/TypeGrid.app` if the system Applications folder is not writable). Select that app and allow access. The agent retries every five seconds. If macOS requires a relaunch, use **Updates → Restart TypeGrid** or `typegrid restart`. The CLI is a symlink to the executable inside the app.

`typegrid start` writes `~/Library/LaunchAgents/dev.typegrid.agent.plist`, starts the agent now, and launches at future login. The menu bar shows the dotted TypeGrid icon. Click it for today’s count, the dashboard, pause/resume, and quit. Pause lasts until restart; stop tracking persistently for the current login with `typegrid stop`. Quit is respected (no KeepAlive restart loop); it will start at the next login while the plist remains.

```sh
typegrid status
typegrid stop
typegrid restart
typegrid classify off
```

If the menu says “allow access”, allow Input Monitoring and restart. Secure Input (e.g. password prompts) can suppress counts; TypeGrid does not attempt to bypass it. Source rebuilds may require you to re-grant permission.

Offline counters remain in `~/Library/Application Support/TypeGrid/counters.json` for up to 30 days. They retry when connectivity returns. The queue stores hourly aggregates only. Up to five seconds of activity can be lost on a crash or sudden power loss. Configuration and device credential are stored in a mode-0600 file inside a mode-0700 directory. This release does not use Keychain.

## Uninstall

Disconnect coding tools in the TypeGrid menu first to remove its exporter configuration. Then, from a clone: `sh scripts/uninstall.sh`. Or manually:

```sh
launchctl bootout "gui/$(id -u)/dev.typegrid.agent"
unlink "$HOME/Library/LaunchAgents/dev.typegrid.agent.plist"
unlink "$HOME/.local/bin/typegrid"
```

Delete `~/Library/Application Support/TypeGrid` in Finder if you also want to remove local counters and credentials. Move TypeGrid.app from Applications to Trash. Remove TypeGrid’s Input Monitoring entry in System Settings. Revoke the device online in Settings. Revocation keeps previous stats; deleting your account removes the profile, counters, devices and sessions.

## Platform status

macOS 13+ source build: supported. Apple Silicon build verified during initial development. Intel source compatibility is targeted; hardware verification is still needed. Linux and Windows: not shipped. The installer fails clearly on other systems.

### Daily goals and the menu bar

Choose Easy (5,000 keystrokes / 750 clicks), Medium (10,000 / 1,500), Hard
(20,000 / 3,000), or custom daily targets on your dashboard. Today's activity
already counts. Each target fills half the progress ring; both must be reached
for 100%. Goals reset at midnight UTC and are private even on a public profile.

The menu contains Open TypeGrid, Leaderboard, My profile, a divider, Keystrokes,
Clicks, Goals, and Quit TypeGrid. Before setup, Goals reads Configure goals and
opens the dashboard's goal editor. Keystrokes and Clicks toggle their menu-bar
displays; Goals offers a progress visibility toggle and Edit daily goals. These
preferences survive restarts and do not pause counting. If every display is
hidden, a TypeGrid icon keeps the menu accessible. Turn off goals from Edit goals
on the dashboard. Automatic updates continue using your existing preference.

## Updates (v0.2.3 and later)

Click or right-click TypeGrid in the menu bar and choose **Updates → Check for updates…**, then **Update and restart**. Or run:

```sh
typegrid update          # install the newest stable release and relaunch
typegrid update --check  # check without changing anything
```

If `~/.local/bin` is not on your PATH, use `~/.local/bin/typegrid update`.

**Automatically check for updates** is on by default and checks GitHub's public release metadata at most once per day, while TypeGrid runs. Turn it off in the same menu. Background checks do not show dialogs. They change the menu item when a new release is ready. No pairing credential, counts, or activity information are sent to GitHub.

**Install signed updates automatically** is off by default. When enabled, TypeGrid installs only Developer ID signed, notarized releases. Source releases still require a manual update. Turning off automatic checks also turns off automatic installation.

The updater verifies the selected archive's checksum, prepares it before stopping tracking, preserves the installed app location and CLI link, saves counters on orderly shutdown, and restarts automatically. Pairing, profile visibility, coding integrations, and queued totals are retained. If replacement or relaunch fails, it attempts to restore the previous app. Menu updates write build/error output to `~/Library/Application Support/TypeGrid/update.log`; no activity or credentials are logged. An interrupted update can be retried; stale updater locks are reclaimed.

### Input Monitoring and code signing

Current source builds use an ad-hoc signature. A rebuild can change the identity macOS associates with Input Monitoring, so macOS may still require consent again. TypeGrid does not reset TCC, change the permission database, weaken signature requirements, or bypass macOS consent.

To retain permissions across production updates, releases need a stable **Developer ID Application** signing identity. The signed release packager is ready, but signed distribution requires an Apple Developer Program membership and notarization setup. Until those releases are published, manual updates and automatic checks work; unattended source installation is deliberately unavailable. Moving from an old ad-hoc build to the first signed build may require one last permission approval. Subsequent same-team signed releases are designed to preserve that identity, subject to macOS policy.

Existing v0.2.0 and earlier installations do not contain the updater. They must use the original installer once to receive v0.2.3; subsequent updates use the menu or `typegrid update`. If a stale old permission entry blocks counting during that migration, remove the old TypeGrid entry and add the installed app again once.

v0.2.1 and v0.2.2 can receive this release through their existing source updater. The legacy staging contract is preserved for that transition. Explicit automatic-update choices carry forward: a disabled preference stays disabled; an enabled preference enables checks and future signed automatic installation. Source installation remains manual after this release. Daily goals and menu visibility choices are unchanged.
