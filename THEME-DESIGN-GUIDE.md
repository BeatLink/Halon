# Halon — App Theme Design Guide

A complete, framework-agnostic specification for a **slate + single-blue** application theme with a
recessed navigation frame, ghost-first controls, and hairline structure. It defines a token set, a
palette, component treatments, and a dark mode built by flipping twenty-two values. Every
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
   a status signal, it does not belong.
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
   implemented by re-declaring twenty-two tokens and nothing else.
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
shades per hue and several accents. This theme has twenty-six tokens, one accent, and two colors that
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

  /* Status */
  --status-success:            #047857;
  --status-warning:            #f59e0b;  /* the fill; bright in both schemes, see §3.5 */
  --status-warning-text:       #c2410c;  /* the same status as an icon, dot, bar, or word */
  --status-danger:             #dc2626;
  --badge-experimental:        #7c3aed;  /* the one off-ramp hue, see §3.4 */

  /* Elevation */
  --shadow-opacity:            0.15;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-root:              #060b14;
    --surface-default:           #16213a;
    --surface-secondary:         #060b14;
    --surface-navigation-hover:  #101b2d;
    --surface-overlay:           rgba(0, 0, 0, 0.6);

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

    --status-success:            #10b981;
    --status-warning-text:       #f59e0b;  /* on dark ground the fill colour works as-is */
    --status-danger:             #f87171;
    --badge-experimental:        #a78bfa;

    --shadow-opacity:            0.5;
  }
}
```

Twenty-six tokens; dark mode re-declares twenty-two. The four it leaves alone are the ones that
carry no mode: `--text-on-light` sits on fills whose lightness does not change between schemes,
`--status-warning` is the one fill that is already light in light mode, and `--surface-navigation`
and `--border-focus` are derived from other tokens, so they flip for free.

### 3.2 Reference

| Token                          | Light                   | Dark                     | Role                                     |
| ------------------------------ | ----------------------- | ------------------------ | ---------------------------------------- |
| `--surface-root`             | `#f1f5f9`             | `#060b14`              | Application root, behind everything      |
| `--surface-default`          | `#ffffff`             | `#16213a`              | Cards, panels, editors, modals           |
| `--surface-secondary`        | `#f1f5f9`             | `#060b14`              | Sidebars, the frame, footers, fills      |
| `--surface-navigation`       | = secondary           | = secondary            | Navigation rail and tab bar base         |
| `--surface-navigation-hover` | `#e2e8f0`             | `#101b2d`              | Frame and sidebar hover                  |
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
| `--shadow-opacity`           | `.15`                 | `.5`                   | Shadow strength multiplier               |

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

