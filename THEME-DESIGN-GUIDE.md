# Halon — App Theme Design Guide

A complete, framework-agnostic specification for a **slate + single-blue** application theme with a
recessed navigation frame, ghost-first controls, and hairline structure. It defines a token set, a
palette, component treatments, and a dark mode built by flipping thirty-one values. Every
foreground/background pair it specifies meets WCAG 2.1 AA, verified in both schemes.

Nothing here is tied to a particular UI framework. Section 3 is the whole token set; adopt it
directly, or map it onto whatever theming variables your framework already exposes.

**Naming conventions used throughout.** Token and class names are spelled out — no abbreviations, no
initialisms. `--surface-secondary`, not `--bg-2`. `.button`, not `.btn`. Names describe what a thing
is *for*, never what it looks like: a token is `--status-danger`, never `--red`, and
`--surface-secondary`, never `--surface-recessed` — because the accent could be recolored and the
secondary surface is darker than the default one in light mode but lighter in dark. An appearance
name is a name that will eventually lie.

---

## 1. Design principles

1. **One accent, one hue family.** The theme is slate plus a single blue. Semantic colors (success,
   warning, danger) exist only to carry meaning, never decoration. If a color is not slate, blue, or
   a status signal, it does not belong — with two bounded exceptions, both of which are places the
   interface is displaying someone else's content rather than its own: a three-hue syntax ramp for
   code (§3.7) and the fixed sixteen-slot terminal palette (§3.8). Neither is reachable from a
   component rule.
2. **Flat surfaces, hairline separation.** Structure comes from 1px borders and a three-step surface
   scale, not from shadows. Shadows appear only where an element genuinely floats.
3. **Three button weights, and the accent is the scarcest.** Filled accent for the one primary
   action, a neutral bordered button for ordinary actions, and a borderless button for repeated or
   incidental ones that grows a border on hover. Accent fill marks *the* action on a view; if two
   things are filled, neither reads as primary.
4. **The frame is recessed, the content is raised.** Navigation rails, tab bars, toolbars and
   sidebars all sit on the secondary surface — one step *back* from the content surface in both
   schemes — and the selected thing in them is a raised card, not an accent bar. The frame is a
   quiet gray strip in light mode and a near-black one in dark; what makes a selection unmissable
   is elevation and the accent line, never a block of color.
5. **Everything routes through the token set.** No component rule names a literal color. Dark mode is
   implemented by re-declaring thirty-one tokens and nothing else.
6. **Contrast is a property of the token set, not of individual rules.** Every pairing the theme
   sanctions is audited (§10). A token whose only safe pairing is unstated is a defect in the palette.

---

## 2. Token architecture

Two layers, strictly separated:

```
Layer 1 — theme tokens      ← the only place literal colors appear
Layer 2 — component rules   ← always var(--token), never a literal
```

**The rule that makes this work:** a Layer 2 value must never contain a hex, and there are no
exceptions. Text sitting on a colored fill is the case that tempts one — it is obviously white, so
why tokenize it? Because it is not obviously white: a fill light enough to need near-black text
exists in this palette, and in dark mode most of them do. Three tokens cover it (§3.5).

**One layer of names, not two.** An earlier draft split palette tokens (`--palette-text-secondary`)
from semantic tokens (`--text-secondary`). Once both were named by role, the split produced pairs of
near-identical aliases — a lookup hop that bought nothing, and enough drift that the root surface
ended up with a different name in each layer. A literal scale layer underneath semantics
(`--blue-600` → `--accent`, as Radix and Primer do) is a real pattern, but it earns its keep at nine
shades per hue and several accents. This theme has thirty-six tokens, one accent, and two colors that
sit on no scale at all. One layer is correct here.

**Mapping onto a framework.** If your framework exposes its own theming variables, do not restyle its
components — assign its variables to these tokens once, at the top of the sheet, and let everything
downstream follow:

```css
:root {
  --framework-main-background:  var(--surface-default);
  --framework-main-text:        var(--text-body);
  --framework-active-tab-color: var(--text-heading);
  /* …one line per framework variable… */
}
```

That mapping is a translation table, not a third layer. It contains no colors and no decisions.

---

## 3. The tokens

### 3.1 Definitions

```css
:root {
  /* Surfaces — a two-step ladder (recessed, raised), plus the frame's hover and the overlay */
  --surface-root:              #f1f5f9;  /* behind everything */
  --surface-default:           #ffffff;  /* cards, panels, editors, modals */
  --surface-secondary:         #f1f5f9;  /* sidebars, the frame, footers, fills */
  --surface-navigation:        var(--surface-secondary);  /* rails, tab bars, toolbars */
  --surface-navigation-hover:  #e2e8f0;  /* hover on the frame and in sidebars */
  --surface-overlay:           rgba(15, 23, 42, 0.45);

  /* Shell chrome — a desktop panel and its overlays, see §6.4 */
  --surface-shell:             var(--surface-secondary);
  --surface-shell-hover:       #e2e8f0;
  --surface-shell-card:        var(--surface-default);  /* the raised item on the panel */

  /* Text on surfaces */
  --text-heading:              #0f172a;
  --text-body:                 #1a1a2e;
  --text-secondary:            #475569;  /* secondary text, icons, section labels */
  --text-tertiary:             #64748b;  /* placeholders, shortcut hints */
  --text-on-navigation:        #475569;  /* frame labels and icons at rest */

  /* Text on fills — one token per class of fill, see §3.5 */
  --text-on-fill:              #fff;     /* fills that invert: accent, success, danger */
  --text-on-light:             #0f172a;  /* fills light in both modes: warning */

  /* Lines */
  --border-default:            #e2e8f0;  /* decorative hairlines: cards, dividers, table rules */
  --border-hover:              #cbd5e1;
  --border-control:            #8792a3;  /* toggle boundaries (check, radio, switch); must clear 3:1 */
  --border-focus:              var(--accent);

  /* Interaction */
  --accent:                    #2563eb;  /* links, buttons, focus — the only accent */
  --focus-ring:                rgba(37, 99, 235, 0.15);  /* also: text selection */

  /* Syntax — code only, see §3.7 */
  --syntax-type:               #0e7490;
  --syntax-string:             #15803d;
  --syntax-number:             #a16207;

  /* Status */
  --status-success:            #047857;
  --status-warning:            #f59e0b;  /* the fill; bright in both schemes, see §3.5 */
  --status-warning-text:       #c2410c;  /* the same status as an icon, dot, bar, or word */
  --status-danger:             #dc2626;
  --badge-experimental:        #7c3aed;  /* the one off-ramp hue, see §3.4 */

  /* Elevation — slate-900 at a per-role alpha, see §5 */
  --shadow-base:               #0f172a;  /* the hue every shadow is drawn in */
  --shadow-card:               rgba(15, 23, 42, 0.08);
  --shadow-item:               rgba(15, 23, 42, 0.12);
  --shadow-tab:                rgba(15, 23, 42, 0.15);
  --shadow-floating:           rgba(15, 23, 42, 0.20);
  --shadow-modal:              rgba(15, 23, 42, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-root:              #060b14;
    --surface-default:           #16213a;
    --surface-secondary:         #060b14;
    --surface-navigation-hover:  #101b2d;
    --surface-overlay:           rgba(0, 0, 0, 0.6);

    --surface-shell:             #16213a;  /* navy, not the frame's near-black — it floats on wallpaper */
    --surface-shell-hover:       #1f2c4a;
    --surface-shell-card:        #2a3a5e;

    --text-heading:              #f8fafc;
    --text-body:                 #e2e8f0;
    --text-secondary:            #cbd5e1;
    --text-tertiary:             #94a3b8;
    --text-on-navigation:        #ffffff;  /* the frame is near-black here, so its label is pure white */

    --text-on-fill:              #0b1220;  /* dark-mode fills are light, so this inverts */

    --border-default:            #334155;
    --border-hover:              #475569;
    --border-control:            #64748b;

    --accent:                    #60a5fa;
    --focus-ring:                rgba(96, 165, 250, 0.28);

    --syntax-type:               #22d3ee;
    --syntax-string:             #4ade80;
    --syntax-number:             #fcd34d;

    --status-success:            #10b981;
    --status-warning-text:       #f59e0b;  /* on dark ground the fill colour works as-is */
    --status-danger:             #f87171;
    --badge-experimental:        #a78bfa;

    /* Same hue, roughly triple the alpha — a slate shadow on near-black needs it */
    --shadow-card:               rgba(15, 23, 42, 0.27);
    --shadow-item:               rgba(15, 23, 42, 0.50);
    --shadow-tab:                rgba(15, 23, 42, 0.50);
    --shadow-floating:           rgba(15, 23, 42, 0.60);
    --shadow-modal:              rgba(15, 23, 42, 0.70);
  }
}
```

