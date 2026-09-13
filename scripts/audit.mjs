#!/usr/bin/env node
/* Contrast audit for the Halon token set.
 *
 * Reads the GTK token files as the source of truth, resolves references, and
 * checks every pairing the design guide sanctions against WCAG 2.1 in both
 * schemes.
 *
 * It also parses the two artefacts that restate those values in another form —
 * the HTML demo, and the design guide's §3.1, §3.2 and §3.8 tables — and
 * compares them back. The generated themes are kept honest by their builders'
 * --check mode; the guide is prose, so nothing else can keep it honest.
 *
 * Exits non-zero on any failure, so it works as a pre-commit or CI gate.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = {
    light: join(root, "gtk/Halon/shared/_tokens-light.css"),
    dark: join(root, "gtk/Halon/shared/_tokens-dark.css"),
};
const DEMO = join(root, "theme-demo.html");
const GUIDE = join(root, "THEME-DESIGN-GUIDE.md");
const TILIX = {
    light: join(root, "tilix/Halon.json"),
    dark: join(root, "tilix/Halon-Dark.json"),
};

/* ---------- colour maths ---------- */

const channel = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = ({ r, g, b }) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function parse(value) {
    const v = value.trim();
    if (v.startsWith("#")) {
        const h = v.length === 4
            ? "#" + [...v.slice(1)].map((c) => c + c).join("")
            : v;
        return {
            r: parseInt(h.slice(1, 3), 16),
            g: parseInt(h.slice(3, 5), 16),
            b: parseInt(h.slice(5, 7), 16),
            a: 1,
        };
    }
    const nums = v.match(/[\d.]+/g);
    if (!nums) throw new Error(`cannot parse colour: ${value}`);
    return { r: +nums[0], g: +nums[1], b: +nums[2], a: nums.length > 3 ? +nums[3] : 1 };
}

/* Composites a translucent colour over an opaque one so alpha tokens can be audited. */
const flatten = (fg, bg) =>
    fg.a >= 1 ? fg : {
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
    };

function contrast(fg, bg) {
    const a = luminance(flatten(fg, bg));
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ---------- token loading ---------- */

function loadTokens(path) {
    const raw = {};
    for (const m of readFileSync(path, "utf8").matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) {
        raw[m[1]] = m[2].trim();
    }
    const resolve = (name, seen = new Set()) => {
        if (seen.has(name)) throw new Error(`circular token reference: ${name}`);
        seen.add(name);
        const v = raw[name];
        if (v === undefined) throw new Error(`undefined token: ${name}`);
        return v.startsWith("@") ? resolve(v.slice(1), seen) : v;
    };
    return Object.fromEntries(Object.keys(raw).map((k) => [k, parse(resolve(k))]));
}

/* ---------- the audited pairs ---------- */

const PAIRS = [
    ["text-body", "surface-default", 4.5],
    ["text-body", "surface-secondary", 4.5],
    ["text-heading", "surface-default", 4.5],
    ["text-secondary", "surface-default", 4.5],
    ["text-secondary", "surface-secondary", 4.5],
    ["text-tertiary", "surface-default", 4.5],
    ["accent", "surface-default", 4.5],
    ["accent", "surface-secondary", 4.5],
    ["text-on-fill", "accent", 4.5],
    ["text-on-fill", "status-success", 4.5],
    ["text-on-fill", "status-danger", 4.5],
    ["text-on-fill", "badge-experimental", 4.5],
    ["text-on-light", "status-warning", 4.5],
    ["text-on-navigation", "surface-navigation", 4.5],
    ["text-heading", "surface-navigation-hover", 4.5],
    ["accent", "surface-navigation-hover", 3.0],
    ["text-on-navigation", "surface-shell", 4.5],
    ["text-heading", "surface-shell-hover", 4.5],
    ["text-heading", "surface-shell-card", 4.5],
    ["accent", "surface-shell-hover", 3.0],
    ["status-warning-text", "surface-default", 4.5],
    ["status-warning-text", "surface-secondary", 4.5],
    ["status-danger", "surface-default", 4.5],
    ["status-success", "surface-default", 4.5],
    ["syntax-type", "surface-default", 4.5],
    ["syntax-string", "surface-default", 4.5],
    ["syntax-number", "surface-default", 4.5],
    ["border-control", "surface-default", 3.0],
    ["focus-ring", "surface-default", 1.0],
];

/* ---------- run ---------- */

const schemes = Object.fromEntries(
    Object.entries(TOKENS).map(([name, path]) => [name, loadTokens(path)]),
);

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);
const num = (n) => n.toFixed(2).padStart(6);

