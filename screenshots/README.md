# Screenshots

Current renders of every Halon deliverable. All GTK captures come from the
reproducible pipeline; the Cinnamon shell cannot run headless, so its captures
are cropped from the live session.

## Surface architecture shown here

- **Shell panel** — the frame (`surface-navigation`), one step back from content in both schemes
- **Window chrome** — headerbars, toolbars, menu bars, tab strips on
  `surface-secondary`, selection as a raised white card
- **Content** — `surface-default` white
- **Transients** — notifications, tooltips, OSDs keep the frame colours

## Files

| File | What | Source |
| ---- | ---- | ------ |
| `demo-light.png`, `demo-dark.png` | The reference HTML demo, both schemes | Firefox headless |
| `gtk3-light.png`, `gtk3-dark.png` | GTK 3 widget factory | `halon-shots` |
| `gtk4-light.png`, `gtk4-dark.png` | GTK 4 widget factory | `halon-shots` |
| `gtk3-light-hover.png` | Hover state: border moves, background never | `halon-shots` |
| `gtk3-light-dropdown.png` | Open combobox list | `halon-shots` |
| `gtk3-light-focus.png` | Focused entry: accent border + translucent ring | `halon-shots` |
| `nemo-light.png` | A real application under the theme | Xvfb, manual |
| `cinnamon-menu.png` | Main menu applet | live session crop |
| `cinnamon-calendar.png` | Calendar applet popup | live session crop |
| `cinnamon-notification.png` | Notification banner (a floating frame surface, per §6.6) | live session crop |
| `cinnamon-panel.png` | The panel — the frame itself | live session crop |

## Regenerating

```sh
nix develop
halon-shots               # gtk3/gtk4 sets, light+dark, plus interaction states
```

The demo pages: load `theme-demo.html` in a browser and use its scheme control,
or headless:

```sh
firefox --headless --window-size=1680,1400 --screenshot demo-light.png theme-demo.html
```

Cinnamon captures need the live session: `cinnamon-screenshot -f out.png`,
with popups opened via looking-glass Eval (see the session notes in the repo
history) or by hand. Crop to shell UI before committing.
