# Halon for VS Code

The Halon theme as a VS Code extension: `Halon Light` and `Halon Dark`. Both scheme files under
`themes/` are generated from the shared token files — the same Layer 1 that drives the GTK,
Cinnamon and web implementations — by `scripts/build-vscode.mjs`. Edit the mapping in that script
or the tokens in `gtk/Halon/shared/`, never the JSON.

```sh
node scripts/build-vscode.mjs           # regenerate both schemes
node scripts/build-vscode.mjs --check   # fail if the output is stale
```

## Install

Symlink this directory into the extensions folder and reload VS Code:

```sh
ln -s "$(pwd)/vscode" ~/.vscode/extensions/halon.halon-theme-1.0.0
```

Then pick **Halon Light** or **Halon Dark** in *Preferences: Color Theme*.

## How the guide maps onto VS Code

- **The navigation frame (§6.4)** is the activity bar, title bar, tab bar, status bar, debug
  toolbar, banners and notifications — `surface-navigation` with `text-on-navigation` at rest in
  both schemes. The active tab is the only light element in the frame.
- **The side bar and panels (§6.5)** sit on `surface-secondary`; the editor and terminal sit on
  `surface-default`; row hover is `border-default`; accent-soft selections carry `text-on-light`.
- **Text selection and focus (§6.8)** both use `focus-ring`, so they read as one system.
- **Diagnostics (§3.6)** use `status-warning-text` for warning squiggles and icons — marks, not
  fills — while the status-bar warning chip is a true `status-warning` fill with `text-on-light`.
- **Debugging** turns the status bar `badge-experimental`, the §6.7 badge for experimental modes.

## Syntax colors

The guide predates syntax highlighting, so the layer is built from §1.1's constraints: slate
carries structure, weight carries hierarchy, and semantic colors keep their meaning.

- Comments: `text-tertiary`, italic.
- Keywords and storage: `accent`.
- Defined names (functions, types, classes): `text-heading`, bold — weight, not a new hue.
- Literals (strings, numbers, constants): `badge-experimental`, the §3.4 off-ramp violet.
- Operators and punctuation: `text-secondary`; everything else: `text-body`.
- `status-danger` and `status-warning-text` appear only where they mean something: invalid code,
  deprecations, diff markup.

The integrated terminal's 16-color ANSI ramp is read from the Tilix schemes in `tilix/` at build
time, so every terminal Halon ships renders CLI output identically.