Thirty-six tokens; dark mode re-declares thirty-one. The five it leaves alone are the ones that
carry no mode: `--text-on-light` sits on fills whose lightness does not change between schemes,
`--status-warning` is the one fill that is already light in light mode, `--shadow-base` is the
shadow hue and is slate-900 in both, and `--surface-navigation` and `--border-focus` are derived
from other tokens, so they flip for free.

The shadow tokens are spelled here as colors, because that is the form every framework can hold. A
CSS implementation stores the whole `box-shadow` in them instead and gains one role the color form
cannot express — `--shadow-code`; §5 covers both shapes and why they differ.

### 3.2 Reference

| Token                          | Light                   | Dark                     | Role                                     |
| ------------------------------ | ----------------------- | ------------------------ | ---------------------------------------- |
| `--surface-root`             | `#f1f5f9`             | `#060b14`              | Application root, behind everything      |
| `--surface-default`          | `#ffffff`             | `#16213a`              | Cards, panels, editors, modals           |
| `--surface-secondary`        | `#f1f5f9`             | `#060b14`              | Sidebars, the frame, footers, fills      |
| `--surface-navigation`       | = secondary           | = secondary            | Navigation rail and tab bar base         |
| `--surface-navigation-hover` | `#e2e8f0`             | `#101b2d`              | Frame and sidebar hover                  |
| `--surface-shell`            | = secondary           | `#16213a`              | Desktop panel and its overlays           |
| `--surface-shell-hover`      | `#e2e8f0`             | `#1f2c4a`              | Hover on the shell panel                 |
| `--surface-shell-card`       | = default             | `#2a3a5e`              | The raised item on the shell panel       |
| `--surface-overlay`          | `rgba(15,23,42,.45)`  | `rgba(0,0,0,.6)`       | Modal backdrop                           |
| `--text-heading`             | `#0f172a`             | `#f8fafc`              | Headings, active and selected labels     |
| `--text-body`                | `#1a1a2e`             | `#e2e8f0`              | Body text                                |
| `--text-secondary`           | `#475569`             | `#cbd5e1`              | Secondary text, icons, section labels    |
| `--text-tertiary`            | `#64748b`             | `#94a3b8`              | Placeholders, shortcut hints             |
| `--text-on-navigation`       | `#475569`             | `#ffffff`              | Text and icons on the frame at rest      |
| `--text-on-fill`             | `#fff`                | `#0b1220`              | Text on a solid accent or status chip    |
| `--text-on-light`            | `#0f172a`             | `#0f172a`              | Text on a fill that is light in both     |
| `--border-default`           | `#e2e8f0`             | `#334155`              | Decorative hairlines                     |
| `--border-hover`             | `#cbd5e1`             | `#475569`              | Hover borders, scrollbar thumb           |
| `--border-control`           | `#8792a3`             | `#64748b`              | Input and select boundaries              |
| `--border-focus`             | `var(--accent)`       | `var(--accent)`        | Focused field border                     |
| `--accent`                   | `#2563eb`             | `#60a5fa`              | The single accent: links, buttons, focus |
| `--focus-ring`               | `rgba(37,99,235,.15)` | `rgba(96,165,250,.28)` | Focus outline, text selection            |
| `--syntax-type`              | `#0e7490`             | `#22d3ee`              | Types and classes, in code only          |
| `--syntax-string`            | `#15803d`             | `#4ade80`              | String literals, in code only            |
| `--syntax-number`            | `#a16207`             | `#fcd34d`              | Numbers and constants, in code only      |
| `--status-success`           | `#047857`             | `#10b981`              | Positive status only                     |
| `--status-warning`           | `#f59e0b`             | `#f59e0b`              | Caution fills: chips, tints              |
| `--status-warning-text`      | `#c2410c`             | `#f59e0b`              | Caution icons, dots, bars, words         |
| `--status-danger`            | `#dc2626`             | `#f87171`              | Destructive actions, errors              |
| `--badge-experimental`       | `#7c3aed`             | `#a78bfa`              | One off-ramp badge                       |
| `--shadow-base`              | `#0f172a`             | `#0f172a`              | The hue every shadow is drawn in         |
| `--shadow-card`              | `rgba(15,23,42,.08)`  | `rgba(15,23,42,.27)`   | Cards, backdrop windows                  |
| `--shadow-item`              | `rgba(15,23,42,.12)`  | `rgba(15,23,42,.50)`   | Selected list and sidebar items          |
| `--shadow-tab`               | `rgba(15,23,42,.15)`  | `rgba(15,23,42,.50)`   | Active tab                               |
| `--shadow-floating`          | `rgba(15,23,42,.20)`  | `rgba(15,23,42,.60)`   | Popovers, menus, tooltips, windows       |
| `--shadow-modal`             | `rgba(15,23,42,.25)`  | `rgba(15,23,42,.70)`   | Modals                                   |

The ramp is Tailwind's slate and blue scales, with two deliberate departures:

- **`--text-body` (`#1a1a2e`) is off-ramp.** A slightly warm near-black rather than slate. Headings
  use true slate-900, so body text sits a hair *softer* than headings instead of matching them.
- **The dark scheme's near-black (`#060b14`) is off-ramp.** It sits below slate-950 and reads
  navy rather than neutral, which is what keeps a dark frame from looking like a hole in the
  screen. It is one value doing three jobs there — root, secondary surface, and frame.

### 3.3 One thing flips direction, and one deliberately does not

**Secondary and tertiary text swap positions on the ramp.** Light: secondary is slate-600, tertiary
the lighter slate-500. Dark: secondary is slate-300, tertiary the darker slate-400. The invariant is
that **secondary is always the more legible of the two** — the names carry the rule and the hex
values follow them, not the reverse. Do not "fix" this by keeping the values parallel across modes.

Both sit one step darker (light) and one step lighter (dark) than the obvious slate choices, because
the obvious ones fail: slate-400 tertiary reaches only 2.56 against white, and tertiary carries
placeholders and shortcut hints, which are informational text and subject to the 4.5 threshold. The
shifted ramp keeps a visible hierarchy while clearing AA at every step.

**The secondary surface stays recessed, and that is the point.** In light mode it is `#f1f5f9`
against a white default — darker, set *into* the page. In dark mode it is `#060b14` against a
`#16213a` default — darker again. Both schemes say the same sentence, "content raised above a
recessed frame": light is white cards on a gray page, dark is lifted cards on a near-black one.

An earlier version of this palette had the secondary surface change sides, sitting *above* the
default surface in dark mode, on the theory that dark interfaces signal elevation by getting
lighter. They do — but the frame was a separate near-black token then, so the rule only had to
cover sidebars. Once the frame and the sidebar became one surface (§6.4), a lifted secondary would
have meant the chrome floating above the content it wraps, which is the wrong relationship in
either scheme.

The root sits level with the secondary surface in both schemes (`#f1f5f9` and `#060b14`), with all
separation between them coming from borders. Only two levels carry elevation: recessed and raised.
Note that this is *not* a licence to name them for their appearance — `--surface-secondary` is
darker than the default surface in both of today's schemes, but "darker" is a fact about the values,
not about the job.

### 3.4 Off-ramp hues

Reserve exactly one *for the interface*: a violet for a stateful badge that would otherwise collide
with the status colors — "executable," "beta," "experimental." It appears in exactly one place. That
is the precedent for adding a hue outside slate, blue, and status: a single badge that must not read
as success, warning, or danger.

The syntax ramp (§3.7) and the terminal palette (§3.8) are not off-ramp hues under this rule, because
they are not the interface coloring itself — they color a document the interface is showing. The test
is whether a component can reach for the hue. Nothing can ask for `--syntax-string` outside an editor
or for slot 11 outside a terminal; a badge asking for violet is exactly the decision this section
rations.

It still gets a token, and it still flips (`#7c3aed` → `#a78bfa`). A one-off hue pinned to a single
value would be the only fill in the theme that takes white text in dark mode, and that exception
would have to be remembered by every future reader. Flipping it costs one line and keeps the rule in
§3.5 universal.

### 3.5 Two tokens for text on fills

`--text-on-fill` and `--text-on-light` look redundant. They are not, and collapsing them into a
single "on-color" is the most likely way to reintroduce a contrast failure.

A fill's text color is determined by the fill's lightness, and this theme has two classes of fill
that behave differently across schemes:

| Class | Light mode | Dark mode | Token |
|---|---|---|---|
| Fills that invert — accent, success, danger, experimental | Dark → white text | Light → near-black | `--text-on-fill` |
| Fills light in both — warning | Light → near-black | Light → near-black | `--text-on-light` |

Only the first class inverts, which is why only it appears in the dark block. The important negative
result: **one token cannot serve both.** Reusing white everywhere fails on every dark-mode fill by a
wide margin — `#fff` on dark-mode success is 2.54 — and reusing the near-black everywhere fails on
the light-mode fills in the first class, where `#0f172a` on the accent is 3.45.

**Surfaces are not fills, and they take ordinary text.** The frame used to be a third class here,
back when it was dark navy in both schemes and needed a white-in-both token of its own. It is now
the secondary surface (§6.4), so its text comes off the normal ramp — `--text-on-navigation` at
rest, `--text-heading` on hover — and the third on-color is gone. If some future element is
genuinely dark in both schemes, it needs a token of its own, not white typed into a component
rule.

