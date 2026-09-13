#!/usr/bin/env node
/* Generates the Trilium theme from the GTK token files.
 *
 * A Trilium theme is one CSS note. Trilium exposes its own theming variables,
 * so THEME-DESIGN-GUIDE.md §2's mapping table is the whole port: trilium/_rules.css
 * assigns Trilium's variables to Halon's tokens and adds the handful of rules that
 * need real selectors. That file may not hold a colour; this script generates the
 * token layer in front of it and concatenates the two into trilium/halon.css.
 *
 * Every Trilium variable is assigned with `!important`. With `#appThemeBase=next`
 * the base stylesheets are appended *after* the custom theme, and they declare
 * several of the same variables on an equal-specificity plain `:root` — without
 * `!important` the base would simply win.
 *
 * The dark scheme is a `prefers-color-scheme` media query because that is what the
 * "next" base itself follows: with the base selected, Trilium links theme-next-light
 * unconditionally and theme-next-dark behind that same query, so the two flip
 * together. `--theme-style-auto` tells Trilium the theme follows the OS, which is
 * what keeps the editor's syntax theme and the native window in step.
 *
 * Usage:
 *   node scripts/build-trilium.mjs           # -> trilium/halon.css
 *   node scripts/build-trilium.mjs --check   # fail if the output is stale
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
   elevation ladder is rebuilt here from the same alpha values, exactly as the
   greeter's token layer does. */
const SHADOWS = {
    "shadow-item": (c) => `0 1px 2px ${c}`,
    "shadow-card": (c) => `0 1px 3px ${c}`,
    "shadow-tab": (c) => `0 1px 3px ${c}`,
    "shadow-floating": (c) => `0 2px 8px ${c}`,
    "shadow-modal": (c) => `0 8px 32px ${c}`,
};

/* Some of Trilium's shadow variables carry a whole box-shadow and some carry only
   its colour, so each role ships in both forms. */
const shadowColourName = (token) => `--${token}-color`;

/* Tokens the theme has no surface for: syntax is code only (§3.7), and Trilium
   colours code through its editor rather than through a theme variable. */
const SKIP = /^(syntax-|shadow-base$)/;

const alphaOf = (colour) => {
    const m = colour.match(/rgba\([^)]*?,\s*([\d.]+)\s*\)$/);
    if (!m) throw new Error(`expected an rgba() colour, got: ${colour}`);
    return m[1];
};

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
        lines.push(`    ${shadowColourName(token)}: ${t.get(token)};`);
    }

    /* One port-local value, derived rather than chosen: Trilium composes a few of
       its own shadows from a bare opacity, which no colour token can carry. */
    lines.push(`    --shadow-floating-opacity: ${alphaOf(t.get("shadow-floating"))};`);
    return lines.join("\n");
}

/* §4.1. Metrics do not flip with the scheme, so they are stated once.
 * --icon-button-size is the one token left out: Trilium already uses that name
 * as a per-component local, redefining it a dozen times, so a root declaration
 * would read as a token the port honours and in fact be shadowed everywhere. */
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
    --row-height: 28px;
    --border-width: 1px;
    --focus-ring-width: 3px;

    --radius-small: 4px;
    --radius-default: 8px;

    --text-label: 11px;
    --text-caption: 12px;
    --text-control: 13px;
    --text-prose: 14px;
    --text-h3: 15px;
    --text-h2: 19px;
    --text-h1: 26px;

    --line-height-body: 1.55;
    --line-height-ui: 1.2;`;

const indent = (block) =>
    block
        .split("\n")
        .map((line) => (line ? "    " + line : line))
        .join("\n");

const header = `/* Halon for Trilium — GENERATED FILE, do not edit.
 *
 * Written by scripts/build-trilium.mjs in the Halon repository from
 * gtk/Halon/shared/_tokens-*.css and trilium/_rules.css:
 * https://github.com/BeatLink/Halon
 *
 * Paste this into a CSS code note and give the note these labels:
 *
 *     #appThemeBase=next   #appTheme=Halon
 *
 * The theme follows the operating system's colour scheme, as the "next" base
 * it sits on does.
 */`;

const tokenLayer = `/* ==========================================================================
   Layer 1 — theme tokens. The only place a literal colour appears (§2).
   ========================================================================== */

:root {
${METRICS}

${scheme("light")}
}

/* §7 — one media query re-declaring the tokens, and nothing else. The "next"
   base flips on the same query, so the two never disagree. */
@media (prefers-color-scheme: dark) {
    :root {
${indent(scheme("dark"))}
    }
}`;

/* ---------- the layer rule ---------- */

/* A colour literal in the rules file would mean the port had quietly grown a
   second palette, which is the failure §2 exists to prevent. */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<![-\w])rgba?\(|(?<![-\w])hsla?\(/;

function auditRules(source) {
    let bad = 0;
    source.split("\n").forEach((line, i) => {
        if (!LITERAL.test(line)) return;
        console.error(`trilium/_rules.css:${i + 1}: colour literal outside the token layer`);
        console.error(`   ${line.trim().slice(0, 110)}`);
        bad++;
    });
    return bad;
}

/* ---------- write or check ---------- */

const rules = readFileSync(join(root, "trilium/_rules.css"), "utf8");
let problems = auditRules(rules);

const outPath = join(root, "trilium/halon.css");
const contents = `${header}\n\n${tokenLayer}\n\n${rules.trimStart()}`;

if (check) {
    if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
        console.error("trilium/halon.css is stale — run: node scripts/build-trilium.mjs");
        problems++;
    } else {
        console.log("trilium/halon.css is up to date.");
    }
} else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, contents);
    console.log(`Wrote ${outPath}`);
}

if (!problems) console.log("No colour literals outside the token layer.");
process.exit(problems ? 1 : 0);
