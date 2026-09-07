#!/bin/sh
set -eu
TYPEGRID_REPO=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TYPEGRID_OUTPUT=${1:?Usage: sh scripts/package-release.sh /absolute/output/directory}
case "$TYPEGRID_OUTPUT" in /*) ;; *) echo 'Use an absolute output directory.' >&2; exit 1 ;; esac
TYPEGRID_VERSION=$(sed -n 's/^VERSION=//p' "$TYPEGRID_REPO/public/install.sh")
test -n "$TYPEGRID_VERSION"
mkdir -p "$TYPEGRID_OUTPUT"
# Explicit source allowlist: no credentials, local databases, telemetry or build caches.
TYPEGRID_STAGE=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_STAGE"' EXIT HUP INT TERM
mkdir -p "$TYPEGRID_STAGE/typegrid/agent"
for TYPEGRID_PART in Package.swift Sources Tests scripts; do
  cp -R "$TYPEGRID_REPO/agent/$TYPEGRID_PART" "$TYPEGRID_STAGE/typegrid/agent/"
done
cp -R "$TYPEGRID_REPO/LICENSE" "$TYPEGRID_REPO/README.md" "$TYPEGRID_REPO/docs" "$TYPEGRID_STAGE/typegrid/"
COPYFILE_DISABLE=1 tar -czf "$TYPEGRID_OUTPUT/typegrid-source.tar.gz" \
  -C "$TYPEGRID_STAGE" \
  typegrid/agent/Package.swift typegrid/agent/Sources typegrid/agent/Tests \
  typegrid/agent/scripts typegrid/LICENSE typegrid/README.md typegrid/docs
(cd "$TYPEGRID_OUTPUT" && shasum -a 256 typegrid-source.tar.gz > SHA256SUMS && shasum -a 256 -c SHA256SUMS)
printf 'Prepared v%s source assets in %s\n' "$TYPEGRID_VERSION" "$TYPEGRID_OUTPUT"
