# Halon for LightDM

The Halon theme as a [web-greeter](https://github.com/JezerM/web-greeter) theme — a LightDM greeter
that draws its login screen with QtWebEngine, so the theme is plain HTML, CSS and JavaScript. It
also runs under the older `lightdm-webkit2-greeter` API, which uses the same `window.lightdm` object
and the same `GreeterReady` event.

| File | |
| --- | --- |
| `index.yml` | web-greeter's theme manifest |
| `index.html` | the login screen's structure; icons are inline SVG, so nothing is fetched |
| `tokens.css` | **generated** Layer 1 — the only file here that may hold a colour |
| `style.css` | Layer 2 — components from §6, metrics from §4, not one literal |
| `greeter.js` | everything that talks to LightDM, and nothing that decides how it looks |
| `preview/mock.js` | development only, never installed — a stand-in for the greeter object |

```sh
node scripts/build-lightdm.mjs           # regenerate tokens.css
node scripts/build-lightdm.mjs --check   # fail if it is stale, or if a colour leaked into Layer 2
nix run .#preview-lightdm                # open the greeter in a browser against the mock
```

The layer split is the point: `build-lightdm.mjs` reads `gtk/Halon/shared/_tokens-*.css` — the same
Layer 1 the GTK, Cinnamon, Qt, VS Code and Firefox ports read — and refuses to build if `style.css`,
`index.html` or `greeter.js` contains a colour literal. Edit the tokens or the mapping in the
script, never `tokens.css`.

## Both schemes, one theme

A greeter has no session to ask, so the scheme follows `prefers-color-scheme` and the toggle in the
bottom-right corner overrides it in either direction — the §7 arrangement the demo uses. The choice
is remembered in `localStorage`, which on a locked-down seat may only survive until reboot.

`light-dark()` is deliberately not used: the QtWebEngine that ships with some Qt 6 builds predates
it, and a greeter that renders unstyled is a machine you cannot log into.

## What it shows

- The clock, the user, and the machine's hostname.
- A user select, but only when the seat has more than one user and LightDM has not set `hide-users`.
- A session select, but only when there is more than one session to pick.
- Suspend, hibernate, restart and shut down, each shown only when LightDM reports it is permitted.
- Battery level, when the greeter can read it.

Prompts and messages come from LightDM verbatim — PAM decides what the field is called, so a seat
using a fingerprint reader or a one-time token relabels the field on its own.

## Install

```nix
# flake.nix inputs: halon.url = "github:BeatLink/Halon";
services.xserver.displayManager.lightdm.greeters.default.enable = ...;
environment.systemPackages = [ halon.packages.${system}.halon-lightdm-theme ];
```

The package installs to `share/web-greeter/themes/halon`. web-greeter only scans its own prefix, so
point it at the theme by name in `/etc/lightdm/web-greeter.yml`:

```yaml
greeter:
  theme: halon
```

To try it without installing anything, `nix run .#preview-lightdm` stages the theme in a temporary
directory with `preview/mock.js` enabled and opens it in the default browser. The mock's password is
`justice`.
