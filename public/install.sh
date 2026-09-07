#!/bin/sh
set -eu
VERSION=0.1.3
RELEASE="https://github.com/mijomajic/typegrid/releases/download/v$VERSION"
if [ "$(uname -s)" != Darwin ]; then
  echo 'TypeGrid currently supports macOS 13+ only. Linux and Windows ports are welcome.' >&2; exit 1
fi
if ! xcrun --find swift >/dev/null 2>&1; then
  echo 'Install Apple Command Line Tools first: xcode-select --install' >&2; exit 1
fi
TYPEGRID_TMP=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_TMP"' EXIT HUP INT TERM
printf 'TypeGrid %s — building the tiny native agent…\n' "$VERSION"
curl --fail --silent --show-error --location --proto '=https' "$RELEASE/typegrid-source.tar.gz" -o "$TYPEGRID_TMP/typegrid-source.tar.gz"
curl --fail --silent --show-error --location --proto '=https' "$RELEASE/SHA256SUMS" -o "$TYPEGRID_TMP/SHA256SUMS"
(cd "$TYPEGRID_TMP" && shasum -a 256 -c SHA256SUMS)
tar -xzf "$TYPEGRID_TMP/typegrid-source.tar.gz" -C "$TYPEGRID_TMP"
sh "$TYPEGRID_TMP/typegrid/agent/scripts/install-app.sh"
TYPEGRID_BINDIR="$HOME/.local/bin"
case ":$PATH:" in *":$TYPEGRID_BINDIR:"*) ;; *) printf 'Add to your shell profile: export PATH="$HOME/.local/bin:$PATH"\n' ;; esac
if [ "${TYPEGRID_NO_PAIR:-0}" = 1 ]; then
  printf 'Run %s/typegrid pair, then %s/typegrid start.\n' "$TYPEGRID_BINDIR" "$TYPEGRID_BINDIR"
else
  if ! "$TYPEGRID_BINDIR/typegrid" is-paired; then "$TYPEGRID_BINDIR/typegrid" pair; fi
  "$TYPEGRID_BINDIR/typegrid" start
fi
