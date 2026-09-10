#!/bin/sh
set -eu
umask 077
TYPEGRID_VERSION=${1:?Missing version}
TYPEGRID_KIND=${2:?Missing release kind}
TYPEGRID_APP=${3:?Missing installed app path}
TYPEGRID_ROOT=${6:-${TYPEGRID_DATA_DIR:-"$HOME/Library/Application Support/TypeGrid"}}
export TYPEGRID_DATA_DIR="$TYPEGRID_ROOT"
TYPEGRID_JOB=${4:-}
TYPEGRID_RESTART=${5:-restart}
case "$TYPEGRID_VERSION" in *[!0-9.]*) echo 'Invalid release version.' >&2; exit 1 ;; esac
printf '%s\n' "$TYPEGRID_VERSION" | /usr/bin/awk -F. 'NF != 3 {exit 1} {for(i=1;i<=3;i++) if ($i !~ /^(0|[1-9][0-9]*)$/ || length($i)>8) exit 1}'
case "$TYPEGRID_KIND" in source) TYPEGRID_ASSET=typegrid-source.tar.gz ;; signed) TYPEGRID_ASSET=TypeGrid-macos.zip ;; *) exit 1 ;; esac
mkdir -p "$TYPEGRID_ROOT"
# macOS shlock checks the PID and reclaims locks left by interrupted updaters.
if ! /usr/bin/shlock -p $$ -f "$TYPEGRID_ROOT/update.lock"; then
  echo 'Another update is running. Wait for it to finish.' >&2
  exit 1
fi
TYPEGRID_TMP=$(mktemp -d)
cleanup() {
  TYPEGRID_RESULT=$?
  trap - EXIT HUP INT TERM
  if [ "$TYPEGRID_RESULT" != 0 ]; then printf 'failed\n' > "$TYPEGRID_ROOT/update-result"; fi
  rm -rf "$TYPEGRID_TMP"
  rm -f "$TYPEGRID_ROOT/update.lock"
  case "$0" in "$TYPEGRID_ROOT"/update-worker-*.sh) rm -f "$0" ;; esac
  if [ -n "$TYPEGRID_JOB" ]; then launchctl remove "$TYPEGRID_JOB" >/dev/null 2>&1 || true; fi
  exit "$TYPEGRID_RESULT"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
printf 'installing\n' > "$TYPEGRID_ROOT/update-result"
TYPEGRID_TEAM=''
if [ -d "$TYPEGRID_APP" ]; then
  TYPEGRID_TEAM=$(codesign -dv "$TYPEGRID_APP" 2>&1 | sed -n 's/^TeamIdentifier=//p')
  if [ "$TYPEGRID_TEAM" = 'not set' ]; then TYPEGRID_TEAM=''; fi
  if [ -n "$TYPEGRID_TEAM" ]; then
    case "$TYPEGRID_TEAM" in *[!A-Z0-9]*) exit 1 ;; esac
    test "$TYPEGRID_KIND" = signed || { echo 'This installation requires a signed update; source downgrade refused.' >&2; exit 1; }
  fi
fi
TYPEGRID_RELEASE="https://github.com/mijomajic/typegrid/releases/download/v$TYPEGRID_VERSION"
printf 'Downloading TypeGrid %s…\n' "$TYPEGRID_VERSION"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 300 "$TYPEGRID_RELEASE/$TYPEGRID_ASSET" -o "$TYPEGRID_TMP/$TYPEGRID_ASSET"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 60 "$TYPEGRID_RELEASE/SHA256SUMS" -o "$TYPEGRID_TMP/SHA256SUMS"
# Check exactly the selected archive, never arbitrary manifest filenames.
TYPEGRID_SHA=$(/usr/bin/awk -v asset="$TYPEGRID_ASSET" '$2 == asset && length($1)==64 && $1 !~ /[^a-fA-F0-9]/ {print $1; count++} END {if(count != 1) exit 1}' "$TYPEGRID_TMP/SHA256SUMS")
printf '%s  %s\n' "$TYPEGRID_SHA" "$TYPEGRID_ASSET" > "$TYPEGRID_TMP/selected.sha256"
(cd "$TYPEGRID_TMP" && shasum -a 256 -c selected.sha256)
if [ "$TYPEGRID_KIND" = source ]; then
  if ! xcrun --find swift >/dev/null 2>&1; then
    echo 'Apple Command Line Tools are needed for this source release. Install them with xcode-select --install, then try again.' >&2
    exit 1
  fi
  tar -tzf "$TYPEGRID_TMP/$TYPEGRID_ASSET" > "$TYPEGRID_TMP/entries"
  /usr/bin/awk 'BEGIN { ok=1 } /^\// || /\\/ || /(^|\/)\.\.?(\/|$)/ || !/^typegrid(\/|$)/ { ok=0 } END { exit !(ok && NR > 0) }' "$TYPEGRID_TMP/entries"
  tar -tvzf "$TYPEGRID_TMP/$TYPEGRID_ASSET" > "$TYPEGRID_TMP/types"
  /usr/bin/awk 'substr($0,1,1) != "-" && substr($0,1,1) != "d" {exit 1}' "$TYPEGRID_TMP/types"
  tar -xzf "$TYPEGRID_TMP/$TYPEGRID_ASSET" -C "$TYPEGRID_TMP"
  sh "$TYPEGRID_TMP/typegrid/agent/scripts/build-app.sh" "$TYPEGRID_TMP/TypeGrid.app"
else
  # Our dependency-free app has no symlinks. Reject paths/links that could escape
  # staging before checking the extracted app's signature.
  /usr/bin/unzip -Z1 "$TYPEGRID_TMP/$TYPEGRID_ASSET" > "$TYPEGRID_TMP/zip-files"
  /usr/bin/awk '!/^(__MACOSX\/)?TypeGrid\.app(\/|$)/ || /(^|\/)\.\.($|\/)/ {exit 1}' "$TYPEGRID_TMP/zip-files"
  /usr/bin/zipinfo -l "$TYPEGRID_TMP/$TYPEGRID_ASSET" > "$TYPEGRID_TMP/zip-info"
  /usr/bin/awk 'substr($0,1,1) == "l" {exit 1}' "$TYPEGRID_TMP/zip-info"
  ditto -x -k "$TYPEGRID_TMP/$TYPEGRID_ASSET" "$TYPEGRID_TMP"
  codesign --verify --strict -R 'anchor apple generic and identifier "dev.typegrid.agent" and certificate leaf[field.1.2.840.113635.100.6.1.13] exists' "$TYPEGRID_TMP/TypeGrid.app"
  if [ -n "$TYPEGRID_TEAM" ]; then
    codesign --verify --strict -R "certificate leaf[subject.OU] = \"$TYPEGRID_TEAM\"" "$TYPEGRID_TMP/TypeGrid.app"
  fi
  spctl --assess --type execute "$TYPEGRID_TMP/TypeGrid.app"
fi
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$TYPEGRID_TMP/TypeGrid.app/Contents/Info.plist")" = "$TYPEGRID_VERSION"
sh "$TYPEGRID_TMP/TypeGrid.app/Contents/Resources/replace-app.sh" "$TYPEGRID_TMP/TypeGrid.app" "$TYPEGRID_APP" "$TYPEGRID_RESTART"
printf 'updated\n' > "$TYPEGRID_ROOT/update-result"
printf 'TypeGrid %s is installed.\n' "$TYPEGRID_VERSION"
