#!/bin/sh
set -eu
TYPEGRID_AGENT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TYPEGRID_APP=${1:?Usage: build-app.sh /absolute/staging/TypeGrid.app}
case "$TYPEGRID_APP" in /*/TypeGrid.app) ;; *) echo 'Use an absolute staging app path.' >&2; exit 1 ;; esac
test ! -e "$TYPEGRID_APP" || { echo 'The staging app already exists.' >&2; exit 1; }
TYPEGRID_VERSION=$(cat "$TYPEGRID_AGENT_DIR/VERSION")
TYPEGRID_BUILD_NUMBER=$(cat "$TYPEGRID_AGENT_DIR/BUILD")
if [ "${TYPEGRID_UNIVERSAL:-0}" = 1 ]; then
  swift build --package-path "$TYPEGRID_AGENT_DIR" -c release --arch arm64 --arch x86_64
  TYPEGRID_BUILD=$(swift build --package-path "$TYPEGRID_AGENT_DIR" -c release --arch arm64 --arch x86_64 --show-bin-path)
else
  swift build --package-path "$TYPEGRID_AGENT_DIR" -c release
  TYPEGRID_BUILD=$(swift build --package-path "$TYPEGRID_AGENT_DIR" -c release --show-bin-path)
fi
mkdir -p "$TYPEGRID_APP/Contents/MacOS" "$TYPEGRID_APP/Contents/Resources"
install -m 755 "$TYPEGRID_BUILD/typegrid" "$TYPEGRID_APP/Contents/MacOS/TypeGrid"
cat > "$TYPEGRID_APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>dev.typegrid.agent</string>
<key>CFBundleName</key><string>TypeGrid</string>
<key>CFBundleDisplayName</key><string>TypeGrid</string>
<key>CFBundleExecutable</key><string>TypeGrid</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$TYPEGRID_VERSION</string>
<key>CFBundleVersion</key><string>$TYPEGRID_BUILD_NUMBER</string>
<key>CFBundleIconFile</key><string>TypeGrid</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>dev.typegrid.connect</string><key>CFBundleURLSchemes</key><array><string>typegrid</string></array></dict></array>
</dict></plist>
PLIST
cp "$TYPEGRID_AGENT_DIR/scripts/update.sh" "$TYPEGRID_AGENT_DIR/scripts/replace-app.sh" "$TYPEGRID_APP/Contents/Resources/"
TYPEGRID_ICON_TMP=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_ICON_TMP"' EXIT
trap 'exit 1' HUP INT TERM
swiftc -parse-as-library "$TYPEGRID_AGENT_DIR/Sources/TypeGrid/BrandMark.swift" "$TYPEGRID_AGENT_DIR/scripts/make-icon.swift" -o "$TYPEGRID_ICON_TMP/make-icon"
"$TYPEGRID_ICON_TMP/make-icon" "$TYPEGRID_ICON_TMP/TypeGrid.iconset"
iconutil -c icns "$TYPEGRID_ICON_TMP/TypeGrid.iconset" -o "$TYPEGRID_APP/Contents/Resources/TypeGrid.icns"
if [ "${TYPEGRID_SIGN_ID:--}" = - ]; then
  # Source fallback only; ad-hoc rebuilds can require new TCC consent.
  codesign --force --sign - --identifier dev.typegrid.agent "$TYPEGRID_APP"
else
  codesign --force --options runtime --timestamp --sign "$TYPEGRID_SIGN_ID" --identifier dev.typegrid.agent "$TYPEGRID_APP"
fi
codesign --verify --strict "$TYPEGRID_APP"
