#!/bin/sh
set -eu
TYPEGRID_INCOMING=${1:?Missing staged app}
TYPEGRID_APP=${2:?Missing destination app}
TYPEGRID_RESTART=${3:-restart}
TYPEGRID_BIN="$HOME/.local/bin/typegrid"
case "$TYPEGRID_APP" in /*/TypeGrid.app) ;; *) echo 'Invalid installation path.' >&2; exit 1 ;; esac
test ! -L "$TYPEGRID_APP" || { echo 'The app destination must not be a symlink.' >&2; exit 1; }
TYPEGRID_PLIST_TOOL=/usr/libexec/PlistBuddy
for TYPEGRID_CHECK in "$TYPEGRID_INCOMING" "$TYPEGRID_APP"; do
  if [ -e "$TYPEGRID_CHECK" ]; then
    test "$("$TYPEGRID_PLIST_TOOL" -c 'Print :CFBundleIdentifier' "$TYPEGRID_CHECK/Contents/Info.plist")" = dev.typegrid.agent || { echo 'Refusing to replace an unrelated app.' >&2; exit 1; }
  fi
done
test -x "$TYPEGRID_INCOMING/Contents/MacOS/TypeGrid"
codesign --verify --strict "$TYPEGRID_INCOMING"
# Never downgrade a team-signed installation to ad-hoc code or another team.
if [ -d "$TYPEGRID_APP" ]; then
  TYPEGRID_TEAM=$(codesign -dv "$TYPEGRID_APP" 2>&1 | sed -n 's/^TeamIdentifier=//p')
  if [ -n "$TYPEGRID_TEAM" ] && [ "$TYPEGRID_TEAM" != not\ set ]; then
    case "$TYPEGRID_TEAM" in *[!A-Z0-9]*) exit 1 ;; esac
    codesign --verify --strict -R "anchor apple generic and identifier \"dev.typegrid.agent\" and certificate leaf[subject.OU] = \"$TYPEGRID_TEAM\"" "$TYPEGRID_INCOMING"
  fi
fi
mkdir -p "$(dirname "$TYPEGRID_APP")" "$HOME/.local/bin"
TYPEGRID_ROOT=${TYPEGRID_DATA_DIR:-"$HOME/Library/Application Support/TypeGrid"}
mkdir -p "$TYPEGRID_ROOT"
/usr/bin/shlock -p $$ -f "$TYPEGRID_ROOT/install.lock" || { echo 'Another installation is running.' >&2; exit 1; }
TYPEGRID_SWAP=$(mktemp -d "$(dirname "$TYPEGRID_APP")/.typegrid-install.XXXXXX")
TYPEGRID_MOVED=0
TYPEGRID_INSTALLED=0
TYPEGRID_COMMITTED=0
TYPEGRID_STOPPED=0
cleanup() {
  TYPEGRID_RESULT=$?
  trap - EXIT HUP INT TERM
  if [ "$TYPEGRID_COMMITTED" = 0 ]; then
    if [ "$TYPEGRID_INSTALLED" = 1 ]; then
      if ! "$TYPEGRID_APP/Contents/MacOS/TypeGrid" stop >/dev/null 2>&1; then
        printf 'Could not stop the new app. Previous app retained at %s/Previous.app\n' "$TYPEGRID_SWAP" >&2
        rm -f "$TYPEGRID_ROOT/install.lock"
        exit 1
      fi
      rm -rf "$TYPEGRID_APP"
    fi
    if [ "$TYPEGRID_MOVED" = 1 ]; then mv "$TYPEGRID_SWAP/Previous.app" "$TYPEGRID_APP"; fi
    if [ "$TYPEGRID_STOPPED" = 1 ] && [ -x "$TYPEGRID_APP/Contents/MacOS/TypeGrid" ]; then
      "$TYPEGRID_APP/Contents/MacOS/TypeGrid" start || true
    fi
  fi
  rm -rf "$TYPEGRID_SWAP"
  rm -f "$TYPEGRID_ROOT/install.lock"
  exit "$TYPEGRID_RESULT"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
# Stage and verify fully before stopping the running agent.
ditto "$TYPEGRID_INCOMING" "$TYPEGRID_SWAP/TypeGrid.app"
codesign --verify --strict "$TYPEGRID_SWAP/TypeGrid.app"
"$TYPEGRID_SWAP/TypeGrid.app/Contents/MacOS/TypeGrid" stop
TYPEGRID_STOPPED=1
if [ -d "$TYPEGRID_APP" ]; then mv "$TYPEGRID_APP" "$TYPEGRID_SWAP/Previous.app"; TYPEGRID_MOVED=1; fi
mv "$TYPEGRID_SWAP/TypeGrid.app" "$TYPEGRID_APP"
TYPEGRID_INSTALLED=1
ln -s "$TYPEGRID_APP/Contents/MacOS/TypeGrid" "$TYPEGRID_SWAP/typegrid"
mv -f "$TYPEGRID_SWAP/typegrid" "$TYPEGRID_BIN"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister "$TYPEGRID_APP"
if [ "$TYPEGRID_RESTART" = restart ]; then "$TYPEGRID_BIN" start; fi
TYPEGRID_COMMITTED=1
printf '\nInstalled %s\nCLI: %s\n' "$TYPEGRID_APP" "$TYPEGRID_BIN"
