#!/bin/sh
set -eu
TYPEGRID_AGENT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# v0.2.1/v0.2.2 updaters use this build-only contract during migration.
if [ -n "${TYPEGRID_STAGE_APP:-}" ]; then
  sh "$TYPEGRID_AGENT_DIR/scripts/build-app.sh" "$TYPEGRID_STAGE_APP"
  exit 0
fi
# Keep the existing location, even if /Applications has become writable.
if [ -L "$HOME/.local/bin/typegrid" ]; then
  TYPEGRID_LINK=$(readlink "$HOME/.local/bin/typegrid")
  case "$TYPEGRID_LINK" in
    /Applications/TypeGrid.app/Contents/MacOS/TypeGrid|"$HOME/Applications/TypeGrid.app/Contents/MacOS/TypeGrid")
      TYPEGRID_APP=${TYPEGRID_LINK%/Contents/MacOS/TypeGrid} ;;
  esac
fi
if [ -z "${TYPEGRID_APP:-}" ]; then
  if [ -d "$HOME/Applications/TypeGrid.app" ]; then TYPEGRID_APP="$HOME/Applications/TypeGrid.app"
  elif [ -d /Applications/TypeGrid.app ] || [ -w /Applications ]; then TYPEGRID_APP=/Applications/TypeGrid.app
  else TYPEGRID_APP="$HOME/Applications/TypeGrid.app"; fi
fi
TYPEGRID_TMP=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_TMP"' EXIT
trap 'exit 1' HUP INT TERM
sh "$TYPEGRID_AGENT_DIR/scripts/build-app.sh" "$TYPEGRID_TMP/TypeGrid.app"
sh "$TYPEGRID_AGENT_DIR/scripts/replace-app.sh" "$TYPEGRID_TMP/TypeGrid.app" "$TYPEGRID_APP" no-restart
