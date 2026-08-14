# Halon for Firefox

The Halon theme as a Firefox static theme. `manifest.json` and `icon.svg` are generated from the
shared token files — the same Layer 1 that drives the GTK, Cinnamon, Tilix and VS Code
implementations — by `scripts/build-firefox.mjs`. Edit the mapping in that script or the tokens in
`gtk/Halon/shared/`, never the JSON.

```sh
node scripts/build-firefox.mjs           # regenerate manifest.json and icon.svg
node scripts/build-firefox.mjs --check   # fail if the output is stale
```

Both schemes ship in one extension: `theme` is the light variant and `dark_theme` the dark one.
Firefox picks between them from *Settings → General → Language and Appearance → Website appearance*
and the surrounding light/dark setting, so there is nothing to switch by hand.

## Install

Temporarily, for testing — the theme is unloaded when Firefox closes:

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…**, and pick this directory's `manifest.json`.

Permanently, a release build is signed by Mozilla and installs like any other add-on — see
*Releasing* below. To roll one by hand instead, either install the zip into an
unbranded/Developer/Nightly build with `xpinstall.signatures.required = false`, or sign it yourself
through [addons.mozilla.org](https://addons.mozilla.org/developers/):

```sh
npx web-ext@10 build --source-dir firefox --ignore-files README.md userChrome.css
```

## Releasing

[`.github/workflows/firefox-release.yml`](../.github/workflows/firefox-release.yml) lints, packages
and signs the theme, then attaches the signed `.xpi` to a GitHub release. It is driven by a tag
named for this port, because every port here versions independently:

```sh
# bump VERSION in scripts/build-firefox.mjs, then
node scripts/build-firefox.mjs
git commit -am "Firefox theme 1.0.1"
git tag firefox-v1.0.1 && git push --tags
```

The workflow refuses to publish if `node scripts/build-firefox.mjs --check` reports the manifest is
stale, if the contrast audit fails, or if the tag and the manifest version disagree — a signed build
of a stale manifest is worse than none, because it looks authoritative.

It needs two repository secrets, both from
[the AMO key page](https://addons.mozilla.org/developers/addon/api/key/): `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET`. The default channel is `unlisted`, which returns a self-hostable signed `.xpi`
immediately; run the workflow manually with **channel: listed** to submit it to the public
addons.mozilla.org listing for review, which returns no file and so attaches nothing. A manual run
defaults to not signing at all, so a fork without the secrets can still lint and package.

## Install with Nix

The flake exposes the theme as `packages.<system>.halon-firefox-theme`, installing the unpacked
extension under `share/halon/firefox/`:

```nix
{
  inputs.halon.url = "github:BeatLink/Halon";

  # then, with halon in scope:
  home.packages = [ halon.packages.${pkgs.system}.halon-firefox-theme ];
}
```

## Geometry — `userChrome.css`

A theme extension can set colors and nothing else: no height, no radius, no padding. §4 of the guide
is explicit that a port with the right palette and the wrong geometry reads as the host toolkit
wearing the colors, so the metrics live in `userChrome.css` — 34px frame, 28px tabs, one 32px
control height for the address bar, and the radius ladder. It names **no colors at all**; the only
color references in it are Firefox's own LWT variables, which the manifest above populates.

It is a source file rather than a generated one for that reason: there is no Layer 1 in it to
substitute.

```sh
# find the profile directory in about:support → Profile Directory
mkdir -p ~/.mozilla/firefox/<profile>/chrome
cp firefox/userChrome.css ~/.mozilla/firefox/<profile>/chrome/
```

Then set `toolkit.legacyUserProfileCustomizations.stylesheets` to `true` in `about:config` and
restart. This half is optional — the manifest theme stands on its own, it just runs at Firefox's
default density.

## How the guide maps onto Firefox

- **Firefox is a standalone application**, so §6.4 applies in its first form: the tab strip and the
  navigation toolbar are *the frame*, `surface-navigation` in both schemes — a gray strip in light,
  near-black in dark — with `text-on-navigation` at rest and `surface-navigation-hover` on hover.
- **The selected tab is a raised card, not a light block.** Its `surface-default` fill is only
  1.10:1 against the frame in light mode and 1.23:1 in dark, by design: §6.4 selects by elevation,
  so selection is carried together by the lift, the label going to `text-heading`, and the `accent`
  tab line. Firefox draws all three, which is why the tab reads as selected at a glance despite the
  fill being a whisper.
- **The address bar stays inside the frame.** It takes `surface-navigation-hover` with
  `text-heading`, not a `surface-default` field: a field the colour of content reads as content, and
  the frame stops being one strip. §6.2's behaviour is preserved — the fill does not change on hover
  or focus, only the border moves, to `accent`.
- **Popups, menus and the urlbar results list (§6.6)** are a normal content surface:
  `surface-default` with `text-body`, a `border-default` hairline, and `surface-secondary` behind
  `text-heading` for the highlighted row.
- **The sidebar (§6.5)** sits on `surface-secondary` — the same value as the frame, since they do
  the same job — with a solid `accent` selection carrying `text-on-fill`.
- **The new tab page** is `surface-root` with `surface-default` cards: recessed page, raised
  content, in both schemes.

## Contrast

Every pair this port introduces beyond the guide's §10 table, measured against WCAG 2.1:

| Foreground | Background | Light | Dark |
| ---------- | ---------- | ----- | ---- |
| `--text-heading` (address bar text) | `--surface-navigation-hover` | 14.48 | 16.50 |
| `--text-on-navigation` (frame at rest) | `--surface-navigation` | 6.92 | 8.46 |
| `--accent` (focused field border) | `--surface-navigation-hover` | 4.19 | 6.79 |
| `--accent` (tab line, attention icons) | `--surface-navigation` | 4.72 | 7.75 |

The last two are boundary and graphical elements, held to 3:1 rather than 4.5. Everything else —
`text-heading` on the selected tab, `text-on-fill` on the `accent` sidebar selection,
`text-on-fill` on the `accent` urlbar highlight, `text-body` on the popup and new tab
surfaces — is a pairing §10 already audits.
