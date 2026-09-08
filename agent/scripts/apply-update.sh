#!/bin/sh
set -eu
updater_pid="$1"
updater_app="$2"
updater_stage="$3"
updater_directory="$4"
updater_backup="$updater_app.previous-update"
updater_wait=0
while kill -0 "$updater_pid" 2>/dev/null; do
  updater_wait=$((updater_wait + 1))
  [ "$updater_wait" -lt 200 ] || exit 1
  sleep 0.1
done
[ ! -e "$updater_backup" ] || exit 1
mv "$updater_app" "$updater_backup"
if ! mv "$updater_stage" "$updater_app"; then
  mv "$updater_backup" "$updater_app"
  open -g "$updater_app" --args run
  exit 1
fi
if open -g "$updater_app" --args run; then
  rm -rf "$updater_backup" "$updater_directory"
else
  mv "$updater_app" "$updater_stage"
  mv "$updater_backup" "$updater_app"
  open -g "$updater_app" --args run
fi
