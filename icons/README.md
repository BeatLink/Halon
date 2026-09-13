# Halon for icons

Two icon themes, `Halon` and `Halon-Dark`, each a single `index.theme`. They build on
[Colloid](https://github.com/vinceliuice/Colloid-icon-theme) — flat, one blue, and drawn to the
geometry the GTK overrides already assume — inheriting its art and correcting the one place it
reads wrong under Halon.

Widget glyphs are separate: the check, radio and toggle marks are Halon's own, in
`gtk/Halon/shared/icons`.

```
icons/
  Halon/index.theme        inherits Colloid
  Halon-Dark/index.theme   inherits Colloid-Dark
```

## What the overlay fixes

Colloid declares `places/scalable` — the full-colour folder art — as `MinSize=32`, and ships
fixed-size `places/16`, `places/22` and `places/24` directories drawn as `currentColor`
outlines. Those are meant for sidebars, but nothing marks them as symbolic, so any plain
request for `folder` at 24px or less gets one. It rasterises with `currentColor` at its initial
value, which is black — so a file manager at a small zoom paints black wireframes where folders
belong.

The mime types give the asymmetry away: `mimetypes/scalable` is `MinSize=16` and there are no
fixed small mime directories, so files render the colour art at every size while folders do not.

The overlay re-declares the Places directory as scalable from 16px up:

```ini
[places/scalable]
Size=64
Context=Places
MinSize=16
MaxSize=512
Type=Scalable
```

A theme's own directories are searched before the ones it inherits, so this wins at every size,
and everything outside the Places context resolves through `Inherits` untouched. Symbolic names
are unaffected — `folder-symbolic` still lands in `places/symbolic` — so sidebars and panels keep
their monochrome icons.

## Install

The overlay is useless on its own: it needs Colloid installed to inherit from. With Nix that is
automatic, since `halon-icon-theme` propagates it.

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope — Colloid comes along with it:
  home.packages = [ halon.packages.${pkgs.system}.halon-icon-theme ];
}
```

`themes.halon.enable` with `setDefaults` selects it for GTK and for the Cinnamon shell, so
neither module needs anything further. By hand:

```sh
cp -r icons/Halon icons/Halon-Dark ~/.local/share/icons/
gsettings set org.gnome.desktop.interface icon-theme Halon
```

Colloid must be on `XDG_DATA_DIRS` either way. Keep Adwaita installed alongside both: Colloid
inherits `hicolor` and `breeze`, not Adwaita, so it has no Adwaita fallback of its own.

The GTK metathemes name the overlay rather than Colloid — `IconTheme=Halon` in `gtk/Halon`,
`IconTheme=Halon-Dark` in `gtk/Halon-Dark`. Cursors are still Adwaita.
