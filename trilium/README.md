# Halon for Trilium

An implementation of [THEME-DESIGN-GUIDE.md](../THEME-DESIGN-GUIDE.md) for
[Trilium Notes](https://github.com/TriliumNext/Trilium), built on its `next` theme base. The token
set, the on-colour split and the audited contrast ratios are the guide's — nothing is re-decided
here.

```
trilium/
  _rules.css    Layer 2 — SOURCE. Trilium's variables, assigned to tokens. No colours.
  halon.css     GENERATED. The token layer plus _rules.css, as one CSS note.
```

`halon.css` is written by `scripts/build-trilium.mjs` from the same
`gtk/Halon/shared/_tokens-*.css` that drives the GTK, Cinnamon, VS Code and greeter ports. Edit
`_rules.css` or the tokens, never the generated file.

```sh
node scripts/build-trilium.mjs           # regenerate halon.css
node scripts/build-trilium.mjs --check   # fail if the output is stale
```

The build also fails if a colour literal appears in `_rules.css`, which is what keeps §2's two-layer
rule enforced in a port whose two layers ship as one file.

## Install

Create a **CSS code note** anywhere in your tree, paste in `halon.css`, and give the note these
labels:

```
#appThemeBase=next   #appTheme=Halon
```

Then pick **Halon** under Options → Appearance → Theme. The theme follows the operating system's
colour scheme, because the `next` base it sits on does.

## Install as an addon

The theme is packaged for the [Trilium Addon Manager](https://github.com/BeatLink/trilium-scripts)
as `halon@beatlink`. That manifest does not vendor a copy — its stylesheet note points at this
file's raw URL in this repository, pinned to a commit, so the addon and the theme cannot drift
apart. Bumping the pin is a command in that repository:

```sh
node resources/scripts/tamhelper.js bump-halon        # move the pin to Halon's current main
node resources/scripts/tamhelper.js bump-halon --check # fail if the pin has fallen behind
```

## How the guide maps onto Trilium

- **The navigation frame (§6.4)** is the launcher rail, the tab bar, the application toolbars and
  the status bar: `surface-navigation` — the secondary surface — with `text-on-navigation` at rest
  in both schemes. The active tab is a raised card on it, carried by the lift, `text-heading` and
  an accent icon rather than by its fill.
- **The note tree (§6.5)** is a navigation sidebar, so the selected note is a raised
  `surface-default` card with `shadow-item`, not an accent bar. The solid accent fill is kept for
  rows you *pick* — the highlighted entry in a dropdown or in jump-to-note — which is what
  `--active-item-*` drives.
- **Buttons (§6.1)** get all three weights. Trilium drives `.btn-primary`, `.btn-secondary`,
  `.btn-sm` and `.btn-success` from one set of `--cmd-button-*` variables, so those carry the
  default weight (transparent, hairline border, body text, border to accent on hover) and the
  filled weight is separated out by selector. `.btn-success` takes the accent rather than a second
  filled colour: a confirming button is *the* action on its dialog, and two filled colours mean
  neither reads as primary.
- **Inputs (§6.2)** carry the resting hairline, moving to the accent on hover and focus, and the
  fill never changes. Check boxes and radios keep `border-control`, since a toggle's boundary is
  the whole control.
- **Selects (§6.3)** are ghosts: transparent, accent text, opacity-only hover. The open option list
  stays an ordinary readable panel.
- **Badges (§6.7)** take the status tokens, with the two informational ones on `text-secondary` and
  "execute" on the single off-ramp violet. Alert bars are a 15% `color-mix` tint of the warning
  token rather than a solid fill.

## Trilium-specific mechanics

Six things about this host that the port has to work around, and the guide's §8 covers five of them
because they were found here first.

- **Every declaration carries `!important`.** With `#appThemeBase=next`, Trilium appends the base
  stylesheets *after* the custom theme and redeclares many of the same variables on an
  equal-specificity plain `:root`. Without `!important` the base simply wins. Where the base itself
  uses `!important` — the `:active` state of a command button — the override adds a `:root` prefix
  to outrank it, because at equal specificity the later sheet takes it.
- **`border: unset` is a literal, not a variable.** Text inputs, selects and buttons all get it from
  `forms.css`, so a `border-color` override on `:hover` has nothing to recolour. The resting
  `border` shorthand has to be declared first (§8, dead `border-color` overrides).
- **Selects and text inputs share `--input-background-color`.** Ghosting the closed select through
  variables would ghost every text field with it, so §6.3's treatment needs real selectors. The
  `background-color` longhand is deliberate: the base paints the dropdown arrow with a `background:`
  shorthand that a shorthand override would erase.
- **A badge's text colour is typed into the component.** `Badge.css` sets `color: white` rather than
  reading a variable — §3.5's single-on-colour failure, which costs nothing in light mode and fails
  on every fill in dark, where they all lighten. `_rules.css` puts `text-on-fill` back.
- **Note colours are clamped in Lab.** A note's `#color` label is converted and its lightness capped
  so it stays legible against the tree. The base's cap of 60 is aggressive enough that `gold` and
  `lime` render as dark olive; §8's figures — 78 light, 58 dark — keep the hue close to true with a
  legibility margin left.
- **`--icon-button-size` is Trilium's name too.** It uses it as a per-component local, redefining it
  a dozen times, so §4.1's token of that name is the one the port leaves out rather than declaring a
  root value that is shadowed everywhere.

One thing stays off the token set: the three popup shadows the base composes itself, out of neutral
black and a bare `--dropdown-shadow-opacity`. The depth is put on §5's ladder by feeding that
variable the floating role's alpha, but no variable carries the colour, so those three keep the
base's black instead of §5's slate-900.