**Why warning is in the second class rather than the first.** Amber is intrinsically light. Nothing
that still reads as yellow or orange reaches 4.5 against white — amber-500 is 2.15, amber-600 is
3.19, orange-600 is 3.56, and the first step that clears the bar is amber-700 at 5.02, which no
longer looks like a warning. It looks brown. Forcing a hue into the white-text class when its
lightness will not support it is how palettes end up with muddy status colors. Warning stays a bright
amber (`#f59e0b`, the same value in both schemes) and takes near-black text, at 8.31 — a wider margin
than any of the dark candidates managed with white. Yellow chips carry dark text in every major
design system for exactly this reason.

Success has no such conflict — green stays green when darkened — so it sits in the first class at
emerald-700, one step below the `-600` a Tailwind palette suggests, reaching 5.48 against white.

### 3.6 Why warning has a second token

`--status-warning` is bright enough to be a good fill and too bright to be anything else. On white it
is 2.15:1, so the moment the same status is drawn as an icon, a status dot, a progress bar, or the
word "warning," it becomes invisible. That is the same one-token-two-jobs failure as §3.5, and it
gets the same answer: split it.

| Role | Token | Light | Dark |
| ---- | ----- | ----- | ---- |
| Fill behind text — chips, tints | `--status-warning` | `#f59e0b` (8.31 with `--text-on-light`) | `#f59e0b` (8.31) |
| Shape or text on a surface — icons, dots, bars, labels | `--status-warning-text` | `#c2410c` (5.18) | `#f59e0b` (7.45) |

Orange-700 is the light-mode text value rather than amber-700 because it is both more chromatic —
burnt orange rather than brown — and higher contrast, clearing 4.5 even against the secondary
surface, where amber-700 lands at 4.58 and amber-600 fails outright at 2.91.

In dark mode the two collapse to the same value: on dark ground the bright fill color is already
7.45:1 as an icon, so no second step is needed. The split exists solely because light mode cannot
have one amber that is both a legible fill and a legible mark.

**A third option for solid shapes: state the value in text.** A progress bar or meter is the awkward
case — it wants to look bright, but its contrast partner is its own track, and bright amber is 1.96:1
against a `--surface-secondary` one. The cheapest fix is not a color change at all:

```html
<div class="progress-label"><span>Disk usage</span><span>34%</span></div>
<div class="progress"><div class="progress-fill progress-fill-warning" style="width:34%"></div></div>
```

1.4.11 governs graphics *required to understand the content*. A bar whose value is printed beside it
is redundant reinforcement, not the sole carrier of the information, so the fill can be any
brightness. Print the number and the problem dissolves — and the component is better for it anyway,
since a bar alone never communicates a precise value.

Where you genuinely cannot show a number, the alternatives, in order of how much they cost:

| Approach | Effect |
| -------- | ------ |
| Outline the fill — `inset 0 0 0 1px var(--status-warning-text)` | Keeps the fill bright; reads as fussy at small bar heights |
| Near-black trough — `background: var(--text-heading)`, light mode only | Clears 3:1 for every fill (3.26–8.31); a heavy look on a light card |
| Dim the fill to `--status-warning-text` | Compliant and plain, but discards the brightness |

Two results worth keeping if you take the trough route. **A mid-slate track is the worst possible
choice** — it has to clear 3:1 against dark fills *and* a light one, sits between them, and fails
both: `#8792a3` scores 1.64 on the accent and 1.47 on warning, worse for every fill than the pale
track it replaced. And **in dark mode no single track value works at all**: the track must be 3:1
darker than fills reaching L 0.36, capping it at L ≤ 0.087, and 3:1 lighter than a near-black
surface, requiring L ≥ 0.15. The interval is empty, so a dark-mode trough always needs a hairline.

For marks too small for any of this — a status dot, a 13px glyph — use `--status-warning-text`
directly.

Success and danger need no equivalent. Emerald-700 is 5.48 against white and red-600 is 4.83, so both
work as marks and as fills from a single token. Only the intrinsically light hue needs two.

### 3.7 Syntax is the one place that needs more than one hue

Everything above holds the palette to slate, one blue, and status. Code is where that stops working,
and it is worth being precise about why: the rest of the interface colors *state* — a thing is
selected, failing, disabled — and state is mutually exclusive, so one accent can carry it. Syntax
colors *category*, and categories are simultaneous. A line of code shows a keyword, a type, a call,
a string and a number at once, all in the neutral state. With a single accent, four of those five
collapse into the body ramp, and the file reads as a wall of near-black with occasional blue.

So syntax gets its own small ramp — code only, never chrome:

| Token | Light | Dark | Role |
| ----- | ----- | ---- | ---- |
| `--syntax-type` | `#0e7490` | `#22d3ee` | Types, classes, interfaces, enums, namespaces |
| `--syntax-string` | `#15803d` | `#4ade80` | String literals and regular expressions |
| `--syntax-number` | `#a16207` | `#fcd34d` | Numbers, constants, booleans, enum members |

Three, not more, and the rest of the mapping comes from tokens that already exist: keywords take
`--accent`, comments `--text-tertiary` in italic, operators and punctuation `--text-secondary`,
variables and parameters `--text-body`. Defined names — functions and methods — stay `--text-heading`
in bold, because weight says "declared here" in a way hue cannot, and that reading is only
unambiguous now that types have moved off it.

**This is the conventional role mapping, not an invention.** Green strings, warm numbers, a cool
type hue and grey italic comments are what the TextMate lineage settled on and what nearly every
widely used theme still follows. The one deliberate departure is keywords: the convention puts them
in purple, and here they are blue, because Halon has exactly one accent and §3.4's violet is spoken
for. Blue keywords beside a teal type is the arrangement VS Code's own default theme uses, so the
substitution is well-trodden.

**Why these are not the status tokens.** Green and amber already exist as `--status-success` and
`--status-warning`, and reusing them for strings and numbers is the §3.5 mistake in a new place: a
token means one thing, and an editor showing a hundred string literals per screen would make green
mean "a string" far more often than it means "this passed." The syntax hues are also chosen a step
away from their status neighbours — `#a16207` is yellow-brown where `--status-warning-text` is the
redder `#c2410c` — so a number and a warning are not the same mark.

**The rule this replaces.** §3.4 reserves one off-ramp hue for one badge. Before this section
existed, the syntax mapping had quietly spent that violet on every string, number, constant and enum
member in every file, which is the widest violation of the one-place rule the theme could contain.
`--badge-experimental` is back to the badge.

### 3.8 The terminal palette is a fixed sixteen, not a token set

A terminal emulator does not ask the theme what a color means. Programs write `\e[31m` and the
emulator paints slot 1, so the theme's only move is to decide what the sixteen slots contain. This is
the second and last place the palette exceeds slate, blue and status — and unlike syntax (§3.7) it is
not a choice about how many hues are warranted, it is a fixed-width interface the theme has to fill.

Nine of the sixteen are tokens the theme already has. The base tier maps by meaning:

| Slot | Light | Dark | Token |
| ---- | ----- | ---- | ----- |
| 0 black | `#0f172a` | `#1e293b` | `--text-heading` / slate-800 in dark, see below |
| 1 red | `#dc2626` | `#f87171` | `--status-danger` |
| 2 green | `#047857` | `#10b981` | `--status-success` |
| 3 yellow | `#c2410c` | `#f59e0b` | `--status-warning-text` — the mark color, not the fill (§3.6) |
| 4 blue | `#2563eb` | `#60a5fa` | `--accent` |
| 5 magenta | `#7c3aed` | `#a78bfa` | `--badge-experimental` |
| 6 cyan | `#0e7490` | `#22d3ee` | `--syntax-type` |
| 7 white | `#cbd5e1` | `#cbd5e1` | `--border-hover` / `--text-secondary` in dark |
| 8 bright black | `#64748b` | `#94a3b8` | `--text-tertiary` — dimmed shell text stays AA-legible |
| 15 bright white | `#f8fafc` | `#f8fafc` | slate-50 |

The seven remaining are the bright tier, and they are the theme's second sanctioned departure from
the token set:

| Slot | Light | Dark | Ramp |
| ---- | ----- | ---- | ---- |
| 9 bright red | `#b91c1c` | `#fca5a5` | red-700 / red-300 |
| 10 bright green | `#065f46` | `#34d399` | emerald-800 / emerald-400 |
| 11 bright yellow | `#9a3412` | `#fbbf24` | orange-800 / amber-400 |
| 12 bright blue | `#1d4ed8` | `#93c5fd` | blue-700 / blue-300 |
| 13 bright magenta | `#6d28d9` | `#c4b5fd` | violet-700 / violet-300 |
| 14 bright cyan | `#155e75` | `#67e8f9` | cyan-800 / cyan-300 |

