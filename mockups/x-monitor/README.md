# X-Monitor dashboard mockups

Three chart-first dashboard pages drawn in Halon's dark tokens for X-Monitor, using the monitors of
a real homelab with sample values:

| File | Page |
| --- | --- |
| `Main.dc.html` | One host: gauges, multi-series charts, meters, SMART tiles, reachability strips |
| `Services.dc.html` | A host's services: unit tiles, share bars, latency lines, folder progress |
| `Fleet.dc.html` | The whole fleet: host tiles, IoT uptime strips, backup heatmap, deploy timeline |

`canvas.json` lays the three pages out side by side.

These are the source files of a claude.ai Design canvas, kept here so they outlive the
[published copy](https://claude.ai/artifact/2vmLxUdqzMjcRnCdVPXUG8), which is private. They use
that canvas's runtime (`support.js`, `<x-dc>` templates and `{{holes}}`), so they do not render
when opened directly in a browser. To view them, publish them to a Design canvas, or
read the markup: every color, size and radius is written inline.

X-Monitor has since built most of these widgets on Halon's tokens; see its `core/ui/charts.py` and
the Charts section of its `halon.css`.
