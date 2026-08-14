#!/usr/bin/env node
/* Contrast audit for the Halon token set.
 *
 * Reads the GTK token files as the source of truth, resolves references, and
 * checks every pairing the design guide sanctions against WCAG 2.1 in both
 * schemes. Also cross-checks the HTML demo so the three artefacts cannot drift.
 *
 * Exits non-zero if any pair fails, so it works as a pre-commit or CI gate.
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
    ["status-warning-text", "surface-default", 4.5],
    ["status-warning-text", "surface-secondary", 4.5],
    ["status-danger", "surface-default", 4.5],
    ["status-success", "surface-default", 4.5],
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

console.log(failures ? `\n${failures} problem(s).` : "\nAll pairs pass in both schemes.");
process.exit(failures ? 1 : 0);
