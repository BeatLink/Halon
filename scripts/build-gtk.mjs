#!/usr/bin/env node
/* Generates palette-neutral GTK base stylesheets.
 *
 * Halon needs the stock themes' GEOMETRY — paddings, minimum sizes, arrows,
 * radii — so unstyled widgets still render. It must not inherit their PAINT:
 * every Adwaita literal that reached the screen (washed-out toggle blues,
 * beige disabled fills, menubar underlines) was a leak from the verbatim
 * resource import. The same architecture as the Cinnamon build applies here:
 * strip the palette from the extracted base at build time, keep structure,
 * and a foreign colour cannot reach the screen by construction.
 *
 * Inputs:  gtk/Halon/shared/base/*.orig.css   (extracted via gresource from
 *          the exact GTK builds in use; re-extract when GTK updates)
 * Outputs: gtk/Halon/shared/base/<name>.css   (neutralized)
 *
 * Usage:
 *   node scripts/build-gtk.mjs           # write the neutral bases
 *   node scripts/build-gtk.mjs --check   # fail if any output is stale
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphSvg } from "./assets.mjs";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const baseDir = join(root, "gtk/Halon/shared/base");
const check = process.argv.includes("--check");

/* Properties that are pure paint: dropped wholesale. The lookbehind excludes
 * ".", "#" and word characters so `.color` in a SELECTOR is never mistaken
 * for the `color` property — the bug that once mangled `.osd button.color`. */
const PROP = (names) => new RegExp("(?<![-\\w.#&])(?:" + names + ")\\s*:\\s*[^;}]*;?", "g");

const DROP = PROP([
    "background-color", "color", "caret-color", "-gtk-secondary-caret-color",
    "outline-color", "box-shadow", "text-shadow", "-gtk-icon-shadow",
    "border-image(?:-[a-z]+)?", "border-color",
    "border-(?:top|right|bottom|left)-color",
    "-GtkTextView-error-underline-color",
].join("|"));