**Why these get no tokens.** A token exists so a component can ask for a role. Nothing in the theme
can ask for "bright red" — only a program writing `\e[91m` can, and it is not asking about state. The
bright tier is one step along each base hue's own Tailwind ramp, which makes it derived geometry
rather than seven new decisions: lighter in dark mode, *darker* in light, because a brighter mark on
white loses legibility rather than gaining emphasis. Every slot clears 4.5:1 against its scheme's
terminal background.

**Slot 0 is the one that cannot be a token.** In light mode it is `--text-heading`, the ordinary
near-black. In dark mode a near-black slot 0 would be invisible against the `#16213a` background, so
it is slate-800 — the one value in the palette chosen to be *seen* rather than to mean something.

The terminal background and foreground are ordinary tokens: `--surface-default` and `--text-body`,
because a terminal is an editor surface. Cursor and selection are `--accent` behind
`--text-on-fill`, matching text selection everywhere else (§6.8).

**Where it lives.** `tilix/Halon.json` and `tilix/Halon-Dark.json` hold the palette, and
`scripts/build-vscode.mjs` reads them for the editor's `terminal.ansi*` colors, so one ramp serves
both. A port needs the sixteen values above and nothing else.

---

## 4. Typography, space, and size

Color is only half the theme. Every metric below is part of the specification: a port that gets the
palette right and the geometry wrong does not look like this theme, it looks like the host toolkit
wearing its colors.

### 4.1 Metric tokens

```css
:root {
  --font-family-interface:
    system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Noto Sans", Cantarell, "Helvetica Neue", Arial, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji";
  --font-family-code: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;

  /* Spacing — a 4px scale. Nothing may use a value that is not on it. */
  --space-1:  2px;   /* badge padding, hairline gaps */
  --space-2:  4px;   /* icon to label */
  --space-3:  6px;   /* control inner vertical */
  --space-4:  8px;   /* related controls, list row padding */
  --space-5: 12px;   /* groups within a panel */
  --space-6: 16px;   /* panel padding */
  --space-7: 24px;   /* between sections */
  --space-8: 32px;   /* page margins */

  /* Geometry — one control height, so everything on a row aligns */
  --control-height:       32px;   /* the 16px line box + 7px padding + 1px border, doubled */
  --control-padding-x:    14px;
  --icon-button-size:     32px;   /* a control that happens to be square */
  --row-height:           28px;   /* list and tree rows, menu items, the status bar */
  --frame-height:         34px;   /* headerbars, tab bars, toolbars */
  --rail-width:           52px;
  --rail-button-size:     36px;   /* the one square that is not a control, see §4.2 */
  --icon-size-small:      16px;   /* menus, rows, toolbars — the dense default */
  --icon-size-large:      20px;   /* the navigation rail and floating actions */
  --sidebar-width:       248px;
  --border-width:          1px;
  --focus-ring-width:      3px;

  /* Radii — proportional to what they round */
  --radius-small:    4px;      /* anything you act on: controls, rows, chips */
  --radius-default:  8px;      /* any surface that holds them, the window included */

  /* Type scale */
  --text-label:    11px;       /* uppercase section labels, weight 600 */
  --text-caption:  12px;       /* captions, footers, shortcut hints */
  --text-control:  13px;       /* buttons, inputs, menus, list rows, tabs */
  --text-prose:    14px;       /* running prose */
  --text-h3:       15px;
  --text-h2:       19px;
  --text-h1:       26px;

  /* Tracking — uppercase micro-labels open up, large display type closes in.
     Everything else takes neither. */
  --letter-spacing-caps:    .04em;
  --letter-spacing-display: -.01em;

  /* The UI line box is a length, not a ratio: every height in §4.3 is this box
     plus padding plus borders, and a ratio would make each one font-dependent. */
  --line-height-ui:   16px;
  --line-height-body: 1.55;
  --measure:          68ch;    /* maximum prose line length */

  /* Layering — only the order means anything, so the values state the order and
     nothing else. 100 apart leaves a port room to slot a rung in without a rename. */
  --layer-sticky:    100;      /* sticky table headers */
  --layer-menu:      200;      /* context menus, popovers */
  --layer-modal:     300;      /* modal backdrop and the modal itself */
  --layer-toast:     400;      /* a toast has to clear a modal */
  --layer-tooltip:   500;      /* topmost: a tooltip can be raised from anything */

  /* Motion — two durations. Fast is a state answering a pointer; slow is a
     thing arriving, leaving, or travelling a distance. */
  --duration-fast:   .12s;
  --duration-slow:    .3s;
}
```

### 4.2 The rules that matter

**One control height.** Buttons, text inputs, selects, and combo boxes are all
`--control-height`. This is the single most visible metric in the theme: when a toolbar mixes a
34px button with a 30px entry, the row looks broken no matter how good the colors are. The 32px
figure is exact arithmetic, not a round number — a 16px line box, 7px above and below, and two 1px
borders.

**The line box is why `--line-height-ui` is a length.** A ratio cannot deliver a fixed height: 13px
at 1.2 is 15.6px in one font and something else in the next, and a control that leaves line-height
at `normal` — which is what an unstyled `<input>` does — comes out several pixels taller than the
button beside it. Pinning the box at 16px makes every height in §4.3 a sum of numbers the sheet
states, rather than a guess about font metrics. Declare it on every control, entries included, and
take the height itself from `--control-height` rather than trusting the padding to add up.

**There are four heights, and each is a different job.** `--control-height` for anything a pointer
aims at to act — button, entry, select, icon button; `--row-height` for anything that repeats down a
list — tree rows, tabs, menu items, and the status bar, which is a single row with a border on top;
`--frame-height` for the strip a row sits in; and `--rail-button-size` for the primary navigation
target, the one square that is deliberately larger than a control because it is the only thing on its
row and it is aimed at without looking.

Resist adding a fifth. An earlier draft of this table had seven heights inside a 9px band — a 30px
menu item, a 30px icon button, a 27px status bar — none of which had a token, a reason, or a
difference anyone could see, and one of which put a 30px square in the same toolbar row as a 32px
button, which is the exact defect the first rule in this section exists to prevent. A height with no
token is a height nobody decided on.

**Two radii, and the question is what a thing is, not how big it is.** `--radius-small` for anything
a pointer acts on: buttons, entries, selects, icon and rail buttons, rows, menu items, chips, check
boxes, keyboard keys, inline code, tooltips. `--radius-default` for any surface that holds them:
cards, panels, menu sheets, popovers, modals, toasts, code blocks, the content pane, and the window
itself. A header flush inside an already-rounded container takes `border-radius: 0` rather than a
third value.

The pairing is what makes it legible. A 4px control sitting on an 8px card states the nesting by
shape alone, in a theme that has already given up shadows and fills for that job — and it states it
the same way at every size, which a ladder keyed to size cannot. It also settles the cases that used
to need a rung of their own: a 28px row at 8px reads as a lozenge, and a menu item at 8px crowds the
corner of the 8px sheet it is inset in. Both are the same defect, and one rung answers both.

The window folds in rather than carrying its own. A 10px window corner against a wallpaper, next to
an 8px card seen at the same distance, was never a decision anyone could see — only a number to keep
in sync across five ports.

**There is no pill radius, and badges are chips.** A 9999px token is a tempting rung and a bad one:
it is not a radius at all but an instruction to round as far as the shape allows, so the same token
produces a capsule on a badge and a circle on anything square, and two decisions end up sharing one
name. Cutting it forces the distinction the theme actually wants. A badge takes `--radius-small`,
like every other small rectangle — a chip, not a lozenge, which also stops it competing with the
filled accent button for the eye. A round thing that is genuinely round says so with `50%`, which is
a shape, not a tier, and never appears on something that is not square. And a bar that wants to be a
capsule gets there by the rule below rather than by a token.

Tabs are the one interactive thing on the larger rung, and the theme had already decided why: a
selected tab is a raised card (§1.4, §6.4), not a highlighted strip. It carries the content below it,
so it rounds like the surface it introduces rather than like the control it also is.

Two rungs is the floor, and it took three passes to reach. Earlier drafts ran 4, 5, 6, 8 and 10 plus
a 9999px pill, and every rung that went was defended in prose that could not survive being asked what
the eye gained from it. A radius ladder wants to be shorter than it feels.

One family rounds *below* `--radius-small`, and it is the ladder's logic running off its bottom end
rather than an exception to it: a progress bar, a meter and a scrollbar thumb take 3px, which is
simply half their 6px thickness, the point at which a bar is a capsule. It gets no token because it
is not a value but a rule — half the thickness, whatever the thickness is — and a bar of another
size would compute its own.

One radius is computed rather than chosen: a block flush into a rounded container's bottom corners —
a menu's footer section, say — takes the container's *inner* radius,
`calc(var(--radius-default) - var(--border-width))`, because that is the curve the border actually
leaves behind.

The ladder matters more than any single value: keeping one radius across a 16px checkbox and a
600px window makes the small things look bulbous and the large ones look sharp.

