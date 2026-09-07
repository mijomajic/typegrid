#!/bin/sh
set -eu
launchctl bootout "gui/$(id -u)/dev.typegrid.agent" >/dev/null 2>&1 || true
# Exact TypeGrid-owned files only. Server data is retained; delete it in Settings.
for file in "$HOME/.local/bin/typegrid" "$HOME/Library/LaunchAgents/dev.typegrid.agent.plist"; do
  if [ -f "$file" ] || [ -L "$file" ]; then unlink "$file"; fi
done
printf 'TypeGrid uninstalled. Local aggregates and credentials remain in:\n%s\n' "$HOME/Library/Application Support/TypeGrid"
printf 'To remove those too, delete that folder in Finder. Delete your online account at https://typegrid.dev/settings.\n'

printf 'Also move TypeGrid.app from Applications to Trash, and remove its Input Monitoring permission.\n'