/* background-image survives only when it paints no colour of its own. */
const PAINTED_IMAGE = /image\s*\(|linear-gradient|radial-gradient|cross-fade|conic-gradient|-gtk-gradient/;

function neutralize(css) {
    /* Comments can quote colours; they carry no paint. */
    css = css.replace(/\/\*[\s\S]*?\*\//g, "");

    /* The base palette definitions go entirely — Halon's layer defines every
       name an application may reference. */
    css = css.replace(/@define-color[^;]+;/g, "");

    css = css.replace(DROP, "");

    /* Keep icon-theme lookups and plain urls; gradients and colour images go. */
    css = css.replace(/(?<![-\w.#&])background-image\s*:\s*([^;}]+);?/g,
        (m, val) => PAINTED_IMAGE.test(val) ? "" : m);

    /* `background:` shorthand — keep only a colourless image component. */
    css = css.replace(/(?<![-\w.#&])background\s*:\s*([^;}]+);?/g, (m, val) => {
        if (PAINTED_IMAGE.test(val)) return "";
        const img = val.match(/(-gtk-icontheme|url)\([^)]*\)/);
        return img ? `background-image: ${img[0]};` : "";
    });

    /* Adwaita's bundled png/svg assets are not shipped; a reference to a
       missing file is a warning on every launch. */
    css = css.replace(/(?<![-\w.#&])[-a-z]+\s*:\s*[^;}]*url\("?assets\/[^;}]*;?/g, "");

    /* Outline shorthands keep width and style; the colour comes from Halon. */
    css = css.replace(/(?<![-\w.#&])outline\s*:\s*([^;}]+)/g,
        (m, val) => "outline: " + val.replace(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g, "").replace(/\s+/g, " ").trim());

    /* Every filter is paint, including a bare opacity() with no colour in it. */
    css = css.replace(/(?<![-\w.#&])filter\s*:\s*[^;}]*;?/g, "");

    /* Border shorthands keep their width — layout — and lose their paint. */
    css = css.replace(/(?<![-\w.#&])(border(?:-top|-right|-bottom|-left)?)\s*:\s*([^;}]+)/g,
        (m, prop, val) => {
            if (/\bnone\b/.test(val)) return `${prop}: none`;
            const w = val.match(/\d+(?:\.\d+)?(?:px|em|pt)/);
            return `${prop}: ${w ? w[0] : "1px"} solid transparent`;
        });

    return css;
}

const HEADER = (name) => `/* GENERATED FILE — do not edit.
 *
 * ${name}, palette-neutralized by scripts/build-gtk.mjs: geometry, minimum
 * sizes, arrows and radii survive; every colour, gradient, shadow and painted
 * image was stripped so Halon's layers are the only paint. Regenerate after
 * re-extracting the .orig.css when the GTK version changes.
 */

`;

/* GTK 4 has no builtin indicator glyphs, so check/radio/switch marks are
 * generated per scheme from the tokens, like the Cinnamon assets. */
const tokensFor = (scheme) => {
    const raw = {};
    const css = readFileSync(join(root, `gtk/Halon/shared/_tokens-${scheme}.css`), "utf8");
    for (const m of css.matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) raw[m[1]] = m[2].trim();
    const resolve = (n) => raw[n]?.startsWith("@") ? resolve(raw[n].slice(1)) : raw[n];
    return resolve;
};

function writeGtk4Icons(checkOnly) {
    const iconDir = join(root, "gtk/Halon/shared/icons");
    if (!existsSync(iconDir)) mkdirSync(iconDir, { recursive: true });
    for (const scheme of ["light", "dark"]) {
        const colour = tokensFor(scheme);
        const onFill = colour("text-on-fill");
        const svgs = {
            [`check-${scheme}.svg`]: glyphSvg.check(onFill),
            [`dash-${scheme}.svg`]: glyphSvg.dash(onFill),
            [`dot-${scheme}.svg`]: glyphSvg.dot(onFill),
        };
        for (const [name, body] of Object.entries(svgs)) writeFileSync(join(iconDir, name), body + "\n");
        writeFileSync(join(root, `gtk/Halon/shared/_icons-${scheme}.css`),
`/* GENERATED FILE — do not edit. Indicator glyphs for both toolkits, drawn
 * from the ${scheme} tokens by scripts/build-gtk.mjs — url() icon sources
 * work in GTK 3 and GTK 4 alike, and match the demo's glyph weight. */

check:checked { -gtk-icon-source: url("icons/check-${scheme}.svg"); }
check:indeterminate { -gtk-icon-source: url("icons/dash-${scheme}.svg"); }
radio:checked { -gtk-icon-source: url("icons/dot-${scheme}.svg"); }
radio:indeterminate { -gtk-icon-source: url("icons/dash-${scheme}.svg"); }
`);
    }
    console.log("Wrote indicator glyphs for both schemes");
}

let problems = 0;
for (const orig of readdirSync(baseDir).filter((f) => f.endsWith(".orig.css"))) {
    const outName = orig.replace(".orig.css", ".css");
    const outPath = join(baseDir, outName);
    const out = HEADER(orig) + neutralize(readFileSync(join(baseDir, orig), "utf8"));

    /* The whole point: assert no colour survives in any declaration value. */
    const stray = out.match(/:[^;{}]*(#[0-9a-fA-F]{3,8}\b|(?<![-\w])rgba?\()[^;{}]*/g);
    if (stray) {
        console.error(`${outName}: ${stray.length} colour literal(s) survived neutralization`);
        for (const line of out.split("\n")) {
            if (/#[0-9a-fA-F]{3,8}\b|(?<![-\w])rgba?\(/.test(line)) console.error("   " + line.trim().slice(0, 110));
        }
        problems++;
        continue;
    }

    if (check) {
        if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== out) {
            console.error(`${outName} is stale — run: node scripts/build-gtk.mjs`);
            problems++;
        } else {
            console.log(`${outName}: up to date, zero colour literals`);
        }
    } else {
        writeFileSync(outPath, out);
        console.log(`Wrote ${outPath} (zero colour literals)`);
    }
}

if (!check) writeGtk4Icons();
process.exit(problems ? 1 : 0);
