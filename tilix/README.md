# Halon for Tilix

Two color schemes built from the tokens in `THEME-DESIGN-GUIDE.md` §3: `Halon.json` (light) and
`Halon-Dark.json`.

## Install

```sh
mkdir -p ~/.config/tilix/schemes
cp tilix/*.json ~/.config/tilix/schemes/
```

Then pick the scheme in Tilix under Preferences → your profile → Color → Color scheme.

## Install with Nix

The flake exposes the schemes as `packages.<system>.halon-tilix-theme`, installing them under
`share/tilix/schemes/` so Tilix finds them through `XDG_DATA_DIRS`. Add the package to
`home.packages` (home-manager) or `environment.systemPackages` (NixOS):

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope:
  home.packages = [ halon.packages.${pkgs.system}.halon-tilix-theme ];
}
```

Or link the files into the user config dir directly, which needs no package on the profile:

```nix
xdg.configFile."tilix/schemes/Halon.json".source = "${halon}/tilix/Halon.json";
xdg.configFile."tilix/schemes/Halon-Dark.json".source = "${halon}/tilix/Halon-Dark.json";
```

To try it without installing: `nix build github:BeatLink/Halon#halon-tilix-theme` and copy the JSON
out of `result/share/tilix/schemes/`.

## Token mapping

| Tilix setting | Token |
| ------------- | ----- |
| Background | `--surface-default` (terminals are editor surfaces) |
| Foreground | `--text-body` |
| Cursor | `--accent` fill with `--text-on-fill` text |
| Selection | `--accent` behind `--text-on-fill` (§6.2 text selection) |
| Badge | `--badge-experimental` |

ANSI colors take the status and accent tokens per mode: red is `--status-danger`, green is
`--status-success`, blue is `--accent`, magenta is `--badge-experimental`, and black/white slots come
off the slate text ramp (`bright black` is `--text-tertiary`, the placeholder tier, so dimmed shell
text stays AA-legible). Light-mode yellow is `--status-warning-text`, not the amber fill — the fill
is 2.15:1 on white and unreadable as text (§3.6); in dark mode the fill works as a mark and is used
directly.

Cyan has no Halon token, so both schemes derive it from the same Tailwind cyan ramp the palette is
built on, picked to clear 4.5:1 against the scheme background (cyan-700 on light, cyan-400 on dark).
Bright variants sit one step along each hue's ramp — lighter in dark mode, darker in light mode,
since a brighter mark on white loses legibility.
