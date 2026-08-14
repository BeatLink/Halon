#!/usr/bin/env bash
# Screenshots the GTK theme headlessly and repeatably.
#
# A named theme can only be judged rendered, so this is part of the build, not
# an afterthought. It runs each widget factory on a private Xvfb display with
# the working-tree theme in a throwaway XDG_DATA_HOME, and captures the root
# window — capture-by-window-name and Wayland grabs are exactly the two things
# that made earlier attempts flaky.
#
# Usage: scripts/screenshot.sh [outdir]
# Needs: Xvfb, import (ImageMagick), gtk3-widget-factory, gtk4-widget-factory.

set -euo pipefail

ROOT="${HALON_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
OUT="${1:-$ROOT/screenshots}"
DISPLAY_NO=":97"
SIZE=1360x960

mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$WORK"' EXIT

mkdir -p "$WORK/themes"
ln -s "$ROOT/gtk/Halon" "$WORK/themes/Halon"
ln -s "$ROOT/gtk/Halon-Dark" "$WORK/themes/Halon-Dark"

Xvfb "$DISPLAY_NO" -screen 0 "${SIZE}x24" &
sleep 2

shoot() { # name  gtk_theme  binary...
    local name="$1" theme="$2"; shift 2
    env -u WAYLAND_DISPLAY \
        DISPLAY="$DISPLAY_NO" \
        GDK_BACKEND=x11 \
        XDG_DATA_HOME="$WORK" \
        XDG_DATA_DIRS="/run/current-system/sw/share:${XDG_DATA_DIRS:-/usr/share}" \
        GTK_THEME="$theme" \
        "$@" >"$WORK/$name.log" 2>&1 &
    local pid=$!
    sleep 6
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "FAILED to stay up: $name — log tail:"
        tail -5 "$WORK/$name.log" | sed 's/^/    /'
        return 1
    fi
    import -display "$DISPLAY_NO" -window root "$OUT/$name.png"
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    echo "wrote $OUT/$name.png"
    grep -iE "warning|error|css" "$WORK/$name.log" | head -5 | sed 's/^/    log: /' || true
}

# Interaction shots — hover and open-dropdown states, driven by xdotool against
# fixed coordinates. Without a window manager the window maps at 0,0, so the
# coordinates are stable for a given widget-factory build and screen size.
shoot_states() { # name  gtk_theme  binary
    local name="$1" theme="$2" bin="$3"
    command -v xdotool >/dev/null || { echo "xdotool missing — skipping $name states"; return 0; }
    env -u WAYLAND_DISPLAY \
        DISPLAY="$DISPLAY_NO" \
        GDK_BACKEND=x11 \
        XDG_DATA_HOME="$WORK" \
        XDG_DATA_DIRS="/run/current-system/sw/share:${XDG_DATA_DIRS:-/usr/share}" \
        GTK_THEME="$theme" \
        "$bin" >"$WORK/$name.log" 2>&1 &
    local pid=$!
    sleep 6
    kill -0 "$pid" 2>/dev/null || { echo "FAILED to stay up: $name"; return 1; }

    # Hover a toggle button (middle column) — border should appear, never a fill swap.
    DISPLAY="$DISPLAY_NO" xdotool mousemove 486 86
    sleep 1
    import -display "$DISPLAY_NO" -window root "$OUT/$name-hover.png"

    # Open the first combobox's list.
    DISPLAY="$DISPLAY_NO" xdotool mousemove 486 263 click 1
    sleep 2
    import -display "$DISPLAY_NO" -window root "$OUT/$name-dropdown.png"
    DISPLAY="$DISPLAY_NO" xdotool key Escape

    # Focus the first entry — accent border plus translucent ring.
    DISPLAY="$DISPLAY_NO" xdotool mousemove 188 86 click 1
    sleep 1
    import -display "$DISPLAY_NO" -window root "$OUT/$name-focus.png"

    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    echo "wrote $OUT/$name-{hover,dropdown,focus}.png"
}

FAILED=0
shoot gtk3-light Halon        gtk3-widget-factory || FAILED=1
shoot gtk3-dark  Halon:dark   gtk3-widget-factory || FAILED=1
shoot gtk4-light Halon        gtk4-widget-factory || FAILED=1
shoot gtk4-dark  Halon:dark   gtk4-widget-factory || FAILED=1
shoot_states gtk3-light Halon gtk3-widget-factory || FAILED=1

exit $FAILED
