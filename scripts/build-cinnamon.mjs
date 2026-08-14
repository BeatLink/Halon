#!/usr/bin/env node
/* Generates cinnamon.css from cinnamon/_template.css and the GTK token files.
 *
 * St, Cinnamon's toolkit, has no custom properties and no @define-color, so the
 * shipped stylesheet has to be all literals. Rather than give up the two-layer
 * rule, the template keeps @token references and this substitutes them — which
 * means the Cinnamon theme, the GTK theme and the HTML demo all still derive
 * from one set of token files.
 *
 * Usage:
 *   node scripts/build-cinnamon.mjs             # light scheme -> gtk/Halon
 *   node scripts/build-cinnamon.mjs --dark      # dark scheme  -> gtk/Halon-Dark
 *   node scripts/build-cinnamon.mjs --check     # fail if the output is stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const dark = process.argv.includes("--dark");
const check = process.argv.includes("--check");
const noBase = process.argv.includes("--no-base");

/* Cinnamon replaces its default stylesheet with the theme's — it does not layer
   them — so every selector the theme omits renders unstyled rather than falling
   back. Mint-Y answers that by covering all 211 selectors itself; this answers it
   by shipping the default as a base and overriding on top, which keeps the theme
   small and means new Cinnamon widgets inherit something sane instead of nothing. */
const BASE_CANDIDATES = [
    "/run/current-system/sw/share/cinnamon/theme/cinnamon.css",
    "/usr/share/cinnamon/theme/cinnamon.css",
];

const scheme = dark ? "dark" : "light";
const themeDir = join(root, dark ? "gtk/Halon-Dark" : "gtk/Halon");
const template = join(root, "cinnamon/_template.css");
const tokensPath = join(root, `gtk/Halon/shared/_tokens-${scheme}.css`);
const outPath = join(themeDir, "cinnamon/cinnamon.css");

/* ---------- tokens ---------- */

const raw = {};
for (const m of readFileSync(tokensPath, "utf8").matchAll(/@define-color\s+([\w-]+)\s+([^;]+);/g)) {
    raw[m[1]] = m[2].trim();
}

const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`circular token: ${name}`);
    seen.add(name);
    const v = raw[name];
    if (v === undefined) throw new Error(`undefined token: @${name}`);
    return v.startsWith("@") ? resolve(v.slice(1), seen) : v;
};

/* ---------- substitute ---------- */

/* Drop the template's own banner; its prose talks about @tokens. */
const src = readFileSync(template, "utf8").replace(/^\/\*[\s\S]*?\*\/\n\n/, "");
const unknown = new Set();
const names = new Set(Object.keys(raw));

/* Substitute outside comments only, so explanatory comments can name tokens freely. */
let out = src
    .split(/(\/\*[\s\S]*?\*\/)/)
    .map((chunk) =>
        chunk.startsWith("/*")
            ? chunk
            : chunk.replace(/@([\w-]+)/g, (match, name) => {
                if (names.has(name)) return resolve(name);
                unknown.add(name);
                return match;
            }),
    )
    .join("");

if (unknown.size) {
    console.error(`Unknown tokens in template: ${[...unknown].map((n) => "@" + n).join(", ")}`);
    process.exit(1);
}

const basePath = noBase ? null : BASE_CANDIDATES.find((c) => existsSync(c));
if (!noBase && !basePath) {
    console.error("No Cinnamon default stylesheet found; pass --no-base to build overrides only.");
    process.exit(1);
}

/* The stock stylesheet is a dark theme. Including it verbatim meant every
 * selector Halon missed leaked dark grey — the whack-a-mole this replaces.
 * The base earns its keep through GEOMETRY (paddings, spacing, boxpointer
 * arrows, radii), so the palette is stripped and only structure survives:
 * unmatched nodes then inherit Halon's colours instead of stock's.
 */