Reserve exactly one: a violet for a stateful badge that would otherwise collide with the status
colors — "executable," "beta," "experimental." It appears in exactly one place. That is the precedent
for adding a hue outside slate, blue, and status: a single badge that must not read as success,
warning, or danger.

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
  --control-height:       32px;   /* 13px text + 8px padding + 1px border, doubled */
  --control-padding-x:    14px;
  --icon-button-size:     30px;
  --row-height:           28px;   /* list and tree rows */
  --frame-height:         34px;   /* headerbars, tab bars, toolbars */
  --border-width:          1px;
  --focus-ring-width:      3px;

  /* Radii — proportional to what they round */
  --radius-small:    4px;      /* check boxes, keyboard keys, inline code */
  --radius-row:      6px;      /* list rows, menu items, icon buttons */
  --radius-default:  8px;      /* buttons, inputs, cards, panels, popovers */
  --radius-window:  10px;      /* client-side window corners */
  --radius-pill:  9999px;      /* badges, switches, scrollbar thumbs */

  /* Type scale */
  --text-label:    11px;       /* uppercase section labels, weight 600 */
  --text-caption:  12px;       /* captions, footers, shortcut hints */
  --text-control:  13px;       /* buttons, inputs, menus, list rows, tabs */
  --text-body:     14px;       /* prose */
  --text-h3:       15px;
  --text-h2:       19px;
  --text-h1:       26px;

  --line-height-body: 1.55;
  --line-height-ui:   1.2;
  --measure:          68ch;    /* maximum prose line length */
}
```

### 4.2 The three rules that matter

**One control height.** Buttons, text inputs, selects, and combo boxes are all
`--control-height`. This is the single most visible metric in the theme: when a toolbar mixes a
34px button with a 30px entry, the row looks broken no matter how good the colors are. The 32px
figure is exact arithmetic, not a round number — 13px of text, `--space-4` above and below, and two
1px borders. Change the type size and this has to be recomputed.

**Radius is proportional to what it rounds.** `--radius-default` for controls, cards and panels;
`--radius-row` for things that repeat in a list, because 8px on a 28px row reads as a lozenge;
`--radius-small` for controls under 20px; `--radius-window` for the window itself, which is large
enough to carry a bigger corner; `--radius-pill` for badges and switches. Nothing else. A header
flush inside an already-rounded container takes `border-radius: 0` rather than a sixth value.

The ladder matters more than any single value: keeping one radius across a 16px checkbox and a
600px window makes the small things look bulbous and the large ones look sharp.

**Spacing comes off the scale.** If a gap is not a `--space-*` value, it is wrong. The scale is
deliberately short — eight steps, no 10px, no 20px — because the alternative is a codebase where
every panel is padded slightly differently and no two agree.

### 4.3 Component metrics

These are the values in `theme-demo.html`, which is the reference implementation: if a number here
and a number there ever disagree, the demo is right and this table is stale. Enough to port without
guessing:

| Component | Height | Padding | Radius | Text |
| --------- | ------ | ------- | ------ | ---- |
| Button | 32px | `8px 14px` | default | 13px / 500 |
| Icon button | 30px square | `--space-3` | row | icon 14px |
| Text input, textarea | 32px | `8px 11px` | default | 13px / 400 |
| Select | 32px | `8px 30px 8px 12px` | default | 13px / 500 |
| List, tree row | 28px | `5px --space-4` | row | 13px |
| Menu item | 30px | `6px 9px` | 5px | 13px |
| Menu sheet, popover | — | `5px` | default | — |
| Tab | 28px | `6px 10px` | default | 13px |
| Card, panel | — | `14px --space-6` | default | — |
| Card header | — | `10px --space-6` | 0 | 12px / 600 caps |
| Table cell | — | `9px --space-5` | 0 | 13px |
| Badge | — | `--space-1 --space-4` | pill | 11px / 600 |
| Toolbar, headerbar, tab bar | `--frame-height` = 34px | `--space-1 --space-4` | 0 | — |
| Navigation rail | 52px wide | `--space-4 0` | 0 | icon 17px |
| Rail button | 36px square | — | default | — |
| Sidebar | 248px | `0 --space-4` | 0 | 13px |
| Status bar | 27px | `5px --space-5` | 0 | 12px |
| Scrollbar | 10px, 8px thumb | 3px transparent border | pill | — |
| Progress, meter | 6px | — | 3px | — |
| Content padding | — | `28px --space-8` | — | — |
| Section gap | `--space-7` | — | — | — |

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

- **Hit targets stay honest.** 26px with a 1px border is still a comfortable pointer target, and
  icon buttons stay square at 24px rather than shrinking to the glyph.
- **Space between groups does not shrink.** The tightening is inside controls and between rows.
  Gaps between *sections* stay at `--space-6`, because that is what keeps a dense layout readable
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
  `--text-control`; only running text takes `--text-body`. Mixing the two is what makes an interface
  feel loose.
- **Headings are never accent-colored** (§6.8), and prose is capped at `--measure`.

---

## 5. Elevation

Shadows are always **slate-900 at low alpha** — never neutral black — and always small-offset:

| Use                              | Value                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| Selected list item               | `0 1px 2px rgba(15,23,42,.12)`                               |
| Card                             | `0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.06)` |
| Code block                       | `0 1px 3px rgba(15,23,42,.10)`                               |
| Active tab                       | `0 1px 3px rgba(15,23,42,.15)`                               |
| Floating button, tooltip, dialog | `rgba(15,23,42,.20)`                                         |
| Modal                            | `rgba(15,23,42,.25)`                                         |

Explicitly **shadowless**: inline attribute cards, help cards, toolbar toggle buttons, list-row
action buttons, add-new buttons. A shadow means "this floats above the page." Anything that merely
delimits a region gets a border instead.

Dark mode does not change shadow *colors* — it raises `--shadow-opacity` from `.15` to `.5`, because
a slate shadow on near-black ground needs far more alpha to register.

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
OS, the shell panel is the frame, and application window chrome (headerbars, toolbars, menu bars)
takes the same surface, while nearly all content sits on `--surface-default`. Chrome recedes,
content advances; that relationship is the same at every level, so it does not matter much where
you draw the line:

| Part                   | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Background             | `--surface-navigation`                                                                         |
| Text and icons at rest | `--text-on-navigation`                                                                         |
| Hover background       | `--surface-navigation-hover`                                                                   |
| Hover text             | `--text-heading`                                                                               |
| Hover shadow           | none                                                                                             |
| Active tab             | `--surface-default` fill, `--text-heading` text, `--accent` icon, `0 1px 3px rgba(15,23,42,.15)` |
| Inactive tab           | transparent,`--text-on-navigation` text, `--surface-navigation-hover` on hover               |
| Tab close hover        | `--status-danger` fill, `--text-on-fill` glyph                                             |

**The active tab is a raised card, and it has to be read as one.** Its fill is only 1.10:1 against
the frame in light mode and 1.23:1 in dark — deliberately, because §6.5 selects by elevation rather
than by color. Selection is therefore carried by three things at once: the lift (the `--shadow-tab`
shadow), the text going to `--text-heading` from `--text-on-navigation`, and the `--accent` icon or
tab line. Drop two of the three and the selected tab disappears. This is the one place in the theme
where a component genuinely depends on more than one signal, and it is why a port that gets tab
selection right on fill alone is wrong even when it looks fine.

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
  `--text-heading` text, `0 1px 2px rgba(15,23,42,.12)`. Selection there reads as *elevation*,
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
  `--text-secondary` text, `--surface-overlay` backdrop, `rgba(15,23,42,.25)` shadow. The close
  button is `--surface-secondary` / `--text-secondary` at rest and inverts to `--accent` /
  `--text-on-fill` on hover — the one sanctioned color-swap hover, because a filled accent chip
  carries no icon-vanishing risk.
- **Toasts and tooltips** use `--surface-navigation` with `--text-heading` in both modes, so
  transient overlays belong to the frame rather than the page. They are the one case where the
  frame surface floats above content instead of sitting behind it, so they carry a
  `rgba(15,23,42,.20)` shadow to say so — without it a toast on a light page is just a gray box.

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
5. **Translucent values gain a lot of alpha.** Focus ring `.15 → .28`; shadow opacity `.15 → .5`.
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
7. Paint the navigation frame and the sidebar on `--surface-navigation` in **both** modes, and mark
   the active item by elevation, heading-weight text and the accent — never by fill alone.
8. Pair every colored fill with the right on-color from §3.5 — `--text-on-fill` for fills that
   invert, `--text-on-light` for fills light in both schemes — and give surfaces ordinary ramp text.
9. Restrict shadows to the §5 table; use borders for anything that merely delimits a region.
10. Confirm no component rule contains a literal hex.
11. Run the §10 audit in both schemes and confirm every pair passes.
12. Verify dark mode with a real operating-system toggle, not only devtools emulation.

---

## 10. Contrast audit

Every pairing the theme sanctions, measured against WCAG 2.1: **4.5** for text, **3.0** for large
text and non-text interface elements. Ratios are computed from the §3.1 values.

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
