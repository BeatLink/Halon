#!/usr/bin/env node
/* Publishes the GTK token files as JSON, for consumers that are not stylesheets.
 *
 * The tokens are authored as @define-color in gtk/Halon/shared, which only a GTK
 * parser reads. A Nix configuration theming a compositor, a bar or a lock screen
 * needs the same colours as data, and the alternative is transcribing hex by hand
 * into a second place that then drifts. Both schemes are resolved and hexified,
 * so every value is #rrggbb or #rrggbbaa with no references left to follow.
 *
 * Usage:
 *   node scripts/build-tokens.mjs             # both schemes -> tokens.json
 *   node scripts/build-tokens.mjs --check     # fail if the output is stale
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

/* rgba() tokens become #rrggbbaa, so a consumer never has to parse two syntaxes. */
const hexify = (value) => {
    if (value.startsWith("#")) {
        return value.length === 4 ? "#" + [...value.slice(1)].map((c) => c + c).join("") : value.toLowerCase();
    }
    const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (!m) throw new Error(`unparseable color: ${value}`);
    const byte = (n) => Math.round(Number(n)).toString(16).padStart(2, "0");
    return ("#" + byte(m[1]) + byte(m[2]) + byte(m[3]) + (m[4] === undefined ? "" : byte(m[4] * 255))).toLowerCase();
};

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
    return Object.fromEntries(Object.keys(raw).sort().map((name) => [name, hexify(resolve(name))]));
};

const out =
    JSON.stringify(
        {
            _comment: "GENERATED FILE — do not edit. Built from gtk/Halon/shared/_tokens-*.css by scripts/build-tokens.mjs.",
            light: loadTokens("light"),
            dark: loadTokens("dark"),
        },
        null,
        4,
    ) + "\n";

const outPath = join(root, "tokens.json");

if (check) {
    if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== out) {
        console.error(`${outPath} is stale — run: node scripts/build-tokens.mjs`);
        process.exit(1);
    }
    console.log("tokens.json is up to date.");
} else {
    writeFileSync(outPath, out);
    console.log(`Wrote ${outPath}`);
}