**Spacing comes off the scale.** Every gap *between* things — stacked controls, groups in a panel,
sections on a page, the panel's own padding — is a `--space-*` value. The scale is deliberately
short — eight steps, no 10px, no 20px — because the alternative is a codebase where every panel is
padded slightly differently and no two agree.

**Element sizes come off the same grid.** A gap between things takes a `--space-*` token; a *size* —
the box of an icon, a dot, a thumb, a close button, a grid column's minimum — is not a gap and needs
no token of its own, but it is still a multiple of 4. A size that resolves through a token is
already governed — `--frame-height` is 34px because §4.3 says a frame is a row plus its surround, and
that is a decision with a paper trail. Only two kinds of bare number are allowed off the grid,
and both are produced by a rule rather than chosen by a person: a bar is 6px thick and its track
10px, per §4.3, and an inset falls out of the box it centres in — a 16px knob in a 24px track leaves
3px, and nobody picked the 3. A 15px icon, a 19px button or a 26px chip is none of those. It is a
number nobody decided, and it will be 1px out of step with everything around it forever.

**Layering is a ladder, and only the order on it means anything.** Five rungs, 100 apart:
`--layer-sticky` for a sticky table header, `--layer-menu` for context menus and popovers,
`--layer-modal`, `--layer-toast` because a toast has to clear a modal, and `--layer-tooltip` on top,
since a tooltip can be raised from anything including the other four. The gaps are uniform on
purpose. An earlier draft ran 60, 80, 90, 95 — where the reader cannot tell that the 20 between menu
and modal and the 5 between toast and tooltip mean exactly the same thing, which is "one rung." The
spare 99 between rungs is what lets a port slot its own layer in beside a host application's
stacking without renumbering anything.

Anything that stacks takes a rung. A sticky header with no `z-index` is not unlayered, it is layered
by the order it happens to sit in the document, which holds until the day something scrolls under it
and does not.

The padding *inside* a control is the exception, and §4.3 is its complete list. A 32px control
holding a 16px line box needs 7px above and below; what it needs left and right is whatever centers
the label optically, which lands on 11px for an input and 14px for a button. Those numbers fall out of
the one-control-height arithmetic above, so putting them on the 4px scale would mean giving up either
the height or the alignment. Treat §4.3 as closed: inside a component, use the value listed there;
anywhere else, use the scale.

### 4.3 Component metrics

`theme-demo.html` is the reference implementation, and `scripts/audit.mjs` parses this table back
and compares every cell against it, so the two cannot disagree for long. **Heights are normative:** a
port sets the height from the token and derives the padding, never the other way round — padding that
is left to add up on its own is exactly how a reference drifts four pixels from its own
specification. Enough to port without guessing:

| Component | Height | Padding | Radius | Text |
| --------- | ------ | ------- | ------ | ---- |
| Button | `--control-height` = 32px | `7px --control-padding-x` | small | 13px / 500 |
| Icon button | `--icon-button-size` = 32px square | — | small | — |
| Text input | `--control-height` = 32px | `7px 11px` | small | 13px / 400 |
| Textarea | grows from 80px | `7px 11px` | small | 13px / 400 |
| Select | `--control-height` = 32px | `7px 30px 7px --space-5` | small | 13px / 500 |
| List, tree row | `--row-height` = 28px | `--space-3 --space-4` | small | 13px |
| Menu item | `--row-height` = 28px | `--space-3 9px` | small | 13px |
| Menu sheet, popover | — | `5px` | default | — |
| Tab | `--row-height` = 28px | `--space-3 10px` | default | 13px |
| Card, panel | — | `14px --space-6` | default | — |
| Card header | — | `10px --space-6` | 0 | 12px / 600 caps |
| Table cell | — | `9px --space-5` | 0 | 13px |
| Badge | — | `--space-1 --space-4` | small | 11px / 600 |
| Toolbar, headerbar, tab bar | `--frame-height` = 34px | `0 --space-2` | 0 | — |
| Navigation rail | `--rail-width` = 52px wide | `--space-4 0` | 0 | — |
| Rail button | `--rail-button-size` = 36px square | — | small | — |
| Sidebar | `--sidebar-width` = 248px wide | `0 --space-4` | 0 | — |
| Status bar | `--row-height` = 28px | `5px --space-5 6px` | 0 | 12px |
| Scrollbar | 10px track, 6px thumb | 2px transparent border | 3px | — |
| Progress, meter | 6px | — | 3px | — |
| Content padding | — | `28px --space-8 80px` | — | — |
| Section gap | — | `--space-7 0` | — | — |

Every height above is the 16px line box plus the padding plus the borders: 16 + 7 + 7 + 1 + 1 = 32
for a control, 16 + 6 + 6 = 28 for a row, and 16 + 5 + 6 + 1 = 28 for the status bar, whose padding
is a pixel deeper below because its top border has already taken one from above. A frame is 34px whatever it holds, and the padding follows from its contents rather
than the other way round: a tab bar holding 28px tabs surrounds them with `--space-3` split above and
below, while a headerbar holding full-height 32px controls has only 1px left to give — which is why
the table's padding cell describes the tab bar and `--frame-height` is the part a port must match. The paddings that are not
on the 4px scale — 7px on a control, 11px on an entry, 80px of scroll slack under the content — are
the ones §4.2 sanctions: they are what centers a 16px box inside a 32px one, what optically centers
the text beside it, and what lets the last section scroll to the top of the viewport.

### 4.4 Density

**The theme is dense on purpose.** 32px controls, 28px rows, a 34px frame. It is built for
tool-shaped software — editors, consoles, file managers, anything where the window is full of
controls and the user is there all day. Screen space spent on padding is screen space not spent on
content.

This is a deliberate break from the platform defaults it sits next to. Adwaita runs roughly 34px
controls in a 46px headerbar, and its type is larger; those conventions are tuned for occasional use
and touch-adjacent hardware. Halon is tighter through the vertical, most of it won back from the
frame and from row padding rather than from the controls themselves.

**Density comes from type size and padding, not from shrinking hit targets.** This is the part that
is easy to get wrong. Dropping controls to 26px feels tighter for about a minute and then reads as
cramped, because the text inside stops having room to breathe and every control starts to look like
a chip. The 13px interface type and the 8px vertical padding are what make this compact; the 32px
target is what keeps it usable.

Density is not the same as cramped, and three things hold the line:

- **Hit targets stay honest.** A 32px control and a 28px row are both comfortable pointer targets,
  and icon buttons stay square at `--icon-button-size` rather than shrinking to the glyph.
- **Space between groups does not shrink.** The tightening is inside controls and between rows.
  Gaps between *sections* stay at `--space-7`, because that is what keeps a dense layout readable
  instead of undifferentiated.
- **Type size does not drop.** 13px controls and 14px prose. Shrinking text to gain density is the
  one move that trades legibility for it, and this theme does not make it.

Retargeting for touch is a two-token change, which is the point of tokenizing metrics at all: set
`--control-height` and `--icon-button-size` to 44px. Do not scale the type with them — larger touch
targets need more space, not bigger labels.

### 4.5 Typography notes

- **System font stack, deliberately.** Many application frameworks ship a bundled interface font
  (Inter is common). Overriding it back to the native stack is a large part of what distinguishes
  this theme from a recolor. Skip it and the theme reads as "stock, but blue."
- **Do not substitute a webfont for the native stack.** Naming a font that is not installed by
  default — Noto Sans, Inter, anything — means shipping it, which costs a bundled binary or a remote
  fetch, a flash of fallback text, and a hard failure under the strict content-security policies
  common in desktop application shells. It also defeats the point of the previous bullet.
- **Cover Linux explicitly.** `-apple-system` and `BlinkMacSystemFont` handle macOS, `Segoe UI`
  handles Windows, and `Roboto` handles Android and ChromeOS — leaving Linux to fall through to
  generic `sans-serif`, which fontconfig often resolves to DejaVu Sans: wide, loose, and visibly
  foreign to this theme. `system-ui` leads the stack because it resolves to the platform interface
  font everywhere including Linux; `Noto Sans` and `Cantarell` catch mainstream Linux desktops
  before the generic fallback. The trailing emoji faces keep emoji in titles and badges consistent
  across platforms. Broad script coverage needs no entry here — browsers fall back per glyph to
  whatever the operating system provides.
- **Interface text is 13px, prose is 14px.** Controls, menus, list rows, and tabs take
  `--text-control`; only running text takes `--text-prose`. Mixing the two is what makes an interface
  feel loose. The size token is `--text-prose`, not `--text-body`: that name is already the body
  *color* in §3.1, and one name cannot mean a hex in one sheet and a pixel count in another.
- **Two tracking values, and everything else takes neither.** Uppercase micro-labels — section
  labels, table headers, card headers, badges — take `--letter-spacing-caps`, because capitals set at
  11px sit too tight at their natural spacing. Display type takes `--letter-spacing-display`, which
  is negative, because that same natural spacing reads loose once the type is 26px. Interface text
  and prose take no tracking at all. An earlier draft spread .02, .03, .04 and .05em across seven
  labels that were all doing the first job — and at 11px, the difference between .03 and .04 is under
  a pixel across an entire word.
