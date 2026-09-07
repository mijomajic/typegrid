#!/bin/sh
set -eu
TYPEGRID_AGENT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -w /Applications ]; then
  TYPEGRID_APP=/Applications/TypeGrid.app
else
  TYPEGRID_APP="$HOME/Applications/TypeGrid.app"
fi
TYPEGRID_BIN="$HOME/.local/bin/typegrid"
if [ -d "$TYPEGRID_APP" ]; then
  TYPEGRID_EXISTING_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TYPEGRID_APP/Contents/Info.plist" 2>/dev/null || true)
  if [ "$TYPEGRID_EXISTING_ID" != dev.typegrid.agent ]; then
    printf 'Refusing to overwrite an unrelated app at %s\n' "$TYPEGRID_APP" >&2
    exit 1
  fi
fi
launchctl bootout "gui/$(id -u)/dev.typegrid.agent" >/dev/null 2>&1 || true
swift build --package-path "$TYPEGRID_AGENT_DIR" -c release
mkdir -p "$TYPEGRID_APP/Contents/MacOS" "$TYPEGRID_APP/Contents/Resources" "$HOME/.local/bin"
install -m 755 "$TYPEGRID_AGENT_DIR/.build/release/typegrid" "$TYPEGRID_APP/Contents/MacOS/TypeGrid"
cat > "$TYPEGRID_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>dev.typegrid.agent</string>
<key>CFBundleName</key><string>TypeGrid</string>
<key>CFBundleDisplayName</key><string>TypeGrid</string>
<key>CFBundleExecutable</key><string>TypeGrid</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.2</string>
<key>CFBundleVersion</key><string>3</string>
<key>CFBundleIconFile</key><string>TypeGrid</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
TYPEGRID_ICON_TMP=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_ICON_TMP"' EXIT HUP INT TERM
swift "$TYPEGRID_AGENT_DIR/scripts/make-icon.swift" "$TYPEGRID_ICON_TMP/TypeGrid.iconset"
iconutil -c icns "$TYPEGRID_ICON_TMP/TypeGrid.iconset" -o "$TYPEGRID_APP/Contents/Resources/TypeGrid.icns"
# Local ad-hoc signing is not Developer ID signing or notarization.
codesign --force --deep --sign - --identifier dev.typegrid.agent "$TYPEGRID_APP"
if [ -f "$TYPEGRID_BIN" ] || [ -L "$TYPEGRID_BIN" ]; then unlink "$TYPEGRID_BIN"; fi
ln -s "$TYPEGRID_APP/Contents/MacOS/TypeGrid" "$TYPEGRID_BIN"
printf '\nInstalled %s\nCLI: %s\n' "$TYPEGRID_APP" "$TYPEGRID_BIN"
printf 'In Input Monitoring, add TypeGrid.app from Applications.\n'
