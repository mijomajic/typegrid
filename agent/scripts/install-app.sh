#!/bin/sh
set -eu
TYPEGRID_AGENT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -n "${TYPEGRID_STAGE_APP:-}" ]; then
  TYPEGRID_APP="$TYPEGRID_STAGE_APP"
elif [ -w /Applications ]; then
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
# Always assemble a fresh local bundle. Do not inherit quarantine or stale resources
# from an older downloaded app, and leave the installed app intact if the build fails.
TYPEGRID_DESTINATION="$TYPEGRID_APP"
mkdir -p "$(dirname -- "$TYPEGRID_DESTINATION")"
TYPEGRID_BUILD_DIR=$(mktemp -d "$(dirname -- "$TYPEGRID_DESTINATION")/.typegrid-build.XXXXXX")
trap 'rm -rf "$TYPEGRID_BUILD_DIR"' EXIT HUP INT TERM
TYPEGRID_APP="$TYPEGRID_BUILD_DIR/TypeGrid.app"
swift build --package-path "$TYPEGRID_AGENT_DIR" -c release
mkdir -p "$TYPEGRID_APP/Contents/MacOS" "$TYPEGRID_APP/Contents/Resources"
if [ -z "${TYPEGRID_STAGE_APP:-}" ]; then mkdir -p "$HOME/.local/bin"; fi
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
<key>CFBundleShortVersionString</key><string>0.2.1</string>
<key>CFBundleVersion</key><string>21</string>
<key>CFBundleIconFile</key><string>TypeGrid</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>dev.typegrid.connect</string><key>CFBundleURLSchemes</key><array><string>typegrid</string></array></dict></array>
</dict></plist>
PLIST
TYPEGRID_ICON_TMP="$TYPEGRID_BUILD_DIR"
swiftc -parse-as-library "$TYPEGRID_AGENT_DIR/Sources/TypeGrid/BrandMark.swift" "$TYPEGRID_AGENT_DIR/scripts/make-icon.swift" -o "$TYPEGRID_ICON_TMP/make-icon"
"$TYPEGRID_ICON_TMP/make-icon" "$TYPEGRID_ICON_TMP/TypeGrid.iconset"
iconutil -c icns "$TYPEGRID_ICON_TMP/TypeGrid.iconset" -o "$TYPEGRID_APP/Contents/Resources/TypeGrid.icns"
install -m 755 "$TYPEGRID_AGENT_DIR/scripts/apply-update.sh" "$TYPEGRID_APP/Contents/Resources/apply-update.sh"
# Local ad-hoc signing is not Developer ID signing or notarization.
codesign --force --deep --sign - --identifier dev.typegrid.agent "$TYPEGRID_APP"
codesign --verify --deep --strict "$TYPEGRID_APP"
TYPEGRID_BACKUP="$TYPEGRID_DESTINATION.previous-install"
[ ! -e "$TYPEGRID_BACKUP" ] || { echo 'A previous install backup needs attention; leaving the app unchanged.' >&2; exit 1; }
if [ -z "${TYPEGRID_STAGE_APP:-}" ]; then
  launchctl bootout "gui/$(id -u)/dev.typegrid.agent" >/dev/null 2>&1 || true
fi
if [ -e "$TYPEGRID_DESTINATION" ]; then mv "$TYPEGRID_DESTINATION" "$TYPEGRID_BACKUP"; fi
if ! mv "$TYPEGRID_APP" "$TYPEGRID_DESTINATION"; then
  if [ -e "$TYPEGRID_BACKUP" ]; then mv "$TYPEGRID_BACKUP" "$TYPEGRID_DESTINATION"; fi
  exit 1
fi
rm -rf "$TYPEGRID_BACKUP"
TYPEGRID_APP="$TYPEGRID_DESTINATION"
if [ -n "${TYPEGRID_STAGE_APP:-}" ]; then
  printf "Prepared TypeGrid.app.\n"
  exit 0
fi
if [ -f "$TYPEGRID_BIN" ] || [ -L "$TYPEGRID_BIN" ]; then unlink "$TYPEGRID_BIN"; fi
ln -s "$TYPEGRID_APP/Contents/MacOS/TypeGrid" "$TYPEGRID_BIN"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister "$TYPEGRID_APP"
printf '\nInstalled %s\nCLI: %s\n' "$TYPEGRID_APP" "$TYPEGRID_BIN"
printf 'In Input Monitoring, add TypeGrid.app from Applications.\n'
