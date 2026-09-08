#!/bin/sh
set -eu
VERSION=0.2.1
RELEASE="https://github.com/mijomajic/typegrid/releases/download/v$VERSION"
if [ "$(uname -s)" != Darwin ]; then
  echo 'TypeGrid currently supports macOS 13+ only. Linux and Windows ports are welcome.' >&2; exit 1
fi
TYPEGRID_BINDIR="$HOME/.local/bin"
if [ ! -x "$TYPEGRID_BINDIR/typegrid" ] || [ "$("$TYPEGRID_BINDIR/typegrid" version 2>/dev/null)" != "$VERSION" ]; then
if ! xcrun --find swift >/dev/null 2>&1; then
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
trap 'rm -rf "$TYPEGRID_TMP"' EXIT HUP INT TERM
printf 'TypeGrid %s — building the tiny native agent…\n' "$VERSION"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' "$RELEASE/typegrid-source.tar.gz" -o "$TYPEGRID_TMP/typegrid-source.tar.gz"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' "$RELEASE/SHA256SUMS" -o "$TYPEGRID_TMP/SHA256SUMS"
# Verify only the pinned source asset; reject ambiguous or malformed manifests.
awk '$2 == "typegrid-source.tar.gz" && length($1) == 64 && $1 !~ /[^0-9a-fA-F]/ { print $1 "  typegrid-source.tar.gz"; count++ } END { if (count != 1) exit 1 }' "$TYPEGRID_TMP/SHA256SUMS" > "$TYPEGRID_TMP/source.sha256"
(cd "$TYPEGRID_TMP" && shasum -a 256 -c source.sha256)
# Validate paths and file types before extracting or running any release code.
tar -tzf "$TYPEGRID_TMP/typegrid-source.tar.gz" > "$TYPEGRID_TMP/entries"
awk 'BEGIN { ok=1 } /^\// || /\\/ || /(^|\/)\.\.?(\/|$)/ || !/^typegrid(\/|$)/ { ok=0 } END { exit !(ok && NR > 0) }' "$TYPEGRID_TMP/entries"
tar -tvzf "$TYPEGRID_TMP/typegrid-source.tar.gz" > "$TYPEGRID_TMP/types"
awk 'substr($0,1,1) != "-" && substr($0,1,1) != "d" { exit 1 }' "$TYPEGRID_TMP/types"
tar -xzf "$TYPEGRID_TMP/typegrid-source.tar.gz" -C "$TYPEGRID_TMP"
sh "$TYPEGRID_TMP/typegrid/agent/scripts/install-app.sh"
else
  printf 'TypeGrid %s is already installed. Continuing setup…\n' "$VERSION"
fi
if [ "${TYPEGRID_NO_PAIR:-0}" = 1 ]; then
  printf 'Run %s/typegrid pair, then %s/typegrid start.\n' "$TYPEGRID_BINDIR" "$TYPEGRID_BINDIR"
else
  if ! "$TYPEGRID_BINDIR/typegrid" is-paired; then "$TYPEGRID_BINDIR/typegrid" pair; fi
  "$TYPEGRID_BINDIR/typegrid" start
  open 'https://typegrid.dev/app/connect'
  printf '\nTypeGrid is running and will start at login. Allow TypeGrid in Input Monitoring if prompted. No extra terminal commands are needed.\n'
fi
