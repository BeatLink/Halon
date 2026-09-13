# Halon for Steam

The Halon theme for the Steam client, as a [Millennium](https://steambrew.app) theme. The shipped
sheets are generated from the same token files that drive the GTK, Cinnamon, Qt, Tilix, VS Code and
Firefox ports — edit `steam/src/` or the tokens in `gtk/Halon/shared/`, never the generated CSS.

```sh
node scripts/build-steam.mjs             # regenerate skin.json and the sheets
node scripts/build-steam.mjs --check     # fail if the output is stale
node scripts/build-steam.mjs --refresh   # re-check selectors against an installed client
```

Steam's client is a Chromium view, so unlike the Cinnamon and LMMS ports this one keeps the two-layer
rule in the shipped artifact: each generated sheet opens with a `:root` block holding the whole token
set as `--halon-*` custom properties, and nothing below it names a colour. Both schemes live in that
one block as `light-dark()` pairs.

## Install

Millennium first — it is the loader; this theme is just files it reads.

**NixOS.** Millennium ships its own flake, and Steam has to be launched through it:

```nix
# flake.nix
inputs.millennium.url = "github:SteamClientHomebrew/Millennium?dir=packages/nix";

# configuration.nix
nixpkgs.overlays = [ inputs.millennium.overlays.default ];
programs.steam = {
  enable = true;
  package = pkgs.millennium-steam;
};
```

**Other distributions.** Arch has [an AUR package](https://aur.archlinux.org/packages/millennium);
everywhere else uses the shell installer. Flatpak and Snap installations of Steam are not supported
by Millennium.

```sh
curl -fsSL "https://steambrew.app/install.sh" | bash
```

Then put this directory where Millennium looks for themes and pick it from *Steam → Millennium →
Themes*:

```sh
ln -s "$PWD/steam" ~/.steam/steam/steamui/skins/Halon
```

A symlink rather than a copy is worth it during development: Millennium re-reads the sheets when
Steam reloads, so `node scripts/build-steam.mjs` and a client reload is the whole edit loop. Note
that the themes directory lives *inside* `steamui`, which Steam replaces wholesale when it updates
itself, so expect to recreate the link after a client update.

### Install with Nix

The flake exposes the theme as `packages.<system>.halon-steam-theme`, installing the whole theme
directory under `share/halon/steam/`:

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope:
  home.packages = [ halon.packages.${pkgs.system}.halon-steam-theme ];
}
```

It is not wired into the home-manager module, because the only place Millennium will read a theme
from is a directory Steam itself owns and rewrites on update; linking it there is a step that has to
survive Steam, not home-manager.

## Light and dark

*Millennium → Themes → Halon → Edit* has one setting, **Color scheme**: `Dark`, `Light`, or `System`.
It sets a single variable, `--halon-color-scheme`, and the whole `light-dark()` palette follows.

The default is `Dark` rather than `System` on purpose. Steam has no light mode of its own, so every
corner of the client this theme does not reach stays dark; in `Light` those corners read as holes.
Light is complete for everything listed under *Coverage* below and worth using if you run a light
desktop — just expect the seams.

## The naming problem, and what `--refresh` is for

Steam builds its client CSS from CSS modules, so nearly every class in the main window is a content
hash — `_3Z7VQ1IMk4E3HsHvrkLNgo` is the top bar. A stylesheet written against those reads as noise,
and it rots silently: when Steam rebuilds a module the hash changes, the rule stops matching, and
nothing anywhere says so.

So the sources here are written against names — `%TopBar%`, `%GameListEntry%`,
`%ContextMenuItemSelected%` — and [`selectors.json`](selectors.json) holds the mapping. The names are
not invented: Steam ships its own CSS-module maps in its JavaScript bundles, where minification
leaves them as `Name:"hash"` pairs, so every entry in that file records the name Steam gives the
class alongside the hash it currently resolves to.

`--refresh` re-derives those candidates from an installed client (`$STEAM_ROOT`, or
`~/.local/share/Steam`) and checks every entry against them, then exits non-zero listing the ones
that moved. It deliberately does not rewrite a hash by itself: a name like `Container` belongs to
dozens of unrelated modules, so which candidate is the game list row is a judgement, not a lookup.
It tells you what broke and where to look.

A name that resolves to several hashes is the other case — one component Steam compiled into several
bundles, the context menu being the clearest example. Those expand to `:is(.a, .b, .c)`, which keeps
a single class's specificity and still works inside a compound selector.

## Coverage

**The main window.** The title bar, window controls and the Store/Library/Community strip as one
frame; the game list, its search bar and its rows in every state; the library's content pane and
section headers; and every context menu.

**The control layer.** Buttons, text fields, selects, check boxes, radios, toggles, sliders, progress
bars, modals, scrollbars, focus rings and the whole settings dialog. These come from the one
stylesheet Steam still ships unhashed, so this layer covers the most of the client and is the part
least likely to break.

**The friends list and chat**, which is also unhashed throughout.

**The store and community pages** — page ground, the global header, panels, links, buttons,
discounts and the footer.

Three things it does not cover, each for a reason:

- **Big Picture.** It is a second design rather than a second skin of this one — ten-foot layout,
  controller focus, its own type scale — and a recolour would leave it neither. Millennium simply
  finds no `bigpicture.custom.css` to inject.
- **Store artwork.** Capsules, trailers, promotional banners and per-campaign takeovers are content
  and inline styles, not chrome. `webkit.css` themes the page around them.
- **A game's own page in the library**, beyond its panels. Steam renders it over artwork the game
  ships; the theme paints the panels on top of that, not the artwork behind it.

## How the guide maps onto Steam

- **Steam is a standalone application**, so §6.4 applies in its first form: the title bar and the
  navigation strip are *the frame*, `surface-navigation` in both schemes. Steam paints them as three
  strips in three near-blacks with inset highlights between them; §6.4 is explicit that a strip of
  another colour between a title bar and a toolbar is the tell of a frame member that got missed, so
  all three collapse onto one value and the highlights go.
- **Store, Library and Community are tabs**, and the selected one is a raised card carrying all
  three of §6.4's signals: the lift, the label at heading weight, and the accent line Steam already
  draws under it.
- **The game list is a sidebar** (§6.5) on `surface-secondary`, the same surface as the frame above
  it. A selected game is a raised card rather than an accent fill — it is a place you are, not a row
  you picked.
- **Every gradient goes.** Steam fades slate into near-black on the game list, the library pane, the
  friends list, the chat window and every context menu; §1 builds structure from a three-step surface
  scale and hairlines instead, so each one is replaced by the flat surface it was fading between.
- **Play is a primary action, not a green one.** Steam gives Play, Install and Resume a green
  gradient and its dialogs a blue one. §6.1 spends the accent on the one primary action per view and
  nothing else, so all of them become the same filled accent button.
- **Presence is the one place the friends list earns a second hue** (§1). Online, in a game and
  offline are states a person is in rather than decoration, so they take the accent,
  `status-success`, and secondary text — and Steam's other six presence colours go.
- **Discounts keep a fill** for the same reason: a discount is a status, and a positive one.

## Contrast

Every pair this port introduces beyond the guide's §10 table, measured against WCAG 2.1:

| Foreground | Background | Light | Dark |
| ---------- | ---------- | ----- | ---- |
| `--status-success` (a friend in a game) | `--surface-secondary` | 5.01 | 7.77 |
| `--status-success` (an installed game) | `--surface-default` | 5.48 | 6.31 |
| `--text-secondary` (channels, muted rows) | `--surface-navigation-hover` | 6.15 | 11.63 |
| `--status-danger` (the chat tab's close glyph) | `--surface-secondary` | 4.41 | 7.12 |

The last is a graphical element, held to 3:1 rather than 4.5. Everything else — `text-on-fill` on the
accent and on `status-success`, `text-on-navigation` on the frame, `text-heading` on the frame's
hover and on a raised card, `border-control` on the default surface — is a pairing §10 already
audits.

Two of §10's own near-threshold notes shaped rules here rather than being worked around:

- **Muted text never sits on the secondary surface.** An uninstalled game, an offline friend and a
  friend-group count are all `text-secondary` rather than `text-tertiary`, because tertiary on that
  surface is 4.34 in light mode. Tertiary survives only where §10 sanctions it: placeholder text on
  a field's default-surface fill, at 4.76.
- **A status colour and a hover fill never appear together.** On the frame's hover fill the accent
  lands at 4.19 and `status-success` at 4.45, both under the 4.5 a name has to clear, so a hovered
  row's label goes to `text-heading` — §6.1's collapsing-hover hazard in its text form. The state
  itself stays visible: the download glyph in the game list, the avatar's status strip and the line
  under the name in the friends list.
