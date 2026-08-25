# Halon for LMMS

The Halon theme for LMMS. `Halon/style.css` is generated from the shared token files — the same
Layer 1 that drives the GTK, Cinnamon, Tilix, VS Code, Firefox and Qt implementations — by
`scripts/build-lmms.mjs`. Edit the mapping in that script or the tokens in `gtk/Halon/shared/`,
never the style sheet.

```sh
node scripts/build-lmms.mjs           # regenerate lmms/Halon/style.css
node scripts/build-lmms.mjs --check   # fail if the output is stale
```

## What an LMMS theme is

A directory holding a `style.css` and any artwork that overrides LMMS' stock set. LMMS puts the
chosen directory ahead of its own default theme on both of its resource search paths and falls
back for every file the directory does not carry, so a theme that only recolours needs nothing but
the style sheet.

That sheet is a Qt style sheet with one addition: LMMS exposes its canvas colours — the piano roll
grid, clip fills, meter thresholds, key caps — as `qproperty-*` declarations on its own widget
classes. Those are the parts a plain Qt theme cannot reach, and they are most of what makes a DAW
look themed rather than recoloured, so they are all named here.

The theme also ships 23 recoloured PNGs, built in the Nix derivation rather than checked in: the
images whose stock colour is LMMS' green. They are remapped by luminance rather than by hue —
desaturate, stretch, then tint — which keeps the artwork's shading and lands the whole ramp on a
token. Lit artwork (LCD digits, pressed keys, step buttons, sliders) goes to `--accent`; knob
bodies are control surfaces, so they go to `--border-control` and leave the accent to the indicator
line the style sheet colours.

## Dark only

LMMS' stock artwork — knobs, LEDs, LCD digits, faders, key caps, roughly 290 images — is drawn for
a dark host. A light scheme would need every one of them redrawn rather than recoloured, so this is
the one Halon implementation that ships a single scheme, as the Plymouth and LightDM themes do for
their own reasons.

## Install

Copy the theme somewhere LMMS can read, then point LMMS at it under **Edit → Settings → Paths →
Theme directory** and restart. That is how LMMS installs any theme; there is no theme picker.

**LMMS discards the setting if its config file predates the running LMMS.** On startup it compares
the `version` attribute in `~/.lmmsrc.xml` against its own major and minor version, and resets the
theme directory to the default when they differ — old themes broke the UI across releases. After an
LMMS upgrade, expect to set the path once more.

## Install with Nix

The flake exposes the theme as `packages.<system>.halon-lmms-theme`, installing it under
`share/lmms/themes/Halon/`:

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope:
  home.packages = [ halon.packages.${pkgs.system}.halon-lmms-theme ];
}
```

The home-manager module adds an option that installs the package and exports `LMMS_THEME_PATH`:

```nix
themes.halon.lmms = true;
```

**`LMMS_THEME_PATH` covers the style sheet, not the artwork.** LMMS prepends it to the search path
the style sheet uses and to nothing else; icons and images resolve against the configured theme
directory alone. The variable is what makes `nix run .#preview-lmms` work against the working tree,
and it gets you the whole colour scheme — but the recoloured LCDs and knobs still need the path set
in Settings.

## Token mapping

| Part | Token |
| ---- | ----- |
| Desk behind the editor windows | `--surface-root` |
| Toolbars, sidebar, track controls, sub-window title bars | `--surface-navigation` (§6.4) |
| Piano roll, automation editor, song and pattern grids | `--surface-default` (§6.2) |
| Grid lines, beat lines, bar lines | `--border-default` → `--border-hover` → `--border-control` |
| Notes, playing keys, loop range, selection | `--accent` |
| Fader peak ramp | `--status-success` → `--status-warning` → `--status-danger` |
| Every knob's indicator line | `--accent` |

**The four clip kinds are the one deviation from §1.** They are categories rather than states, so
painting them in the status colours would make a sample clip read as a warning. They take the
theme's four remaining hues instead — MIDI `--syntax-string`, sample `--syntax-number`, automation
`--badge-experimental`, pattern `--syntax-type` — which leaves `--accent` free to mean selection
everywhere, including on a clip. §3.7 reserves the syntax hues for code; a DAW timeline is the
other place in this palette that genuinely needs a set of distinguishable non-semantic hues, and
reusing them beats minting four literals outside the token set.

**Every plugin's knobs are the same colour.** LMMS ships a per-plugin palette — pink for SoundFont,
orange for AudioFileProcessor, red for NES — which §1 does not allow. The style sheet keeps each
plugin's knob *geometry*, since those values are drawn against artwork, and collapses the colours
onto the accent. Sfxr and SID paint their panels in light tones, so their knobs take
`--text-on-light` instead.
