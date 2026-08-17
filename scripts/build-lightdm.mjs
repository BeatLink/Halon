#!/usr/bin/env node
/* Generates the LightDM web greeter's token layer from the GTK token files.
 *
 * The greeter is the one port that owns its whole stylesheet, so the two-layer
 * rule of THEME-DESIGN-GUIDE.md §2 is enforced by splitting the CSS in two:
 * lightdm/tokens.css is generated here and is the only file that may hold a
 * colour, and lightdm/style.css is a source file that may only reference the
 * custom properties this one defines. The check below fails the build if a
 * literal ever appears on the wrong side of that line.
 *
 * Both schemes ship in the one theme directory. QtWebEngine's Chromium is old
 * enough on some Qt builds that light-dark() cannot be relied on, so the dark
 * scheme is a plain media query plus a [data-scheme] attribute the greeter's
 * own toggle sets, rather than the demo's single-value form.
 *
 * Usage:
 *   node scripts/build-lightdm.mjs           # -> lightdm/tokens.css
 *   node scripts/build-lightdm.mjs --check   # fail if the output is stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

/* ---------- tokens ---------- */

const loadTokens = (scheme) => {
    const raw = {};
    const path = join(root, `gtk/Halon/shared/_tokens-${scheme}.css`);
    for (const m of readFileSync(path, "utf8").matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) {
        raw[m[1]] = m[2].trim();
    }
    const resolve = (name, seen = new Set()) => {
        if (seen.has(name)) throw new Error(`circular token: ${name}`);
        seen.add(name);
        const v = raw[name];
        if (v === undefined) throw new Error(`undefined token: @${name}`);
        return v.startsWith("@") ? resolve(v.slice(1), seen) : v;
    };
    return { names: Object.keys(raw), get: (name) => resolve(name) };
};

/* GTK spells its shadows as bare colours; CSS needs the offsets too, so §5's
   elevation ladder is rebuilt here from the same alpha values. */
const SHADOWS = {
    "shadow-item": (c) => `0 1px 2px ${c}`,
    "shadow-card": (c) => `0 1px 3px ${c}`,
    "shadow-tab": (c) => `0 1px 3px ${c}`,
    "shadow-floating": (c) => `0 2px 8px ${c}`,
    "shadow-modal": (c) => `0 8px 32px ${c}`,
};

/* The select arrow is an inline SVG, so it carries a colour and has to be
   generated per scheme like the GTK indicator glyphs. */
const selectArrow = (colour) =>
    `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke=${
        "'" + colour.replace("#", "%23") + "'"
    } stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")`;

/* Tokens the greeter has no surface for: syntax is code only, per §3.7. */
const SKIP = /^(syntax-|shadow-base$)/;

function scheme(name) {
    const t = loadTokens(name);
    const lines = [];

    for (const token of t.names) {
        if (SKIP.test(token)) continue;
        if (token in SHADOWS) continue;
        lines.push(`    --${token}: ${t.get(token)};`);
    }
    for (const [token, shape] of Object.entries(SHADOWS)) {
        lines.push(`    --${token}: ${shape(t.get(token))};`);
    }
    lines.push(`    --select-arrow: ${selectArrow(t.get("accent"))};`);
    lines.push(`    color-scheme: ${name};`);
    return lines.join("\n");
}

/* §4.1, verbatim. Metrics do not flip with the scheme, so they are stated once. */
const METRICS = `    --font-family-interface:
        system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Noto Sans", Cantarell, "Helvetica Neue", Arial, sans-serif,
        "Apple Color Emoji", "Segoe UI Emoji";

    --space-1: 2px;
    --space-2: 4px;
    --space-3: 6px;
    --space-4: 8px;
    --space-5: 12px;
    --space-6: 16px;
    --space-7: 24px;
    --space-8: 32px;

    --control-height: 32px;
    --control-padding-x: 14px;
    --icon-button-size: 30px;
    --row-height: 28px;
    --border-width: 1px;
    --focus-ring-width: 3px;

    --radius-small: 4px;
    --radius-row: 6px;
    --radius-default: 8px;
    --radius-window: 10px;
    --radius-pill: 9999px;

    --text-label: 11px;
    --text-caption: 12px;
    --text-control: 13px;
    --text-prose: 14px;
    --text-h3: 15px;
    --text-h2: 19px;
    --text-h1: 26px;

    --line-height-ui: 1.2;`;

const tokensCss = () => `/* GENERATED FILE — do not edit. Layer 1 for the LightDM greeter, written by
 * scripts/build-lightdm.mjs from gtk/Halon/shared/_tokens-*.css. Every colour
 * in this port lives here; lightdm/style.css may only reference these names.
 */

:root {
${METRICS}

${scheme("light")}
}

/* The system preference decides unless the greeter's own toggle has spoken. */
@media (prefers-color-scheme: dark) {
    :root:not([data-scheme="light"]) {
${scheme("dark")
    .split("\n")
    .map((l) => "    " + l)
    .join("\n")}
    }
}

:root[data-scheme="dark"] {
${scheme("dark")}
}

:root[data-scheme="light"] {
${scheme("light")}
}
`;

/* ---------- the layer rule ---------- */

/* A colour literal in the source files would mean the port had quietly grown a
   second palette, which is the failure §2 exists to prevent. */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<![-\w])rgba?\(|(?<![-\w])hsla?\(/;

function auditSources() {
    let bad = 0;
    for (const relative of ["lightdm/style.css", "lightdm/index.html", "lightdm/greeter.js"]) {
        const path = join(root, relative);
        if (!existsSync(path)) continue;
        readFileSync(path, "utf8").split("\n").forEach((line, i) => {
            /* currentColor in an inline SVG is not a literal, and neither is a
               fragment link or a percent-encoded one inside a data URI. */
            if (line.includes("charset=utf-8")) return;
            if (!LITERAL.test(line)) return;
            console.error(`${relative}:${i + 1}: colour literal outside the token layer`);
            console.error(`   ${line.trim().slice(0, 110)}`);
            bad++;
        });
    }
    return bad;
}

/* ---------- write or check ---------- */

let problems = auditSources();
const outPath = join(root, "lightdm/tokens.css");
const contents = tokensCss();

if (check) {
    if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
        console.error("lightdm/tokens.css is stale — run: node scripts/build-lightdm.mjs");
        problems++;
    } else {
        console.log("lightdm/tokens.css is up to date.");
    }
} else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, contents);
    console.log(`Wrote ${outPath}`);
}

if (!problems) console.log("No colour literals outside the token layer.");
process.exit(problems ? 1 : 0);
