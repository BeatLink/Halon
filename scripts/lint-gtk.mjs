#!/usr/bin/env node
/* Structural lint for the GTK theme.
 *
 * GTK reports an undefined @color or a bad @import only as a runtime warning on
 * stderr, long after the mistake, and a misspelled token simply renders wrong.
 * This checks the three things that fail silently:
 *
 *   1. every @token referenced is defined by an import that precedes it
 *   2. no literal colour appears outside a token file (the Layer 2 rule, §2)
 *   3. @import lines come first, since GTK ignores later ones
 */

import { readFileSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const themeDir = join(root, "gtk/Halon");

const ENTRIES = [
    "gtk-3.0/gtk.css",
    "gtk-3.0/gtk-dark.css",
    "gtk-4.0/gtk.css",
    "gtk-4.0/gtk-dark.css",
];

const TOKEN_FILES = /_tokens-(light|dark)\.css$/;
const AT_KEYWORDS = new Set(["define-color", "import", "media", "keyframes", "supports", "charset"]);

let problems = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); problems++; };

/* Follows @import in order, returning the flattened file list. */
function chain(entryPath, seen = []) {
    const text = readFileSync(entryPath, "utf8");
    seen.push({ path: entryPath, text });
    for (const m of text.matchAll(/@import\s+url\(["']([^"']+)["']\)\s*;/g)) {
        /* resource:// imports are GTK's built-in stylesheets, not files on disk. */
        if (m[1].startsWith("resource:")) continue;
        chain(resolvePath(dirname(entryPath), m[1]), seen);
    }
    return seen;
}

for (const entry of ENTRIES) {
    const entryPath = join(themeDir, entry);
    console.log(entry);

    let files;
    try {
        files = chain(entryPath);
    } catch (e) {
        fail(`broken import chain: ${e.message}`);
        continue;
    }

    /* 3. imports must precede any rule, or GTK drops them. */
    for (const { path, text } of files) {
        const firstRule = text.search(/^[^@\s/][^\n]*\{/m);
        const lastImport = text.lastIndexOf("@import");
        if (lastImport !== -1 && firstRule !== -1 && lastImport > firstRule) {
            fail(`${path}: @import appears after a rule and will be ignored`);
        }
    }

    /* 1. references resolve against everything defined earlier in the chain. */
    const defined = new Set();
    for (const { path, text } of files) {
        const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
        for (const m of stripped.matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) {
            for (const ref of m[2].matchAll(/@([\w-]+)/g)) {
                if (!defined.has(ref[1])) {
                    fail(`${path}: @${ref[1]} used in ${m[1]} before it is defined`);
                }
            }
            defined.add(m[1]);
        }
        for (const m of stripped.matchAll(/@([\w-]+)/g)) {
            const name = m[1];
            if (AT_KEYWORDS.has(name) || defined.has(name)) continue;
            const decl = stripped.slice(0, m.index).lastIndexOf("@define-color");
            const semi = stripped.slice(0, m.index).lastIndexOf(";");
            if (decl > semi) continue;   // already reported above
            fail(`${path}: @${name} is not defined`);
        }
    }

    /* 2. no literal colours outside the token files. */
    for (const { path, text } of files) {
        if (TOKEN_FILES.test(path)) continue;
        const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
        for (const m of stripped.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)) {
            const line = stripped.slice(0, m.index).split("\n").length;
            fail(`${path}:${line}: literal colour ${m[0]} outside a token file`);
        }
    }

    if (!problems) console.log("  ✓ ok");
    console.log();
}

console.log(problems ? `${problems} problem(s).` : "GTK theme structure is clean.");
process.exit(problems ? 1 : 0);