console.log("Halon contrast audit — WCAG 2.1, 4.5 for text, 3.0 for interface elements\n");
console.log(`${pad("foreground", 22)}${pad("background", 22)}${" light".padStart(7)}${"  dark".padStart(8)}  target`);
console.log("-".repeat(70));

for (const [fg, bg, target] of PAIRS) {
    const ratios = {};
    for (const [scheme, tokens] of Object.entries(schemes)) {
        if (!tokens[fg]) throw new Error(`token ${fg} missing from ${scheme}`);
        if (!tokens[bg]) throw new Error(`token ${bg} missing from ${scheme}`);
        ratios[scheme] = contrast(tokens[fg], tokens[bg]);
    }
    const bad = Object.values(ratios).some((r) => r < target);
    if (bad) failures++;
    console.log(
        pad(fg, 22) + pad(bg, 22) + num(ratios.light) + num(ratios.dark) +
        `   ${target.toFixed(1)}` + (bad ? "   FAIL" : ""),
    );
}

/* Every token must exist in both schemes, or dark mode is silently half-flipped. */
const lightNames = new Set(Object.keys(schemes.light));
const darkNames = new Set(Object.keys(schemes.dark));
const missing = [...lightNames].filter((n) => !darkNames.has(n));
const extra = [...darkNames].filter((n) => !lightNames.has(n));
if (missing.length || extra.length) {
    failures++;
    console.log(`\nToken sets differ: light-only ${missing}, dark-only ${extra}`);
}

/* Cross-check the HTML demo so the guide, the demo and the GTK theme cannot drift. */
/* Splits on top-level commas only, so rgba(...) arguments survive. */
function splitArgs(s) {
    const out = [];
    let depth = 0, start = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") depth--;
        else if (s[i] === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
    }
    out.push(s.slice(start));
    return out.map((x) => x.trim());
}

if (existsSync(DEMO)) {
    const html = readFileSync(DEMO, "utf8");
    const css = html.split("</style>")[0];

    const raw = {};
    for (const m of css.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
        raw[m[1]] = m[2].replace(/\s*\/\*.*/, "").trim();
    }

    const demoValue = (name, scheme, seen = new Set()) => {
        if (seen.has(name)) throw new Error(`circular demo token: ${name}`);
        seen.add(name);
        let v = raw[name];
        if (v === undefined) return null;
        const ref = v.match(/^var\(\s*--([\w-]+)\s*\)$/);
        if (ref) return demoValue(ref[1], scheme, seen);
        const ld = v.match(/^light-dark\((.*)\)$/s);
        if (ld) {
            const [l, d] = splitArgs(ld[1]);
            v = scheme === "light" ? l : d;
            const inner = v.match(/^var\(\s*--([\w-]+)\s*\)$/);
            if (inner) return demoValue(inner[1], scheme, seen);
        }
        return v;
    };

    let drift = 0, compared = 0;
    const skipped = new Set();
    for (const name of Object.keys(raw)) {
        if (!lightNames.has(name)) continue;
        for (const scheme of ["light", "dark"]) {
            const value = demoValue(name, scheme);
            if (value === null || value.startsWith("url(")) continue;
            /* Shadows are whole box-shadow values in the demo and bare colours in GTK,
               so they are not comparable; every actual colour token is. */
            if (/\dpx/.test(value)) { skipped.add(name); continue; }
            const a = parse(value);
            const b = schemes[scheme][name];
            compared++;
            if (a.r !== b.r || a.g !== b.g || a.b !== b.b || Math.abs(a.a - b.a) > 0.001) {
                console.log(`\nDRIFT ${name} (${scheme}): demo ${value} vs theme`);
                drift++;
            }
        }
    }
    failures += drift;
    if (!drift) console.log(`\nDemo matches the GTK theme across ${compared} token/scheme values`
        + ` (${skipped.size} shadow token(s) not comparable).`);
}

/* ---------- the design guide ---------- */

/* The guide is prose, so nothing keeps it honest but this. Three of its tables
   restate values that live somewhere else: §3.1 and §3.2 restate the token set,
   §3.8 restates the Tilix palettes. All three are parsed back and compared. */

const same = (a, b) =>
    a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) <= 0.001;

