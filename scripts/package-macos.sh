#!/bin/sh
set -eu
TYPEGRID_REPO=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TYPEGRID_OUTPUT=${1:?Usage: sh scripts/package-macos.sh /absolute/output/directory}
case "$TYPEGRID_OUTPUT" in /*) ;; *) echo 'Use an absolute output directory.' >&2; exit 1 ;; esac
TYPEGRID_STAGE=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_STAGE"' EXIT HUP INT TERM
mkdir -p "$TYPEGRID_OUTPUT" "$TYPEGRID_STAGE/disk"
TYPEGRID_STAGE_APP="$TYPEGRID_STAGE/disk/TypeGrid.app" sh "$TYPEGRID_REPO/agent/scripts/install-app.sh"
case "$(uname -m)" in
  arm64) TYPEGRID_OTHER_TRIPLE=x86_64-apple-macosx13.0 ;;
  x86_64) TYPEGRID_OTHER_TRIPLE=arm64-apple-macosx13.0 ;;
  *) echo 'Build on an Apple Silicon or Intel Mac.' >&2; exit 1 ;;
esac
swift build --package-path "$TYPEGRID_REPO/agent" -c release --triple "$TYPEGRID_OTHER_TRIPLE" --scratch-path "$TYPEGRID_STAGE/cross-build"
TYPEGRID_OTHER_BIN=$(swift build --package-path "$TYPEGRID_REPO/agent" -c release --triple "$TYPEGRID_OTHER_TRIPLE" --scratch-path "$TYPEGRID_STAGE/cross-build" --show-bin-path)
lipo -create "$TYPEGRID_STAGE/disk/TypeGrid.app/Contents/MacOS/TypeGrid" "$TYPEGRID_OTHER_BIN/typegrid" -output "$TYPEGRID_STAGE/TypeGrid-universal"
install -m 755 "$TYPEGRID_STAGE/TypeGrid-universal" "$TYPEGRID_STAGE/disk/TypeGrid.app/Contents/MacOS/TypeGrid"
codesign --force --deep --sign - --identifier dev.typegrid.agent "$TYPEGRID_STAGE/disk/TypeGrid.app"
COPYFILE_DISABLE=1 tar -czf "$TYPEGRID_OUTPUT/TypeGrid-universal.tar.gz" -C "$TYPEGRID_STAGE/disk" TypeGrid.app
(cd "$TYPEGRID_OUTPUT" && shasum -a 256 TypeGrid-universal.tar.gz > TypeGrid-universal.tar.gz.sha256)
ln -s /Applications "$TYPEGRID_STAGE/disk/Applications"
hdiutil create -volname TypeGrid -srcfolder "$TYPEGRID_STAGE/disk" -ov -format UDZO "$TYPEGRID_OUTPUT/TypeGrid.dmg"
(cd "$TYPEGRID_OUTPUT" && shasum -a 256 TypeGrid.dmg > TypeGrid.dmg.sha256)
printf 'Prepared the desktop download in %s\n' "$TYPEGRID_OUTPUT"
