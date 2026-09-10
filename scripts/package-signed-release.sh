#!/bin/sh
set -eu
TYPEGRID_REPO=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TYPEGRID_OUTPUT=${1:?Usage: package-signed-release.sh /absolute/output/directory}
: "${TYPEGRID_SIGN_ID:?Set TYPEGRID_SIGN_ID to your Developer ID Application identity}"
: "${TYPEGRID_NOTARY_PROFILE:?Set TYPEGRID_NOTARY_PROFILE to a notarytool Keychain profile}"
# No credentials are written into the repository or release archive.
sh "$TYPEGRID_REPO/scripts/package-release.sh" "$TYPEGRID_OUTPUT"
TYPEGRID_STAGE=$(mktemp -d)
trap 'rm -rf "$TYPEGRID_STAGE"' EXIT
trap 'exit 1' HUP INT TERM
TYPEGRID_UNIVERSAL=1 sh "$TYPEGRID_REPO/agent/scripts/build-app.sh" "$TYPEGRID_STAGE/TypeGrid.app"
codesign --verify --strict -R 'anchor apple generic and identifier "dev.typegrid.agent" and certificate leaf[field.1.2.840.113635.100.6.1.13] exists' "$TYPEGRID_STAGE/TypeGrid.app"
ditto -c -k --keepParent "$TYPEGRID_STAGE/TypeGrid.app" "$TYPEGRID_STAGE/notarize.zip"
xcrun notarytool submit "$TYPEGRID_STAGE/notarize.zip" --keychain-profile "$TYPEGRID_NOTARY_PROFILE" --wait
xcrun stapler staple "$TYPEGRID_STAGE/TypeGrid.app"
xcrun stapler validate "$TYPEGRID_STAGE/TypeGrid.app"
spctl --assess --type execute "$TYPEGRID_STAGE/TypeGrid.app"
ditto -c -k --keepParent "$TYPEGRID_STAGE/TypeGrid.app" "$TYPEGRID_OUTPUT/TypeGrid-macos.zip"
(cd "$TYPEGRID_OUTPUT" && shasum -a 256 TypeGrid-macos.zip >> SHA256SUMS && shasum -a 256 -c SHA256SUMS)
printf 'Signed, notarized universal release prepared in %s\n' "$TYPEGRID_OUTPUT"
