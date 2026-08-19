# Halon for Plymouth

A boot splash on the Halon dark scheme: the Halon mark pulsing at 40% height on `--surface-root`
(`#060b14`), boot status messages directly beneath it, and a 6px progress bar at 62% height with a
`--border-default` trough (`#334155`) and a `--accent` fill (`#60a5fa`).

The theme uses Plymouth's `two-step` module. `MessageBelowAnimation=true` places anything sent with
`plymouth display-message` in the gap between the mark and the bar; the boot-up mode leaves messages
unsuppressed so those actually show, while shutdown and reboot stay quiet.

The pulse is generated at build time from `logo.svg`: 360 frames of a cosine opacity sweep between
1.0 and 0.35. Plymouth plays throbber frames at 30fps, so the cycle takes 12 seconds. Password
dialogs use the `entry`/`bullet`/`lock`/`capslock` assets, drawn to the dark-scheme input treatment
(`--surface-default` fill, `--border-control` boundary).

Build it with `nix build .#halon-plymouth-theme`; the package installs to
`share/plymouth/themes/halon` with `ImageDir` rewritten to its store path.