- **Icons are drawn, not typed.** Every mark is an SVG on a 24px artboard with a 2px stroke,
  `currentColor`, and round caps — so it inherits the text color it sits beside and its weight scales
  with its box. Two sizes carry the interface: `--icon-size-small` for menus, rows, toolbars and
  every close button, `--icon-size-large` for the navigation rail and floating actions. 16 and 20 are
  where the industry has settled for dense interfaces, and 24 — the common default elsewhere — is
  already large beside a 28px row.
- **Do not size an icon with `font-size`.** A unicode glyph is tempting because it costs nothing to
  type, but it draws at roughly 0.7em, so the number in the sheet is not the mark on the screen: this
  theme once specified a 17px rail icon that rendered as a 12px mark, and a port reading 17 off the
  table would have drawn something half again too big. The box is the specification.
- **Headings are never accent-colored** (§6.8), and prose is capped at `--measure`.

### 4.6 Motion

Motion here is feedback, not narrative. Two durations carry all of it.

**`--duration-fast` is a state changing under the pointer** — a border taking the accent, a label
going from secondary to heading, a switch knob sliding across, a disclosure triangle turning. The
user is already looking at the thing; the transition exists only so the change is not a jump cut.

**`--duration-slow` is something that was not there and now is** — a toast arriving or leaving, a
progress bar travelling to a new value. There is further to go, and the eye has to find it.

That is the whole ladder. An earlier draft ran four values: .12s and .15s doing the first job 30ms
apart, and .18s and .3s splitting the second. Thirty milliseconds is well below the threshold at
which anyone can tell two hover responses apart — the second value was not a decision, it was a
different afternoon.

**Easing is a keyword, not a token.** A state change takes the default `ease`; something entering
takes `ease-out`, so it arrives decelerating rather than stopping dead. Those words say what they do,
and a name in front of them would only hide it.

**A looping animation is a period, not a duration,** and does not belong on the ladder. The error dot
pulses on a 1.6s cycle because that is the speed at which a pulse reads as a heartbeat rather than a
flicker, which has nothing to do with how fast the interface answers a pointer.

**Honour `prefers-reduced-motion`.** Every transition in the theme is feedback or decoration, and
none of it carries meaning that fails to survive being switched off — so the reduced setting collapses
all of it, `scroll-behavior: smooth` included:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is the one place the theme uses `!important`, and the one place it is right to: a user's
accessibility setting outranks every rule in the sheet by definition. `1ms` rather than `0` because a
zero-length transition fires no `transitionend`, and any script waiting on one stops working.

Anything scripted waits on the token too, rather than restating it — the demo's toast reads
`--duration-slow` back out of the computed style to decide when to remove the element. A duration
duplicated in JavaScript is a duration that will disagree with the sheet eventually.

---

## 5. Elevation

Shadows are always **slate-900 at low alpha** — never neutral black — and always small-offset. A
token per role carries the whole ladder, and a component picks the role rather than spelling an
alpha:

| Role                | Light                              | Dark                              | Use                                                 |
| ------------------- | ---------------------------------- | --------------------------------- | --------------------------------------------------- |
| `--shadow-card`     | `0 1px 3px /.08` + `0 1px 2px /.06`| `0 1px 3px /.27` + `0 1px 2px /.2`| Cards and panels                                    |
| `--shadow-item`     | `0 1px 2px /.12`                   | `0 1px 2px /.50`                  | Selected list item, selected sidebar item, rail button |
| `--shadow-code`     | `0 1px 3px /.10`                   | `0 1px 3px /.33`                  | Code blocks                                         |
| `--shadow-tab`      | `0 1px 3px /.15`                   | `0 1px 3px /.50`                  | Active tab                                          |
| `--shadow-floating` | `0 2px 8px /.20`                   | `0 2px 8px /.60`                  | Popovers, menus, tooltips, toasts, floating buttons |
| `--shadow-modal`    | `0 8px 32px /.25`                  | `0 8px 32px /.70`                 | Modals                                              |

A client-side-decorated window takes a wider spread than anything on that ladder —
`0 3px 14px var(--shadow-floating)` plus a `--border-default` hairline — because it casts on the
wallpaper rather than on a surface one step behind it.

**Where the token holds a color rather than a finished shadow.** The table above is how CSS carries
it: each token is the whole `box-shadow`, so the card can be two layers and the code block can have
its own alpha. A framework whose theming primitive is a *color* — GTK's `@define-color`, and so
everything built from it — cannot do that. There, the same names hold bare `rgba()` values, the
geometry moves into the component rule, and two roles collapse: the card loses its second layer and
the code block reuses `--shadow-card`, whose `.08` sits close enough to `.10` that nothing visible
turns on the difference. `scripts/build-lightdm.mjs` shows the reverse trip, reattaching the offsets
to rebuild CSS shadows from the GTK color tokens.

`--shadow-base` is the seventh token and is not a shadow at all: it is the bare slate-900 hue, for
frameworks that compose their own shade colors from it — the Adwaita `*_shade_color` family, for
instance — instead of consuming a finished one.

Explicitly **shadowless**: inline attribute cards, help cards, toolbar toggle buttons, list-row
action buttons, add-new buttons. A shadow means "this floats above the page." Anything that merely
delimits a region gets a border instead.

**Dark mode does not change shadow *colors*, it raises their alpha — and not by a single
multiplier.** Roughly triple, tuned per role: `.08 → .27` for cards, `.12 → .50` and `.15 → .50` for
selected items and tabs, `.20 → .60` floating, `.25 → .70` modal. A slate shadow on near-black ground
needs far more alpha to register at all, and the shallow end of the ladder needs proportionally more
of it than the deep end, or cards simply stop reading as raised. That per-role tuning is the reason
the ladder is spelled out token by token rather than derived from one base color and a scale factor.

---

## 6. Component treatments

### 6.1 Buttons — three weights

An interface dense with actions cannot afford to shout on every one of them. The weight carries the
hierarchy; the accent is spent only at the top of it.

| Weight | Rest | Hover | Use |
| ------ | ---- | ----- | --- |
| **Filled** | `--accent` fill, `--text-on-fill` | opacity `.85` | The one primary action on a view |
| **Default** | transparent, `--border-default` hairline, `--text-body` | border to `--accent` | Ordinary actions |
| **Flat** | transparent, no border, `--text-secondary` | hairline appears, text to `--text-heading` | Toolbars, list rows, anything repeated |

```css
.button {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-body);
  padding: 8px 14px;
  font: 500 13px/1 var(--font-family-interface);
  border-radius: var(--radius-default);
}
.button:hover { border-color: var(--accent); }

.button-flat { border-color: transparent; color: var(--text-secondary); }
.button-flat:hover { border-color: var(--border-default); color: var(--text-heading); }

.button-filled { background: var(--accent); color: var(--text-on-fill); border-color: var(--accent); }
.button-filled:hover { opacity: .85; }

.button:disabled { opacity: .5; }
```

**Why the default button is not accent-bordered.** An earlier version of this theme gave every
non-primary button an accent border and accent text. In a toolbar with eight buttons that produces
eight blue rectangles, and the accent stops meaning "this is the action" — it just means "this is a
button," which the shape already said. Neutral borders return the accent to signalling something.

**Why flat buttons grow a border rather than a background.** Reserving hover for a border keeps §6.1's
original hazard closed: a background-swap hover on a control with an independently coloured icon can
paint the background the same colour as the glyph and the icon vanishes. A border cannot do that, and
it reads as the control gaining definition rather than lighting up.

**Filled buttons hover by opacity only,** for the same reason — the fill and the glyph are already
different colours, and any change that moves one without the other risks collapsing them.

Destructive actions take `--status-danger` in place of the border and text colour at whichever weight
they sit at, and the filled form uses `--text-on-fill` over the danger fill.

### 6.2 Inputs — fill-defined at rest, border-defined on interaction

Controls share the card hairline (`--border-default`) at rest, so a form reads as one quiet surface
rather than a grid of grey boxes. The boundary asserts itself exactly when the user engages:

| State | Border | Fill |
| ----- | ------ | ---- |
| Rest  | `1px solid var(--border-default)` | `var(--surface-default)` |
| Hover | `var(--border-focus)` | `var(--surface-default)` |
| Focus | `var(--border-focus)` plus a `var(--focus-ring)` outline | `var(--surface-default)` |

Text `--text-body`, placeholder `--text-tertiary`, selection `--accent` behind `--text-on-fill`.
Inline action buttons inside a field are `--text-secondary`, going `--accent` on hover.

**What identifies the control at rest, if not the border?** The hairline is 1.23:1 against white —
decorative. The control is identified by its label, its placeholder or value text, and its fill
sitting on the surrounding surface; the 1.4.11 boundary requirement applies when a boundary is the
*only* indicator, which is exactly the situation this design avoids. The corollary is a hard rule:
**an input at rest must always carry a visible label or placeholder.** A bare unlabelled field with
a hairline border is invisible, and that is a bug in the screen that placed it, not in the theme.

