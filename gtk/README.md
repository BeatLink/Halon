# Halon for GTK

An implementation of [THEME-DESIGN-GUIDE.md](../THEME-DESIGN-GUIDE.md) as a GTK 3 and
GTK 4 / libadwaita theme. The token set, the on-colour split, and the audited contrast
ratios are the same ones the guide specifies — nothing is re-decided here.

## Layout

```
Halon/
  index.theme
  shared/
    _tokens-light.css     Layer 1 — the only file with literal colours
    _tokens-dark.css      Layer 1 — same names, different values
    _components.css       Layer 2 — widget rules, tokens only
    _adwaita-map.css      libadwaita named colours, assigned to tokens
  gtk-3.0/
    gtk.css               tokens-light + components
    gtk-dark.css          tokens-dark  + components
  gtk-4.0/
    gtk.css               tokens-light + adwaita map + components
    gtk-dark.css          tokens-dark  + adwaita map + components
```

The guide's two-layer rule survives the port intact: a scheme is one import line, and
`_components.css` is byte-identical between light and dark.

## How this differs from the CSS version

GTK CSS is not web CSS, and three of the guide's mechanisms have no direct equivalent:

- **No `var()`, no `light-dark()`.** GTK uses `@define-color name value` and `@name`.
  The two schemes are therefore two files rather than one file plus a media query.
- **No `prefers-color-scheme`.** GTK picks `gtk-dark.css` when the application or the
  desktop asks for dark, via `gtk-application-prefer-dark-theme` or the
  `org.gnome.desktop.interface color-scheme` setting.
- **No `color-mix()`.** GTK's `alpha(@colour, 0.15)` does the same job for the tinted
  regions in §6.7, and `mix()` and `shade()` exist for the rest.

One GTK-specific hazard, which the linter checks for: **`@define-color` resolves in
source order.** An alias defined before its target — `border-focus: @accent` above the
line defining `@accent` — is a parse error GTK reports only as a runtime warning. The
alias therefore sits at the end of the interaction block, not with the other borders.

## Install

The theme is installed through Nix, under `share/themes/Halon` on the profile. Edits to the
repository are **not** live: rebuild and switch before a change reaches a running session.

To test without a rebuild, point GTK at the working tree for one session:

```sh
mkdir -p ~/.themes && ln -sfn "$PWD/gtk/Halon" ~/.themes/Halon
```

`~/.themes` is searched ahead of the profile, so the symlink shadows the installed copy until it is
removed. Applications pick the change up on restart.

**GTK 3** — select the theme:

```sh
gsettings set org.gnome.desktop.interface gtk-theme Halon
```

**GTK 4 and libadwaita** — libadwaita ignores `GTK_THEME` and installed themes by
design. The supported route is a user stylesheet:

```sh
mkdir -p ~/.config/gtk-4.0
ln -sf ~/.nix-profile/share/themes/Halon/gtk-4.0/gtk.css ~/.config/gtk-4.0/gtk.css
```

Point that at `gtk-dark.css` instead for the dark scheme, or keep both and switch the
symlink. Applications that follow the system preference also need:

```sh
gsettings set org.gnome.desktop.interface color-scheme prefer-dark
```

## Test

```sh
nix develop            # or: nix-shell

preview-gtk3           # GTK 3 widget factory, light
preview-gtk3 dark      # GTK 3 widget factory, dark
preview-gtk4           # libadwaita demo, light
preview-gtk4 dark      # libadwaita demo, dark
```

The preview commands build a throwaway `XDG_DATA_HOME` (GTK 3) or `XDG_CONFIG_HOME`
(GTK 4) pointing at the working tree, so they test uncommitted edits without touching
the installed theme or the running desktop.

## Verify

```sh
halon-audit            # every sanctioned pairing, both schemes, against WCAG 2.1
halon-audit --render   # the above, plus heights measured in a headless Firefox
halon-lint             # undefined tokens, literals outside Layer 1, import order
```

`halon-audit` reads the GTK token files as the source of truth and cross-checks them
against `theme-demo.html` and against the design guide's own §3.1, §3.2 and §3.8 tables,
so the guide, the demo and the theme cannot drift apart. A token added to the theme and
not written into the guide fails the audit, and so does a guide value that no longer
matches.

It holds §4 to the same standard: the metric tokens in §4.1 must match the demo's `:root`
name for name, every cell of §4.3's component table must match what the demo's rule
actually declares, and every gap and margin in the demo must land on the 4px scale.

`--render` adds the check no amount of reading can do — it serves the demo to a headless
Firefox, has the page measure itself, and compares the result against §4.3's heights. That
is what catches a control whose height a fallback font or an unset `line-height` has
quietly changed. It needs `firefox` on `PATH` and takes a few seconds, so the plain run
stays the one suitable as a pre-commit hook; both exit non-zero on failure.

## Coverage

Themed: window and view surfaces, headerbar and its buttons, notebook tabs, buttons
including suggested and destructive variants, linked groups, entries and spin buttons,
combo boxes and menu buttons, check, radio and switch, scales, progress and level bars,
sidebars, lists, tree and column views, popovers, menus, tooltips, dialogs, info bars,
scrollbars, panes, frames, status bars, text views, calendars.

Icons: `index.theme` names the `Halon` icon theme (`Halon-Dark` in the dark metatheme),
a thin overlay on Colloid that lives in `icons/` — see [icons/README.md](../icons/README.md).
Keep Adwaita installed alongside it: Colloid inherits hicolor and breeze rather than
Adwaita, so it has no Adwaita fallback of its own. Cursors are still Adwaita.

Not themed: window manager decorations beyond what GTK draws, and application-specific
stylesheets.