function neutralize(css) {
    /* Colour-bearing properties go entirely. */
    css = css.replace(
        /(?<![-\w])(background-color|color|caret-color|selected-color|selection-background-color|-st-progress-color|-arrow-background-color|-arrow-border-color|-slider-background-color|-slider-active-background-color|-slider-border-color|-slider-active-border-color|background-gradient-start|background-gradient-end|background-gradient-direction|-gradient-start|-gradient-end|-gradient-direction|box-shadow|text-shadow|icon-shadow|border-image|border-color)\s*:\s*[^;}]*;?/g,
        "");
    /* Border shorthands keep their width — it is layout — and lose their paint. */
    css = css.replace(/(?<![-\w])(border(?:-top|-right|-bottom|-left)?)\s*:\s*([^;}]+)/g,
        (m, prop, val) => {
            if (/\bnone\b/.test(val)) return `${prop}: none`;
            const w = val.match(/\d+(?:\.\d+)?(?:px|em|pt)/);
            return `${prop}: ${w ? w[0] : "1px"} solid transparent`;
        });
    /* The few background: shorthands keep only their image. */
    css = css.replace(/(?<![-\w])background\s*:\s*([^;}]+)/g,
        (m, val) => {
            const url = val.match(/url\([^)]*\)/);
            return url ? `background-image: ${url[0]}` : "";
        });
    return css;
}

if (basePath) {
    const base = neutralize(readFileSync(basePath, "utf8"));
    out =
        `/* ---------- base: ${basePath} (palette-neutralized) ----------\n` +
        `   Stock geometry only: paddings, spacing, arrows, radii. Every colour,\n` +
        `   shadow and gradient was stripped at build time so unstyled widgets\n` +
        `   inherit Halon's palette instead of the stock dark theme's. */\n\n` +
        base +
        `\n\n/* ---------- Halon ---------- */\n\n` +
        out;
}

const header = `/* GENERATED FILE — do not edit.
 *
 * Built from cinnamon/_template.css with the ${scheme} token set by
 * scripts/build-cinnamon.mjs. Edit the template, then rebuild.
 * Base: ${basePath ?? "none (--no-base)"}
 */

`;
out = header + out;

/* ---------- write or check ---------- */

if (check) {
    if (!existsSync(outPath)) {
        console.error(`Missing ${outPath} — run: node scripts/build-cinnamon.mjs${dark ? " --dark" : ""}`);
        process.exit(1);
    }
    if (readFileSync(outPath, "utf8") !== out) {
        console.error(`${outPath} is stale — rebuild it.`);
        process.exit(1);
    }
    console.log(`${scheme}: cinnamon.css is up to date.`);
    process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);

/* ---------- image assets ----------
 * The stock stylesheet draws St toggles, checkboxes, radios, calendar arrows
 * and several buttons from SVG files resolved relative to the theme directory.
 * A theme that ships none of them renders those controls invisible. Generating
 * them from the tokens keeps them on-brand in both schemes, and using the
 * stock filenames means every stock rule that references them heals itself.
 */
const colour = (name) => resolve(name);
const svg = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

