#!/bin/sh
set -eu
VERSION=0.2.3
# Switch to signed only after publishing the notarized TypeGrid-macos.zip.
RELEASE_KIND=source
RELEASE="https://github.com/mijomajic/typegrid/releases/download/v$VERSION"
if [ "$(uname -s)" != Darwin ]; then
  echo 'TypeGrid currently supports macOS 13+ only. Linux and Windows ports are welcome.' >&2; exit 1
fi
TYPEGRID_BINDIR="$HOME/.local/bin"
TYPEGRID_CURRENT=$("$TYPEGRID_BINDIR/typegrid" version 2>/dev/null || true)
if ! /usr/bin/awk -v current="$TYPEGRID_CURRENT" -v wanted="$VERSION" 'BEGIN {
  if (split(current,a,".") != 3 || current !~ /^[0-9]+\.[0-9]+\.[0-9]+$/) exit 1;
  split(wanted,b,"."); for(i=1;i<=3;i++) {if(a[i]+0>b[i]+0) exit 0; if(a[i]+0<b[i]+0) exit 1} exit 0
}'; then
if [ "$RELEASE_KIND" = source ] && ! xcrun --find swift >/dev/null 2>&1; then
  printf 'Apple Command Line Tools are needed once. Complete the installer that opens; TypeGrid will continue automatically.\n'
  xcode-select --install >/dev/null 2>&1 || true
  TYPEGRID_WAIT=0
  until xcrun --find swift >/dev/null 2>&1; do
    TYPEGRID_WAIT=$((TYPEGRID_WAIT + 1))
    if [ "$TYPEGRID_WAIT" -ge 600 ]; then
      echo 'Tools are not ready yet. Finish their installation, then rerun this same command.' >&2
      exit 1
    fi
    sleep 2
  done
fi
TYPEGRID_TMP=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_TMP"' EXIT
trap 'exit 1' HUP INT TERM
printf 'Installing TypeGrid %s…\n' "$VERSION"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 60 "$RELEASE/typegrid-update.sh" -o "$TYPEGRID_TMP/typegrid-update.sh"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 60 "$RELEASE/SHA256SUMS" -o "$TYPEGRID_TMP/SHA256SUMS"
TYPEGRID_SHA=$(/usr/bin/awk '$2 == "typegrid-update.sh" && length($1)==64 && $1 !~ /[^a-fA-F0-9]/ {print $1; count++} END {if(count != 1) exit 1}' "$TYPEGRID_TMP/SHA256SUMS")
printf '%s  typegrid-update.sh\n' "$TYPEGRID_SHA" > "$TYPEGRID_TMP/selected.sha256"
(cd "$TYPEGRID_TMP" && shasum -a 256 -c selected.sha256)
if [ -L "$TYPEGRID_BINDIR/typegrid" ]; then
  TYPEGRID_LINK=$(readlink "$TYPEGRID_BINDIR/typegrid")
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
sh "$TYPEGRID_TMP/typegrid-update.sh" "$VERSION" "$RELEASE_KIND" "$TYPEGRID_APP" '' no-restart
else
  printf 'TypeGrid %s is already installed. Continuing setup…\n' "$TYPEGRID_CURRENT"
fi
if [ "${TYPEGRID_NO_PAIR:-0}" = 1 ]; then
  printf 'Run %s/typegrid pair, then %s/typegrid start.\n' "$TYPEGRID_BINDIR" "$TYPEGRID_BINDIR"
else
  if ! "$TYPEGRID_BINDIR/typegrid" is-paired; then "$TYPEGRID_BINDIR/typegrid" pair; fi
  "$TYPEGRID_BINDIR/typegrid" start
  open 'https://typegrid.dev/app/connect'
  printf '\nTypeGrid is running and will start at login. Allow TypeGrid in Input Monitoring if prompted. No extra terminal commands are needed.\n'
fi