**Toggles are the exception and keep `--border-control`.** A checkbox, radio or switch has no label
text of its own inside it and no fill contrast when unchecked — the boundary genuinely is the
control, so it must clear 3:1. This is now the token's whole job.

Two details worth not improvising on:

- **The fill does not change on hover.** An earlier version dropped the field to
  `--surface-secondary` on hover, which pushed the placeholder to 4.34:1 — below AA, in a state the
  user is actively pointing at. Moving the border conveys hover just as clearly and keeps the text on
  a surface it is audited against.
- If the base you are overriding sets `border: unset`, a `border-color` override on `:hover` or
  `:focus` will silently do nothing — there is no border to recolor. Declare the rest-state `border`
  shorthand first, or use the shorthand in every state.

### 6.3 Selects — ghost, like buttons

A closed `<select>` is an action affordance, not a text field: transparent background, accent text,
opacity-only hover. The *open* option list stays a normal readable surface — `--text-body` on
`--surface-default`, group headings in `--text-secondary`.

Two mechanical warnings:

- **Frameworks routinely share input variables between selects and text fields.** If one background
  variable drives both, setting it to transparent ghosts your text inputs too. Diverging the two
  requires real selectors, not tokens.
- **Override `background-color`, not `background`.** Dropdown arrows are usually painted with a
  `background: <color> <arrow-image>` shorthand. A shorthand override erases the arrow; the longhand
  leaves it intact.

### 6.4 Navigation frame — the recessed chrome

Navigation rails, tab bars, application toolbars, and classic menu bars sit on
`--surface-navigation`, which is the secondary surface: a quiet gray strip in light mode, a
near-black one in dark. The frame is one step *back* from the content it wraps, in both schemes,
and the whole frame is one surface — a strip of some other color between a titlebar and a toolbar
is the telltale of a frame member that got missed.

**Context mapping.** "The frame" is the outermost navigation chrome of whatever is being themed. In
a standalone application, that is its own rail and tab bar, as in the reference demo. In a desktop
OS, application window chrome (headerbars, toolbars, menu bars) takes the same surface, while
nearly all content sits on `--surface-default`. Chrome recedes, content advances; that relationship
is the same at every level, so it does not matter much where you draw the line:

| Part                   | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Background             | `--surface-navigation`                                                                         |
| Text and icons at rest | `--text-on-navigation`                                                                         |
| Hover background       | `--surface-navigation-hover`                                                                   |
| Hover text             | `--text-heading`                                                                               |
| Hover shadow           | none                                                                                             |
| Active tab             | `--surface-default` fill, `--text-heading` text, `--accent` icon, `--shadow-tab` |
| Inactive tab           | transparent,`--text-on-navigation` text, `--surface-navigation-hover` on hover               |
| Tab close hover        | `--status-danger` fill, `--text-on-fill` glyph                                             |

**A desktop shell is the exception.** Its panel, tooltips, OSD and notifications float over the
wallpaper rather than sitting inside a window, so the frame's near-black reads there as a hole
rather than as a recess. They take the `--surface-shell` trio instead: the same quiet gray in light
mode, navy in dark. The raised item on the panel is `--surface-shell-card`, not `--surface-default`,
because in dark the window fill *is* the navy and would vanish against it.

**The active tab is a raised card, and it has to be read as one.** Its fill is only 1.10:1 against
the frame in light mode and 1.23:1 in dark — deliberately, because §6.5 selects by elevation rather
than by color. Selection is therefore carried by three things at once: the lift (the `--shadow-tab`
shadow), the text going to `--text-heading` from `--text-on-navigation`, and the `--accent` icon or
tab line. Drop two of the three and the selected tab disappears. This is the one place in the theme
where a component genuinely depends on more than one signal, and it is why a port that gets tab
selection right on fill alone is wrong even when it looks fine. On a shell panel the equivalent
card is `--surface-shell-card`, a wider step at 1.42:1 in dark, because the navy leaves room for
one.

**Why the frame is not dark in light mode.** An earlier version of this theme painted the frame
navy in both schemes and made the active tab the only light element in it. It was the most
recognizable thing about the theme and also its biggest liability: it forced a third on-color
(§3.5), it put a hard near-black edge against every light window, and it meant the frame and the
sidebar — two things doing the same job, one step back from content — were painted in two unrelated
colors. Collapsing them onto one surface costs the signature and buys a consistent rule: **anything
that frames content is recessed, anything that carries content is raised.**

### 6.5 Sidebars and trees

The sidebar sits on `--surface-secondary` — the same surface as the frame (§6.4), because it does
the same job — one step off the content surface:

- Item text `--text-body`; hover text `--text-heading`; hover fill `--surface-navigation-hover`,
  the same hover the frame uses. Where one list spans both surfaces and the framework offers a
  single hover color — VS Code's `list.hoverBackground`, for instance — `--border-default` is the
  value that works on either.
- **A selected item in a navigation sidebar is a raised light card:** `--surface-default` fill,
  `--text-heading` text, `--shadow-item`. Selection there reads as *elevation*,
  because a sidebar item is a place you are, not a row you picked.
- **A selected row in a list, tree or table is a solid `--accent` fill with `--text-on-fill`
  text**, and any icon in that row takes `--text-on-fill` too — an accent-colored glyph on an
  accent fill is the icon-vanishing hazard of §6.1 in its most literal form. There is one accent
  and no softened variant of it, so a selected row and a link are the same blue by construction.
- Inactive or unfocused selection is the same fill at 25–30% alpha, not a different color.
- Row action buttons: `--surface-default` fill with a `--text-secondary` glyph, going `--accent` on
  hover, shadowless.

### 6.6 Menus, modals, toasts, tooltips

- **Menus** — `--surface-default` background, `--text-body` items, `--text-secondary` icons and group
  headers, `--text-tertiary` shortcut hints, `--border-default` dividers, `--surface-secondary`
  section blocks, `.5` opacity when disabled.
- **Modals** — `--surface-default` body, `--text-heading` title, `--surface-secondary` footer with
  `--text-secondary` text, `--surface-overlay` backdrop, `--shadow-modal`. The close
  button is `--surface-secondary` / `--text-secondary` at rest and inverts to `--accent` /
  `--text-on-fill` on hover — the one sanctioned color-swap hover, because a filled accent chip
  carries no icon-vanishing risk.
- **Toasts and tooltips** use `--surface-navigation` with `--text-heading` in both modes, so
  transient overlays belong to the frame rather than the page. They are the one case where the
  frame surface floats above content instead of sitting behind it, so they carry `--shadow-floating`
  to say so — without it a toast on a light page is just a gray box. Inside a desktop shell they
  follow §6.4's exception and take `--surface-shell` instead: a tooltip there floats over the
  wallpaper, not over a window, and the frame's near-black would read as a hole in it.

### 6.7 Status and badges

| Badge                            | Fill                                                    |
| -------------------------------- | ------------------------------------------------------- |
| Neutral, default                 | `--surface-secondary` fill, `--text-secondary` text |
| Positive state, available update | `--status-success`                                    |
| Restricted, read-only            | `--status-danger`                                     |
| Informational, shared            | `--text-secondary`                                    |
| Linked, attached                 | `--accent`                                            |
| Executable, experimental         | `--badge-experimental`                                |

Every solid fill in that table takes `--text-on-fill`, which is the whole reason that token flips.

Alert *bars* use the warning color at 15% alpha as a tint, composited over the surface rather than
painted solid — `color-mix(in srgb, var(--status-warning) 15%, transparent)`, so the tint follows the
token instead of hardcoding it. The icon inside the bar takes `--status-warning-text`, not the fill
token: at 15% the tint is close enough to the surface that a mark drawn in the bright amber would sit
at roughly 2:1 against it. Status **fills** are solid; status **regions** are tinted. Text
inside a tinted region is ordinary `--text-body`, not `--text-on-fill`; the tint is too pale to
change what is legible on it.

### 6.8 Scrollbars, gutters, selection

- Scrollbar track transparent; thumb `--border-hover`, `--text-tertiary` on hover.
- Resize gutters transparent at rest, `--accent` on hover — invisible until grabbed. Find-match
  highlights and locked-on controls take the accent too, at an alpha where they read as marks.
- Text selection uses `--focus-ring`, the same translucent accent as focus outlines, so selection and
  focus read as one system.
- Content headings (`h1` through `h5`) are `--text-heading`, never the accent. Only links are blue.

---

## 7. Dark mode

One `@media (prefers-color-scheme: dark)` block re-declaring only the tokens. Six rules govern the
flip:

1. **Accents get lighter, not darker.** blue-600 → blue-400. Saturated mid-blues lose contrast fast
   on dark ground: blue-500 as link text on the default dark surface is 4.35, which misses AA.