const ASSETS = {
    "checkbox.svg": svg(16, 16,
        `<rect x="1" y="1" width="14" height="14" rx="4" fill="${colour("accent")}"/>` +
        `<path d="M4.5 8.5 L7 11 L11.5 5.5" fill="none" stroke="${colour("text-on-fill")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    "checkbox-off.svg": svg(16, 16,
        `<rect x="1.5" y="1.5" width="13" height="13" rx="4" fill="${colour("surface-default")}" stroke="${colour("border-control")}"/>`),
    "radio.svg": svg(16, 16,
        `<circle cx="8" cy="8" r="6.5" fill="${colour("accent")}"/>` +
        `<circle cx="8" cy="8" r="2.5" fill="${colour("text-on-fill")}"/>`),
    "radio-off.svg": svg(16, 16,
        `<circle cx="8" cy="8" r="6" fill="${colour("surface-default")}" stroke="${colour("border-control")}"/>`),
    "toggle-on.svg": svg(44, 22,
        `<rect width="44" height="22" rx="11" fill="${colour("accent")}"/>` +
        `<circle cx="33" cy="11" r="8" fill="${colour("text-on-fill")}"/>`),
    "toggle-off.svg": svg(44, 22,
        `<rect x="0.5" y="0.5" width="43" height="21" rx="10.5" fill="${colour("surface-secondary")}" stroke="${colour("border-control")}"/>` +
        `<circle cx="11" cy="11" r="8" fill="${colour("text-tertiary")}"/>`),
    "calendar-arrow-left.svg": svg(16, 16,
        `<path d="M10 3 L5 8 L10 13" fill="none" stroke="${colour("text-secondary")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    "calendar-arrow-left-hover.svg": svg(16, 16,
        `<path d="M10 3 L5 8 L10 13" fill="none" stroke="${colour("text-heading")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    "calendar-arrow-right.svg": svg(16, 16,
        `<path d="M6 3 L11 8 L6 13" fill="none" stroke="${colour("text-secondary")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    "calendar-arrow-right-hover.svg": svg(16, 16,
        `<path d="M6 3 L11 8 L6 13" fill="none" stroke="${colour("text-heading")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    "close.svg": svg(24, 24,
        `<circle cx="12" cy="12" r="11" fill="${colour("status-danger")}"/>` +
        `<path d="M8 8 L16 16 M16 8 L8 16" stroke="${colour("text-on-fill")}" stroke-width="2" stroke-linecap="round"/>`),
    "add-workspace.svg": svg(32, 32,
        `<rect width="32" height="32" rx="6" fill="${colour("surface-navigation-hover")}"/>` +
        `<path d="M16 9 V23 M9 16 H23" stroke="${colour("text-on-navigation")}" stroke-width="2" stroke-linecap="round"/>`),
    "add-workspace-hover.svg": svg(32, 32,
        `<rect width="32" height="32" rx="6" fill="${colour("accent")}"/>` +
        `<path d="M16 9 V23 M9 16 H23" stroke="${colour("text-on-fill")}" stroke-width="2" stroke-linecap="round"/>`),
    "trash-icon.svg": svg(16, 16,
        `<path d="M3 4.5 H13 M6 4.5 V3 h4 v1.5 M4.5 4.5 L5.2 13.5 h5.6 L11.5 4.5 M6.5 7 v4 M9.5 7 v4" fill="none" stroke="${colour("text-secondary")}" stroke-width="1.4" stroke-linecap="round"/>`),
};
for (const [name, content] of Object.entries(ASSETS)) {
    writeFileSync(join(dirname(outPath), name), content);
}
console.log(`  assets: ${Object.keys(ASSETS).length} SVGs generated from the ${scheme} tokens`);

/* A dark variant is a whole theme directory, not just a stylesheet. */
if (dark) {
    mkdirSync(join(themeDir, "gtk-3.0"), { recursive: true });
    mkdirSync(join(themeDir, "gtk-4.0"), { recursive: true });
    writeFileSync(join(themeDir, "index.theme"),
        readFileSync(join(root, "gtk/Halon/index.theme"), "utf8")
            .replace(/Name=Halon/, "Name=Halon-Dark")
            .replace(/GtkTheme=Halon/, "GtkTheme=Halon-Dark")
            .replace(/MetacityTheme=Halon/, "MetacityTheme=Halon-Dark"));
    /* Entry files mirror Halon's own: base resource, tokens, reset, components.
       The base import is load-bearing — a named theme replaces the default
       stylesheet — and GTK 4's resources are gtk.css / gtk-dark.css only. */
    const gtk3Base = "resource:///org/gtk/libgtk/theme/Adwaita/gtk-contained-dark.css";
    const gtk4Base = "resource:///org/gtk/libgtk/theme/Default/gtk-dark.css";
    for (const file of ["gtk-3.0/gtk.css", "gtk-3.0/gtk-dark.css"]) {
        writeFileSync(join(themeDir, file),
            `/* Halon-Dark — the dark scheme as its own theme, for desktops that select by name. */\n` +
            `@import url("${gtk3Base}");\n` +
            `@import url("../../Halon/shared/_tokens-dark.css");\n` +
            `@import url("../../Halon/shared/_gtk3-metrics.css");\n` +
            `@import url("../../Halon/shared/_reset.css");\n` +
            `@import url("../../Halon/shared/_components.css");\n`);
    }
    for (const file of ["gtk-4.0/gtk.css", "gtk-4.0/gtk-dark.css"]) {
        writeFileSync(join(themeDir, file),
            `/* Halon-Dark — GTK 4 and libadwaita. */\n` +
            `@import url("${gtk4Base}");\n` +
            `@import url("../../Halon/shared/_tokens-dark.css");\n` +
            `@import url("../../Halon/shared/_adwaita-map.css");\n` +
            `@import url("../../Halon/shared/_reset.css");\n` +
            `@import url("../../Halon/shared/_components.css");\n`);
    }
}

const literals = (out.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length;
console.log(`Wrote ${outPath}`);
console.log(`  scheme: ${scheme}, ${Object.keys(raw).length} tokens, ${literals} literals emitted`);
