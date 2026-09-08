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

## Automatic updates and permissions

After this source installation, update checks run fifteen seconds after launch (subject to the six-hour check interval) and every six hours. **Check for Updates…** checks immediately; **Automatic Updates** disables or enables background updates. Updates verify the release checksum and archive paths/types, build a fresh app locally with Apple Command Line Tools, verify its bundle/version/signature, save counters, and restart. Failed downloads or builds leave the running app intact. Existing pairing, login setup, and profile visibility are preserved.

Input Monitoring is requested only when macOS reports it is missing. The agent retries access automatically after approval. If macOS explicitly requires a relaunch, rerun the installer; an already-current install skips compilation. Changed ad-hoc-signed binaries can require permission again: a source installer cannot guarantee one-time approval. Stable certificate signing is required for permission continuity. No TCC database edits, permission resets, or global Gatekeeper changes are made.

The 0.2.0 downloaded desktop app needs a one-time migration with the command above. It is replaced with a fresh local menu-bar build at the same location; the dashboard opens in your browser. Source-installed 0.2.1 and later update themselves from source.

## Pairing and recovery

```sh
~/.local/bin/typegrid pair
~/.local/bin/typegrid start
```

The installer handles pairing and startup automatically; the commands above are for manual recovery. The browser prefills the code. The browser and terminal display an expiring pairing code. Only approve a code you initiated on your own machine. The browser never receives the long-lived device token. The server stores only its SHA-256 hash. Re-pairing resets the local queue to avoid attributing a previous account’s activity to another user.

## Permissions and startup

System Settings → Privacy & Security → Input Monitoring → add **TypeGrid.app** from Applications (use Command-Shift-G in the file picker). The installer creates `/Applications/TypeGrid.app` (or `~/Applications/TypeGrid.app` if the system Applications folder is not writable). Select that app and allow access. The agent retries every five seconds. If macOS requires a relaunch, rerun the same installer command. The CLI is a symlink to the executable inside the app.

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
