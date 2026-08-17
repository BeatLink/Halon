#!/usr/bin/env bash
# Screenshots the LightDM greeter headlessly and repeatably.
#
# The greeter has no LightDM to talk to outside a seat, so this stages a copy of
# the theme with preview/mock.js enabled and renders that — the same path
# preview-lightdm opens interactively. Firefox rather than QtWebEngine, because
# nothing here uses an engine-specific feature and Firefox screenshots headless
# without a display server at all.
#
# Usage: scripts/screenshot-lightdm.sh [outdir]
# Needs: firefox.

set -euo pipefail

ROOT="${HALON_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
OUT="${1:-$ROOT/screenshots}"
SIZE=1280,800

mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cp -r "$ROOT/lightdm/." "$WORK/"
sed -i 's|<!--<script src="preview/mock.js"></script>-->|<script src="preview/mock.js"></script>|' "$WORK/index.html"

# The scheme toggle writes localStorage, which a fresh profile does not carry;
# the attribute is the same override the toggle sets, so it renders identically.
sed 's|<html lang="en" data-state="idle">|<html lang="en" data-state="idle" data-scheme="dark">|' \
    "$WORK/index.html" > "$WORK/dark.html"

shoot() { # name  page
    local profile
    profile=$(mktemp -d)
    # A private profile per run: a second Firefox on the machine otherwise
    # refuses to start and the capture silently never happens.
    firefox --headless --profile "$profile" --window-size="$SIZE" \
            --screenshot "$OUT/$1.png" "file://$WORK/$2" >/dev/null 2>&1
    rm -rf "$profile"
    [ -s "$OUT/$1.png" ] || { echo "FAILED to capture: $1" >&2; return 1; }
    echo "wrote $OUT/$1.png"
}

FAILED=0
shoot lightdm-light index.html || FAILED=1
shoot lightdm-dark  dark.html  || FAILED=1

exit $FAILED
