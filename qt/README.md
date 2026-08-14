# Halon for Qt

The Halon theme for Qt 5 and Qt 6. Everything here is generated from the shared token files — the
same Layer 1 that drives the GTK, Cinnamon, Tilix, VS Code and Firefox implementations — by
`scripts/build-qt.mjs`. Edit the mapping in that script or the tokens in `gtk/Halon/shared/`, never
these files.

```sh
node scripts/build-qt.mjs           # regenerate everything under qt/
node scripts/build-qt.mjs --check   # fail if the output is stale
```

```
colors/qt5ct/Halon{,-Dark}.conf   QPalette — what every unstyled widget uses
colors/qt6ct/Halon{,-Dark}.conf   the same, at Qt 6's role count
Halon{,-Dark}.qss                 geometry and component treatments (§4, §6)
assets/{light,dark}/*.svg         indicator glyphs, off the shared glyph geometry
```

## The two halves, and why both

**The colour scheme is the load-bearing half.** It is a QPalette, so it reaches every widget in
every Qt application whether or not that application cooperates. On its own it produces a correct
Halon palette at the host style's proportions.

**The style sheet is the rest of the theme.** §4 of the guide is explicit that a port with the
right palette and the wrong geometry reads as the host toolkit wearing the colours — so the 32px
control height, the 28px rows, the 34px frame and the radius ladder live in `Halon.qss`, along with
the component treatments a palette cannot express: three button weights, ghost combo boxes,
hairline-at-rest inputs, and the accent-underlined tab.

Neither replaces the other. The style sheet leaves gaps wherever an application draws something it
does not name, and the palette is what fills them.

## Install

Both halves go through **qt5ct** / **qt6ct**, the Qt platform-theme configurators:

```sh
mkdir -p ~/.config/qt5ct/colors ~/.config/qt6ct/colors
cp colors/qt5ct/*.conf ~/.config/qt5ct/colors/
cp colors/qt6ct/*.conf ~/.config/qt6ct/colors/
```

Then, in each of `qt5ct` and `qt6ct`:

1. **Appearance → Style**: `Fusion`. The style sheet assumes Fusion's element structure for
   everything it does not restyle.
2. **Appearance → Color scheme**: `Halon` or `Halon-Dark`.
3. **Style Sheets**: add `Halon.qss` (or `Halon-Dark.qss`) — see the path note below first.

Finally, point Qt at the configurator, in `~/.profile` or your session environment:

```sh
export QT_QPA_PLATFORMTHEME=qt5ct   # qt6ct for Qt 6-only sessions
```

**The style sheet's asset paths must be absolute.** Qt resolves `url()` against the application's
working directory, not against the style sheet, so the relative paths as generated only work for a
program started from this directory. Rewrite them once on install:

```sh
sed -i "s|url(assets/|url($PWD/assets/|g" Halon.qss Halon-Dark.qss
```

Without this the check boxes and radio buttons lose their glyphs — the fills and borders still
render, so the failure is quiet rather than obvious.

## Install with Nix

The flake exposes `packages.<system>.halon-qt-theme`, which installs the schemes where qt5ct and
qt6ct already look (`share/qt5ct/colors`, `share/qt6ct/colors`) and rewrites the style sheet's asset
paths to absolute store paths for you:

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope:
  home.packages = [ halon.packages.${pkgs.system}.halon-qt-theme ];
}
```

The style sheet lands at `<store path>/share/halon/qt/Halon.qss`; give qt5ct that path.

## How the guide maps onto Qt

- **`Window` is the frame, `Base` is content.** §6.4's recessed chrome and §6.2's raised views land
  exactly on Qt's own split: `Window` takes `surface-secondary`, `Base` takes `surface-default`, and
  every unstyled widget therefore falls on the correct side of that line without a rule.
- **The frame (§6.4)** is `QMenuBar`, `QToolBar` and `QStatusBar` — `surface-navigation` with
  `text-on-navigation` labels, `surface-navigation-hover` on hover. A tool button inside the frame
  takes the frame's label colour; elsewhere it is an ordinary flat button on `text-secondary`.
- **Three button weights (§6.1).** `QPushButton` is the bordered ghost, `QPushButton:default` is the
  one filled accent action — Qt marks it, so the theme never has to guess — and `QToolButton` is the
  flat weight that grows a border on hover rather than a fill, because a fill swap can paint out an
  independently coloured icon.
- **Selected rows (§6.5)** are a solid `accent` fill with `text-on-fill`; inactive selection is the
  same fill at 30% alpha with body text, not a second colour.
- **Toggles (§6.2)** keep `border-control` and are drawn from the same glyph geometry as the GTK and
  Cinnamon indicators, so the checkmark curve is identical across every Halon implementation.
- **`Highlight` is the accent, `ToolTipBase` is the frame** — tooltips belong to the chrome (§6.6),
  and `Shadow` is slate-900 in both schemes, per §5.

## Known limits

- **The combo box arrow is the base style's.** §6.3's hazard is that overriding a control's
  background erases the arrow the base style painted, so the combo box is left to draw its own; it
  takes the palette and stays in range. The spin box and the tree branch could not be left that way
  — restyling their box drops the arrow's button with it, and what survives is a bare glyph laid out
  against a box it no longer fits. Both therefore restate their geometry and draw the shared
  chevron, which is also why the branch arrow has a selected variant: the indent takes the accent
  fill with the rest of the row, and the muted glyph is 1.7:1 on it.

- **Indicators need the SVG image plugin.** The check, radio, chevron and branch glyphs are SVGs, so
  an application whose `QT_PLUGIN_PATH` omits `qtsvg` renders every one of them empty — borders and
  fills still paint, so the failure is quiet. Most packaged Qt applications already carry it.
- **KDE applications are only partly covered.** Plasma reads its own colour scheme format
  (`.colors`), not qt5ct's, so a Plasma session needs that file instead. This port targets the
  qt5ct/qt6ct path, which is what non-Plasma desktops use.
- **Qt 5 and Qt 6 need separate scheme files.** Qt 6.6 added `QPalette::Accent`, making a Qt 6
  scheme 22 roles where a Qt 5 one is 21, and a file of the wrong length is rejected rather than
  padded. That is the only difference between the two directories.