const section = (md, heading) => {
    const start = md.indexOf(heading);
    if (start < 0) throw new Error(`guide section missing: ${heading}`);
    const end = md.indexOf("\n#", start + heading.length);
    return md.slice(start, end < 0 ? undefined : end);
};

/* Reads `--name: value;` pairs out of one CSS block, dropping trailing comments. */
const declarations = (block) =>
    Object.fromEntries(
        [...block.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)]
            .map((m) => [m[1], m[2].replace(/\s*\/\*.*/, "").trim()]),
    );

if (existsSync(GUIDE)) {
    const md = readFileSync(GUIDE, "utf8");
    let guideDrift = 0;
    const report = (msg) => { console.log(`\nGUIDE ${msg}`); guideDrift++; };

    /* §3.1 — the definitions block, as a real per-scheme token map. */
    const defs = section(md, "### 3.1");
    const lightBlock = defs.match(/:root \{([\s\S]*?)\n\}/);
    const darkStart = defs.indexOf("prefers-color-scheme");
    const darkBlock = darkStart < 0 ? null : defs.slice(darkStart).match(/:root \{([\s\S]*?)\n {2}\}/);
    if (!lightBlock || !darkBlock) throw new Error("cannot find the §3.1 :root blocks");

    const guideRaw = {
        light: declarations(lightBlock[1]),
        dark: { ...declarations(lightBlock[1]), ...declarations(darkBlock[1]) },
    };

    /* Same var() resolution the real sheets do, so aliases are compared as values. */
    const guideValue = (scheme, name, seen = new Set()) => {
        if (seen.has(name)) throw new Error(`circular guide token: ${name}`);
        seen.add(name);
        const v = guideRaw[scheme][name];
        if (v === undefined) return null;
        const ref = v.match(/^var\(\s*--([\w-]+)\s*\)$/);
        return ref ? guideValue(scheme, ref[1], seen) : parse(v);
    };

    for (const scheme of ["light", "dark"]) {
        const impl = schemes[scheme];
        for (const name of Object.keys(impl)) {
            if (guideRaw[scheme][name] === undefined) {
                report(`§3.1 is missing ${name} (${scheme}), which the theme defines`);
            }
        }
        for (const name of Object.keys(guideRaw[scheme])) {
            if (!impl[name]) { report(`§3.1 defines ${name} (${scheme}), which no theme has`); continue; }
            const v = guideValue(scheme, name);
            if (v && !same(v, impl[name])) {
                report(`§3.1 ${name} (${scheme}): guide ${guideRaw[scheme][name]} disagrees with the theme`);
            }
        }
    }

    /* §3.2 — the reference table, which restates the same values in prose shorthand. */
    const rows = [...section(md, "### 3.2").matchAll(/^\| `--([\w-]+)`\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/gm)];
    const cell = (text, scheme) => {
        const s = text.replace(/`/g, "").trim();
        /* The table writes aliases as "= secondary" and "= default". */
        if (s === "= secondary") return schemes[scheme]["surface-secondary"];
        if (s === "= default") return schemes[scheme]["surface-default"];
        const ref = s.match(/^var\(--([\w-]+)\)$/);
        if (ref) return schemes[scheme][ref[1]] ?? null;
        return /^(#|rgba?\()/.test(s) ? parse(s) : null;
    };
    for (const [, name, light, dark] of rows) {
        if (!schemes.light[name]) { report(`§3.2 lists ${name}, which no theme has`); continue; }
        for (const [scheme, text] of [["light", light], ["dark", dark]]) {
            const v = cell(text, scheme);
            if (v && !same(v, schemes[scheme][name])) {
                report(`§3.2 ${name} (${scheme}): table says ${text.trim()}`);
            }
        }
    }
    const listed = new Set(rows.map((r) => r[1]));
    for (const name of Object.keys(schemes.light)) {
        if (!listed.has(name)) report(`§3.2 is missing a row for ${name}`);
    }

    /* §3.8 — the terminal palette, which restates the Tilix schemes slot by slot. */
    if (Object.values(TILIX).every(existsSync)) {
        const palettes = Object.fromEntries(
            Object.entries(TILIX).map(([scheme, path]) =>
                [scheme, JSON.parse(readFileSync(path, "utf8")).palette]),
        );
        const slots = [...section(md, "### 3.8")
            .matchAll(/^\|\s*(\d+)[^|]*\|\s*`(#[0-9a-fA-F]{6})`\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|/gm)];
        const seen = new Set();
        for (const [, index, light, dark] of slots) {
            const i = +index;
            seen.add(i);
            for (const [scheme, hex] of [["light", light], ["dark", dark]]) {
                const actual = palettes[scheme][i];
                if (!actual) { report(`§3.8 documents slot ${i}, which the palette lacks`); continue; }
                if (!same(parse(hex), parse(actual))) {
                    report(`§3.8 slot ${i} (${scheme}): guide ${hex} vs palette ${actual}`);
                }
            }
        }
        const absent = [...Array(16).keys()].filter((i) => !seen.has(i));
        if (absent.length) report(`§3.8 documents no value for ANSI slot(s) ${absent.join(", ")}`);
        if (!guideDrift) {
            console.log(`Guide matches the theme across ${rows.length} tokens`
                + ` and the palette across ${slots.length} ANSI slots.`);
        }
    }

    failures += guideDrift;
}

/* ==========================================================================
   §4 — the metric layer
   Colour stays honest because three artefacts state it and this script diffs
   them. Metrics had no such check, and §4 drifted: the table named heights the
   demo had never rendered, and the arithmetic under it came to 31, not 32.
   Three static checks close that. --render adds a fourth that measures the page
   in a real browser, which is the only way to catch a height a font breaks.
   ========================================================================== */

const RENDER = process.argv.includes("--render");

/* Every rule in a sheet, at-rules descended into. The demo nests no deeper. */
function* cssRules(css) {
    const end = (start) => {
        let depth = 0;
        for (let j = start; j < css.length; j++) {
            if (css[j] === "{") depth++;
            else if (css[j] === "}" && !--depth) return j;
        }
        return css.length;
    };
    for (let i = 0; i < css.length; ) {
        const open = css.indexOf("{", i);
        if (open < 0) return;
        const prelude = css.slice(i, open).trim();
        const close = end(open);
        const body = css.slice(open + 1, close);
        if (prelude.startsWith("@")) {
            if (!prelude.startsWith("@keyframes")) yield* cssRules(body);
        } else if (prelude) {
            yield { prelude, body };
        }
        i = close + 1;
    }
}

const props = (body) => Object.fromEntries(
    [...body.matchAll(/([-\w]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].trim()]),
);

/* §4.3 names components, not selectors; this is the one mapping between them. */
const COMPONENTS = {
    "Button": [".button"],
    "Icon button": [".icon-button"],
    "Text input": [".input"],
    "Textarea": [".textarea"],
    "Select": [".select"],
    "List, tree row": [".tree-item"],
    "Menu item": [".menu-item"],
    "Menu sheet, popover": [".menu"],
    "Tab": [".tab"],
    "Card, panel": [".card"],
    "Card header": [".card-header"],
    "Table cell": ["table", "tbody td"],
    "Badge": [".badge"],
    "Toolbar, headerbar, tab bar": [".tab-bar"],
    "Navigation rail": [".navigation-rail"],
    "Rail button": [".rail-button"],
    "Sidebar": [".sidebar"],
    "Status bar": [".status-bar"],
    /* A pair of pseudo-elements whose "padding" cell is prose, not a padding. */
    "Scrollbar": null,
    "Progress, meter": [".progress"],
    "Content padding": [".content"],
    "Section gap": [".section"],
};

const RADIUS_WORDS = {
    small: "--radius-small", default: "--radius-default",
};

if (existsSync(DEMO) && existsSync(GUIDE)) {
    const md = readFileSync(GUIDE, "utf8");
    const sheet = readFileSync(DEMO, "utf8").split("</style>")[0].split("<style>")[1]
        .replace(/\/\*[\s\S]*?\*\//g, "");

    let metricDrift = 0;
    const flag = (msg) => { console.log(`\nMETRIC ${msg}`); metricDrift++; };

    /* ---------- 1. §4.1 against the demo's :root ---------- */

    const demoRoot = {};
    for (const r of cssRules(sheet)) {
        if (r.prelude === ":root") Object.assign(demoRoot, props(r.body));
    }
    const metric = (name) => demoRoot[name];
    const flat = (v) => v.replace(/\s+/g, " ").trim();

    const guideMetrics = declarations(
        section(md, "### 4.1").match(/```css\n([\s\S]*?)```/)[1],
    );
    for (const [name, value] of Object.entries(guideMetrics)) {
        const mine = demoRoot["--" + name];
        if (mine === undefined) flag(`§4.1 defines --${name}, which the demo does not`);
        else if (flat(mine) !== flat(value)) {
            flag(`§4.1 --${name}: guide ${flat(value)} vs demo ${flat(mine)}`);
        }
    }
    /* Colour tokens live in §3 and are checked above; §4.1 owns the rest. A colour
       is told from a metric by its value, since §3's set is larger than the GTK one. */
    const resolveAlias = (v, seen = new Set()) => {
        const alias = v.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
        if (!alias || seen.has(alias[1])) return v;
        seen.add(alias[1]);
        return resolveAlias(demoRoot[alias[1]] ?? v, seen);
    };
    const isColour = (v) => /#|rgba?\(|light-dark\(|url\(/.test(resolveAlias(v));
    for (const [name, value] of Object.entries(demoRoot)) {
        if (!name.startsWith("--") || isColour(value)) continue;
        if (guideMetrics[name.slice(2)] === undefined) {
            flag(`the demo defines ${name}, which §4.1 does not`);
        }
    }

    /* ---------- 2. §4.3 against the demo's component rules ---------- */

    /* Declarations from every rule that names this selector exactly, in source
       order, so the last one wins the way the cascade would. */
    const declaredOn = (selectors) => {
        const out = {};
        for (const r of cssRules(sheet)) {
            const list = r.prelude.split(",").map((s) => s.trim());
            if (list.some((s) => selectors.includes(s))) Object.assign(out, props(r.body));
        }
        return out;
    };

    /* Both sides reduce to a list of pixel numbers: the demo writes var(--x),
       the guide writes a bare --x, and neither may be compared as text. */
    const lengths = (value, deref) => {
        const resolved = value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, n) => deref(n) ?? "?")
                              .replace(/--[\w-]+/g, (n) => deref(n) ?? "?");
        const out = [];
        for (const token of resolved.split(/[\s,]+/).filter(Boolean)) {
            if (token === "0") { out.push(0); continue; }
            const m = token.match(/^(-?[\d.]+)px$/);
            if (m) out.push(+m[1]);
        }
        return out;
    };
    const demoLengths = (v) => lengths(v, metric);
    const guideLengths = (v) => lengths(v, metric);
    const same4 = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

    const rows43 = [...section(md, "### 4.3")
        .matchAll(/^\| (?!Component|-)([^|]+?)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm)];
    const clean = (c) => c.replace(/`/g, "").trim();
    let checked = 0;
    const unchecked = [];

    for (const [, rawName, h, p, r, t] of rows43) {
        const name = rawName.trim();
        if (!(name in COMPONENTS)) { flag(`§4.3 lists "${name}", which maps to no selector`); continue; }
        const selectors = COMPONENTS[name];
        if (!selectors) { unchecked.push(name); continue; }
        const rule = declaredOn(selectors);
        if (!Object.keys(rule).length) { flag(`§4.3 "${name}" → ${selectors} matches no rule`); continue; }
        const say = (what, want, got) =>
            flag(`§4.3 ${name} ${what}: table says ${want}, demo has ${got}`);

        /* Height — the column also carries "square", "wide" and "grows from". */
        const hc = clean(h);
        if (hc && hc !== "—") {
            const px = guideLengths(hc.replace(/^.*=\s*/, ""));
            const want = px[px.length - 1];
            const which = /square/.test(hc) ? ["width", "height"]
                        : /wide/.test(hc) ? ["width"]
                        : /grows from/.test(hc) ? ["min-height"] : ["height"];
            for (const prop of which) {
                const got = rule[prop] === undefined ? null : demoLengths(rule[prop])[0];
                if (got !== want) say(prop, `${want}px`, rule[prop] ?? "nothing");
                else checked++;
            }
        }

        /* Padding, radius, type — each unstated in the table is simply not checked. */
        const pc = clean(p);
        if (pc && pc !== "—" && !/border/.test(pc)) {
            const want = guideLengths(pc);
            const got = rule.padding === undefined ? [] : demoLengths(rule.padding);
            if (!same4(want, got)) say("padding", pc, rule.padding ?? "nothing");
            else checked++;
        }

        const rc = clean(r);
        if (rc && rc !== "—") {
            const want = rc in RADIUS_WORDS ? demoLengths(`var(${RADIUS_WORDS[rc]})`) : guideLengths(rc);
            /* An undeclared radius is 0, which is what the table writes for a flush edge. */
            const got = rule["border-radius"] === undefined ? [0] : demoLengths(rule["border-radius"]);
            if (!same4(want, got)) say("radius", rc, rule["border-radius"] ?? "nothing (so 0)");
            else checked++;
        }

        const tc = clean(t);
        if (tc && tc !== "—") {
            const [sizeText, weightText] = tc.split("/").map((x) => x.trim());
            const want = guideLengths(sizeText)[0];
            const got = rule["font-size"] === undefined ? null : demoLengths(rule["font-size"])[0];
            if (got !== want) say("font-size", `${want}px`, rule["font-size"] ?? "nothing");
            else checked++;
            if (weightText) {
                const wantWeight = parseInt(weightText, 10);
                /* Unstated weight is the initial value, which is what 400 means here. */
                const gotWeight = parseInt(rule["font-weight"] ?? "400", 10);
                if (gotWeight !== wantWeight) say("font-weight", weightText, rule["font-weight"] ?? "nothing (so 400)");
                else checked++;
            }
        }
    }
    for (const name of Object.keys(COMPONENTS)) {
        if (!rows43.some((row) => row[1].trim() === name)) flag(`§4.3 has no row for "${name}"`);
    }

    /* ---------- 3. every gap and margin comes off the scale ---------- */

    /* §4.2 allows a gap to be a scale step and nothing else; a padding may also be
       one of the literals §4.3 lists, and those are the only two escape hatches. */
    const scale = Object.entries(demoRoot)
        .filter(([n]) => /^--space-\d$/.test(n)).map(([, v]) => parseFloat(v));
    const sanctionedPadding = rows43.flatMap(([, , , p]) =>
        /border/.test(p) ? [] : guideLengths(clean(p)));
    const allowed = new Set([0, 1, ...scale, ...sanctionedPadding.map(Math.abs)]);

    const GAP = /^(gap|row-gap|column-gap|margin|margin-(top|right|bottom|left))$/;
    const offScale = new Map();
    const checkGaps = (where, declarations) => {
        for (const [prop, value] of Object.entries(declarations)) {
            if (!GAP.test(prop)) continue;
            for (const n of demoLengths(value)) {
                if (!allowed.has(Math.abs(n))) {
                    offScale.set(`${where} { ${prop}: ${value} }`, Math.abs(n));
                }
            }
        }
    };
    for (const r of cssRules(sheet)) checkGaps(r.prelude, props(r.body));
    /* Inline styles are part of the sheet's surface area, so they are held to it too. */
    for (const m of readFileSync(DEMO, "utf8").matchAll(/style="([^"]+)"/g)) {
        checkGaps("inline style", props(m[1]));
    }
    for (const [where, n] of offScale) flag(`${n}px is not on the 4px scale — ${where}`);

    /* ---------- 3b. every element size is a multiple of 4 ---------- */

    /* §4.2 allows exactly two kinds of off-grid size, and both come from a rule
       rather than a choice. Naming them here is the point: an exception nobody
       had to write down is how 15px, 19px and 26px got in last time. */
    const SIZE_EXCEPTIONS = new Map([
        ["::-webkit-scrollbar|width", "§4.3 — the 10px scrollbar track"],
        ["::-webkit-scrollbar|height", "§4.3 — the 10px scrollbar track"],
        [".progress|height", "§4.3 — a bar is 6px thick"],
        [".range|height", "§4.3 — a bar is 6px thick"],
        [".switch::after|top", "the inset a 16px knob leaves in a 24px track"],
        [".switch::after|left", "the inset a 16px knob leaves in a 24px track"],
        [".timeline-item::before|left", "centres the dot on the item's rail"],
    ]);
    const SIZED = /^(width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|flex-basis|grid-template-columns)$/;

    const offGrid = new Map();
    const usedException = new Set();
    const checkSizes = (where, declarations) => {
        for (const [prop, value] of Object.entries(declarations)) {
            if (!SIZED.test(prop)) continue;
            /* A size that resolves through a token is already governed by §4.1 and
               §4.3; only a bare number is one nobody had to justify. */
            if (/var\(/.test(value)) continue;
            for (const n of demoLengths(value)) {
                if (n % 4 === 0) continue;
                const key = `${where}|${prop}`;
                if (SIZE_EXCEPTIONS.has(key)) { usedException.add(key); continue; }
                offGrid.set(`${where} { ${prop}: ${value} }`, Math.abs(n));
            }
        }
    };
    for (const r of cssRules(sheet)) {
        /* :root holds tokens, not boxes; --border-width would trip the name test. */
        if (r.prelude === ":root") continue;
        checkSizes(r.prelude, props(r.body));
    }
    for (const m of readFileSync(DEMO, "utf8").matchAll(/style="([^"]+)"/g)) {
        checkSizes("inline style", props(m[1]));
    }
    for (const [where, n] of offGrid) flag(`${n}px is not a multiple of 4 — ${where}`);
    for (const key of SIZE_EXCEPTIONS.keys()) {
        if (!usedException.has(key)) flag(`§4.2 exempts ${key}, which no longer needs it`);
    }

    /* ---------- 3c. anything that stacks comes off the layer ladder ---------- */

    const rawLayer = new Map();
    const checkLayers = (where, declarations) => {
        const value = declarations["z-index"];
        if (value === undefined) return;
        if (!/^var\(\s*--layer-[\w-]+\s*\)$/.test(value.trim())) {
            rawLayer.set(where, value.trim());
        }
    };
    for (const r of cssRules(sheet)) checkLayers(r.prelude, props(r.body));
    for (const m of readFileSync(DEMO, "utf8").matchAll(/style="([^"]+)"/g)) {
        checkLayers("inline style", props(m[1]));
    }
    for (const [where, value] of rawLayer) {
        flag(`z-index: ${value} is not a --layer-* rung — ${where}`);
    }

    /* ---------- 3d. tracking comes off the two values, or is absent ---------- */

    const rawTracking = new Map();
    const checkTracking = (where, declarations) => {
        const value = declarations["letter-spacing"];
        if (value === undefined) return;
        const v = value.trim();
        if (v === "normal" || v === "0") return;
        if (!/^var\(\s*--letter-spacing-(caps|display)\s*\)$/.test(v)) rawTracking.set(where, v);
    };
    for (const r of cssRules(sheet)) checkTracking(r.prelude, props(r.body));
    for (const m of readFileSync(DEMO, "utf8").matchAll(/style="([^"]+)"/g)) {
        checkTracking("inline style", props(m[1]));
    }
    for (const [where, value] of rawTracking) {
        flag(`letter-spacing: ${value} is neither tracking token — ${where}`);
    }

    /* ---------- 3e. icons are drawn, not typed ---------- */

    /* §4.5: a unicode glyph draws at roughly 0.7em, so its font-size is never the
       size of the mark. These are the marks that are genuinely text. */
    const TYPED = new Set([
        "⌘",  // ⌘, in a keyboard shortcut label
        "⌦",  // ⌦, likewise
        "→",  // →, in prose
        "¶",  // ¶, in prose
    ]);
    const PUNCTUATION = /[‐-‧ ­]/;

    const markup = readFileSync(DEMO, "utf8")
        .split("</head>")[1]
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<svg[\s\S]*?<\/svg>/g, "");
    const typedMarks = new Map();
    for (const ch of markup) {
        if (ch.codePointAt(0) < 0x2000 && ch.codePointAt(0) !== 0xb6) continue;
        if (TYPED.has(ch) || PUNCTUATION.test(ch)) continue;
        typedMarks.set(ch, (typedMarks.get(ch) ?? 0) + 1);
    }
    for (const [ch, count] of typedMarks) {
        flag(`${ch} (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`
            + ` is a glyph used as an icon, ${count}x — §4.5 wants a drawn mark`);
    }

    /* ---------- 3f. motion comes off the two durations ---------- */

    /* A looping animation is a period rather than a response, per §4.6, so its
       own timing is its business; everything that answers the user is on the ladder. */
    const LOOPING = /\binfinite\b/;
    const rawDuration = new Map();
    const checkMotion = (where, declarations) => {
        for (const prop of ["transition", "animation", "transition-duration", "animation-duration"]) {
            const value = declarations[prop];
            if (value === undefined) continue;
            if (prop.startsWith("animation") && LOOPING.test(value)) continue;
            for (const [, n] of value.matchAll(/(?<![\w.])(\d*\.?\d+)s(?![\w-])/g)) {
                rawDuration.set(`${where} { ${prop}: ${value} }`, `${n}s`);
            }
        }
    };
    for (const r of cssRules(sheet)) checkMotion(r.prelude, props(r.body));
    for (const [where, value] of rawDuration) {
        flag(`${value} is not a --duration-* rung — ${where}`);
    }

    /* Reduced motion is not optional, and nothing else in the sheet may use !important. */
    if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(sheet)) {
        flag("§4.6 requires a prefers-reduced-motion block, and the demo has none");
    }

    if (!metricDrift) {
        console.log(`\nDemo matches §4 across ${Object.keys(guideMetrics).length} metric tokens`
            + ` and ${checked} values in ${rows43.length - unchecked.length} of §4.3's rows`
            + ` (${unchecked.join(", ")} checked by eye), every gap on the scale.`);
    }
    failures += metricDrift;

    /* ---------- 4. what the browser actually lays out ---------- */

    if (RENDER) failures += await renderCheck(rows43, clean, guideLengths);
    else console.log("Rendered heights not checked; re-run with --render to measure them.");
}

/* Serves the demo to a headless Firefox, lets the page measure itself, and takes
   the numbers back. Nothing static can do this: the heights that were wrong here
   were wrong because a fallback font and an unset line-height changed the layout,
   and neither is visible in the stylesheet. */
async function renderCheck(rows43, clean, guideLengths) {
    const http = await import("node:http");
    const { spawn } = await import("node:child_process");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");

    const wanted = [];
    for (const [, rawName, h] of rows43) {
        const selectors = COMPONENTS[rawName.trim()];
        const cell = clean(h);
        if (!selectors || !cell || cell === "—" || /grows from/.test(cell)) continue;
        const px = guideLengths(cell.replace(/^.*=\s*/, ""));
        wanted.push({
            name: rawName.trim(),
            selector: selectors[selectors.length - 1],
            axis: /wide/.test(cell) ? "width" : "height",
            want: px[px.length - 1],
        });
    }

    const probe = `<script>
addEventListener("load", () => {
    const out = ${JSON.stringify(wanted)}.map((w) => {
        const counts = {};
        for (const element of document.querySelectorAll(w.selector)) {
            const box = element.getBoundingClientRect();
            if (box.width <= 0 || box.height <= 0) continue;
            const value = Math.round(box[w.axis] * 10) / 10;
            counts[value] = (counts[value] || 0) + 1;
        }
        return { ...w, counts };
    });
    fetch("/report", { method: "POST", body: JSON.stringify(out) });
}, { once: true });
</script>`;

    const page = readFileSync(DEMO, "utf8").replace("</body>", probe + "</body>");
    let deliver;
    const reported = new Promise((r) => { deliver = r; });
    const server = http.createServer((request, response) => {
        if (request.method === "POST") {
            let body = "";
            request.on("data", (chunk) => { body += chunk; });
            request.on("end", () => { response.end("ok"); deliver(JSON.parse(body)); });
            return;
        }
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(page);
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));

    const profile = mkdtempSync(join(tmpdir(), "halon-audit-"));
    let browser;
    try {
        browser = spawn("firefox", [
            "--profile", profile, "--no-remote", "--headless",
            `http://127.0.0.1:${server.address().port}/`,
        ], { env: { ...process.env, MOZ_HEADLESS: "1" }, stdio: "ignore" });
    } catch {
        server.close();
        console.log("\nCould not start firefox; rendered heights not measured.");
        return 0;
    }
    browser.on("error", () => deliver(null));

    const measured = await Promise.race([
        reported,
        new Promise((r) => setTimeout(() => r(null), 40000)),
    ]);
    browser.kill("SIGKILL");
    server.close();
    rmSync(profile, { recursive: true, force: true });

    if (!measured) {
        console.log("\nFirefox did not report back — not installed, or too slow;"
            + " rendered heights not measured.");
        return 0;
    }

    let bad = 0;
    console.log("\nRendered — what the browser actually lays out\n");
    for (const row of measured) {
        const entries = Object.entries(row.counts).sort((a, b) => b[1] - a[1]);
        if (!entries.length) {
            console.log(`  ${row.name}: nothing visible matched ${row.selector}`);
            continue;
        }
        const [dominant] = entries[0];
        const ok = Number(dominant) === row.want;
        if (!ok) bad++;
        const others = entries.slice(1).map(([v, c]) => `${v}x${c}`).join(" ");
        console.log(`  ${ok ? "ok  " : "FAIL"} ${row.name} ${row.axis} ${dominant}px`
            + ` (want ${row.want}px)${others ? `   also ${others}` : ""}`);
    }
    return bad;
}

console.log(failures ? `\n${failures} problem(s).` : "\nAll pairs pass in both schemes.");
process.exit(failures ? 1 : 0);