2. **Status colors move up their ramps too.** emerald-700 → 500, amber-700 → 500, red-600 → red-400.
   A dark status color on `#060b14` is barely visible.
3. **Text on fills inverts with them.** Rules 1 and 2 make the inverting fills light, so
   `--text-on-fill` goes from white to near-black. This is the rule most often missed, and it fails
   loudly: white on dark-mode success is 2.54. Fills that were already light in light mode, like
   warning, never inverted in the first place and keep `--text-on-light` in both. Surfaces are not
   fills and are not covered by this rule — text on the frame comes off the ordinary ramp.
4. **The frame follows the secondary surface down.** `#f1f5f9 → #060b14`, which is darker than the
   content surface it wraps, exactly as it was lighter-side-recessed in light mode. Its label color
   is the one thing that does not simply invert: `--text-on-navigation` goes from slate-600 to
   pure white, because on near-black a slate label reads as disabled.
5. **Translucent values gain a lot of alpha.** Focus ring `.15 → .28`; every shadow roughly triples,
   tuned per role rather than by one multiplier (§5).
6. **The overlay switches from tinted to neutral.** `rgba(15,23,42,.45)` → `rgba(0,0,0,.6)`.

If your application has a manual theme toggle rather than following the operating system, apply the
same block to a `[data-theme="dark"]` selector alongside the media query, and make sure the attribute
wins in both directions — including `[data-theme="light"]` overriding a dark system preference.

---

## 8. Gotchas

Hazards worth checking for in any implementation:

- **Icon-vanishing on hover** (§6.1). Any background-swap hover on a control containing an
  independently-colored icon risks it. Prefer opacity.
- **The `background` shorthand eats background images** (§6.3). Use `background-color` wherever the
  base paints an arrow, chevron, or checkmark via shorthand.
- **Shared variables between control types** (§6.3). One variable driving both selects and text
  inputs means token-level changes cannot diverge them.
- **Dead `border-color` overrides** (§6.2). Recoloring a border the base has `unset` does nothing.
- **Perceptual lightness clamping.** Applications that let users assign arbitrary colors to items
  often convert to CIELAB and clamp lightness for legibility against the item background. Default
  caps are frequently aggressive enough that bright inputs like `gold` or `lime` render as dark
  olive. Audit the cap against real bright values; a light-mode cap near **78** and a dark-mode floor
  near **58** keep hues close to true while retaining a legibility margin.
- **Silent token typos.** A misspelled custom property (`--surface-secondry`) resolves to nothing and
  fails without an error. Lint for `var(--…)` names that §3.1 does not define.
- **Half-flipped dark mode.** A token declared in the light block but forgotten in the dark one keeps
  its light value and usually looks *almost* right. Diff the two blocks by name and confirm every
  omission is deliberate, like the three in §3.1.
- **A single "on-color" for every fill** (§3.5). The most expensive mistake in this palette's history:
  one `#fff` served every chip, which failed on four of five dark-mode fills and two of five in light
  mode. If you add a fill, add it to the audit before you add it to a component.
- **Treating the frame as a fill.** It is a surface. Text on it comes from the text ramp, not from
  an on-color, and a component that hardcodes white on it will invert wrongly the moment the frame
  moves with its scheme (§3.5).
- **Auditing only one scheme.** Contrast is not preserved across the flip. Lightening a fill for dark
  mode improves it as text on a dark surface and simultaneously ruins it as a background for white
  text. Every pair has to be checked twice.
- **Treating placeholders as decorative.** Placeholder and shortcut-hint text is informational and
  subject to the 4.5 threshold. This is the constraint that sets the floor for `--text-tertiary`, and
  it is why the muted ramp sits a step off the obvious slate choices (§3.3).

---

## 9. Implementation checklist

1. Copy §3.1 verbatim, both blocks. **Change nothing here.**
2. If your framework has its own theming variables, write the one-line-per-variable mapping from §2.
   Otherwise consume the tokens directly.
3. Set the system font stack, an 8px radius, and one gutter unit — without these the result reads as
   stock-with-new-colors.
4. Make every non-primary button a bordered ghost with opacity-only hover.
5. Give inputs the resting hairline, moving to accent on hover and focus; never change the fill on
   hover, and never place an input without a label or placeholder.
6. Ghost the closed select; leave its open option list on a normal surface.
7. Paint the navigation frame and the sidebar on `--surface-navigation` in **both** modes — a
   desktop shell takes `--surface-shell` instead — and mark the active item by elevation,
   heading-weight text and the accent, never by fill alone.
8. Pair every colored fill with the right on-color from §3.5 — `--text-on-fill` for fills that
   invert, `--text-on-light` for fills light in both schemes — and give surfaces ordinary ramp text.
9. Restrict shadows to the five §5 tokens; use borders for anything that merely delimits a region.
10. Confirm no component rule contains a literal hex — shadows included, which is the easiest place
    to leave one behind.
11. If the thing being themed has a terminal, fill all sixteen slots from §3.8. Nine are tokens; the
    bright tier is not, and is the only other place a hue may leave the token set.
12. Run the §10 audit in both schemes and confirm every pair passes.
13. Verify dark mode with a real operating-system toggle, not only devtools emulation.

---

## 10. Contrast audit

Every pairing the theme sanctions, measured against WCAG 2.1: **4.5** for text, **3.0** for large
text and non-text interface elements. Ratios are computed from the §3.1 values.

`scripts/audit.mjs` recomputes this table from the GTK token files on every run, and parses §3.1,
§3.2 and §3.8 back out of this document to check them against the theme and the Tilix palettes. The
guide is the one artefact here that a build step cannot regenerate, so it is the one that has to be
read back instead. If you change a token, change it in §3.1 and §3.2; the audit will tell you if you
missed one.

| Foreground | Background | Light | Dark |
| ---------- | ---------- | ----- | ---- |
| `--text-body` | `--surface-default` | 17.06 | 12.98 |
| `--text-body` | `--surface-secondary` | 15.57 | 15.98 |
| `--text-heading` | `--surface-default` | 17.85 | 15.29 |
| `--text-secondary` | `--surface-default` | 7.58 | 10.77 |
| `--text-secondary` | `--surface-secondary` | 6.92 | 13.27 |
| `--text-tertiary` | `--surface-default` | 4.76 | 6.24 |
| `--accent` | `--surface-default` | 5.17 | 6.29 |
| `--accent` | `--surface-secondary` | 4.72 | 7.75 |
| `--text-on-fill` | `--accent` (filled button, selected row) | 5.17 | 7.36 |
| `--text-on-fill` | `--status-success` | 5.48 | 7.38 |
| `--text-on-light` | `--status-warning` | 8.31 | 8.31 |
| `--status-warning-text` | `--surface-default` | 5.18 | 7.45 |
| `--status-warning-text` | `--surface-secondary` | 4.73 | 9.18 |
| `--text-on-fill` | `--status-danger` | 4.83 | 6.77 |
| `--text-on-fill` | `--badge-experimental` | 5.70 | 6.88 |
| `--text-on-navigation` | `--surface-navigation` | 6.92 | 19.71 |
| `--text-heading` (frame hover, toasts) | `--surface-navigation-hover` | 14.48 | 16.50 |
| `--accent` (focus boundary in the frame) | `--surface-navigation-hover` | 4.19 | 6.79 |
| `--text-on-navigation` (shell panel) | `--surface-shell` | 6.92 | 16.00 |
| `--text-heading` (shell panel hover) | `--surface-shell-hover` | 14.48 | 13.23 |
| `--text-heading` (raised item on the shell panel) | `--surface-shell-card` | 17.85 | 10.76 |
| `--accent` (focus boundary on the shell panel) | `--surface-shell-hover` | 4.19 | 5.44 |
| `--syntax-type` | `--surface-default` (code) | 5.36 | 8.85 |
| `--syntax-string` | `--surface-default` (code) | 5.02 | 9.18 |
| `--syntax-number` | `--surface-default` (code) | 4.92 | 11.09 |
| `--border-control` | `--surface-default` | 3.15 | 3.36 |
| `--border-focus` (hover/focus boundary) | `--surface-default` | 5.17 | 6.29 |

Two pairings sit close enough to their threshold to be worth knowing about rather than discovering
later, and both are excluded from the table because the guide routes around them:

- **`--text-tertiary` on the secondary surface is 4.34 in light mode**, just under AA. This is why
  §6.2 forbids swapping an input's fill on hover. Keep tertiary text on the default surface and the
  case does not arise; if a design genuinely needs muted text on a sidebar or in the frame, use
  `--text-secondary`.
- **`--border-control` on the secondary surface is 2.87 in light mode**, just under 3.0 (dark is
  4.14). It now guards only toggles; a toggle sitting directly on a sidebar or a toolbar is the one
  placement to avoid.

`--border-default` is deliberately absent. At 1.23 it would fail any threshold, which is correct for
what it is: a decorative hairline between regions, exempt under 1.4.11. The moment a hairline becomes
the only thing identifying a control, it is the wrong token — use `--border-control`.
