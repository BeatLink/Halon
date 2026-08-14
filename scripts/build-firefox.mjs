#!/usr/bin/env node
/* Generates the Firefox static theme from the GTK token files.
 *
 * A Firefox theme is a WebExtension whose manifest carries a flat map of colour
 * keys, so there is no variable layer in the shipped artifact — the two-layer
 * rule survives by keeping the mapping here in token names and substituting at
 * build time, as the VS Code and Cinnamon builds do. Both schemes come from the
 * same mapping; only the token file differs, and they ship together in one
 * manifest (`theme` plus `dark_theme`) so Firefox picks by its own appearance
 * setting.
 *
 * Firefox is a standalone application, so THEME-DESIGN-GUIDE.md §6.4 applies in
 * its first form: the tab bar and the navigation toolbar are the frame, which
 * sits on the secondary surface in both schemes. The selected tab is a raised
 * card on it (§6.5) rather than the one light thing in a dark strip, which is
 * also why the address bar is a navigation-hover field rather than a white one:
 * a field the colour of the content surface would read as content, not chrome.
 *
 * Geometry lives in firefox/userChrome.css, which is a source file rather than a
 * generated one: it names no colours, only §4 metrics and the LWT variables
 * Firefox populates from the manifest below.
 *
 * Usage:
 *   node scripts/build-firefox.mjs             # -> firefox/manifest.json, firefox/icon.svg
 *   node scripts/build-firefox.mjs --check     # fail if the output is stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

const VERSION = "1.0.0";

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
    return (name) => resolve(name);
};

/* Firefox takes any CSS colour string, so hex tokens pass through untouched. */
const rgb = (value) => {
    if (value.startsWith("#")) {
        const h = value.length === 4 ? "#" + [...value.slice(1)].map((c) => c + c).join("") : value;
        return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const nums = value.match(/[\d.]+/g);
    if (!nums) throw new Error(`unparseable color: ${value}`);
    return nums.slice(0, 3).map(Number);
};

const withAlpha = (value, fraction) => `rgba(${rgb(value).join(", ")}, ${fraction})`;

/* ---------- the theme ---------- */

function variant(scheme) {
    const t = loadTokens(scheme);
    const a = (name, fraction) => withAlpha(t(name), fraction);

    return {
        colors: {
            /* The frame — §6.4. Tab bar, toolbar and their inactive states are one strip
               on the secondary surface: gray in light, near-black in dark. */
            "frame": t("surface-navigation"),
            "frame_inactive": t("surface-navigation"),
            "toolbar": t("surface-navigation"),
            "toolbar_text": t("text-on-navigation"),
            "bookmark_text": t("text-on-navigation"),
            "icons": t("text-on-navigation"),
            "icons_attention": t("accent"),

            /* Tabs — §6.5 selection: a raised card in the frame, marked by the accent line
               rather than by fill alone, since the fill is one quiet step off the frame. */
            "tab_background_text": t("text-on-navigation"),
            "tab_selected": t("surface-default"),
            "tab_text": t("text-heading"),
            "tab_line": t("accent"),
            "tab_loading": t("accent"),
            "tab_background_separator": t("surface-navigation-hover"),

            /* Frame separators — hairlines inside the frame, never a seam of another surface. */
            "toolbar_top_separator": t("surface-navigation"),
            "toolbar_bottom_separator": t("surface-navigation"),
            "toolbar_vertical_separator": t("surface-navigation-hover"),

            /* Toolbar buttons — §6.1 flat weight: hover gains ground, it does not light up. */
            "button_background_hover": t("surface-navigation-hover"),
            "button_background_active": a("accent", 0.25),

            /* Address and search bars — §6.2 inside the frame, so the fill is navigation-hover
               and the border moves to the accent on focus while the fill stays put. */
            "toolbar_field": t("surface-navigation-hover"),
            "toolbar_field_text": t("text-heading"),
            "toolbar_field_border": t("surface-navigation-hover"),
            "toolbar_field_focus": t("surface-navigation-hover"),
            "toolbar_field_text_focus": t("text-heading"),
            "toolbar_field_border_focus": t("accent"),
            "toolbar_field_highlight": t("accent"),
            "toolbar_field_highlight_text": t("text-on-light"),

            /* Popups and menus — §6.6: a normal content surface with a hairline. */
            "popup": t("surface-default"),
            "popup_text": t("text-body"),
            "popup_border": t("border-default"),
            "popup_highlight": t("surface-secondary"),
            "popup_highlight_text": t("text-heading"),

            /* Sidebar — §6.5: the frame surface, with a solid accent selection. */
            "sidebar": t("surface-secondary"),
            "sidebar_text": t("text-body"),
            "sidebar_border": t("border-default"),
            "sidebar_highlight": t("accent"),
            "sidebar_highlight_text": t("text-on-fill"),

            /* New tab page — the root surface with cards on the default one. */
            "ntp_background": t("surface-root"),
            "ntp_card_background": t("surface-default"),
            "ntp_text": t("text-body"),
        },
        properties: {
            /* The frame is the secondary surface, so unthemed chrome follows the scheme. */
            "color_scheme": scheme,
            "content_color_scheme": scheme,
        },
    };
}

/* The icon is the theme's one idea at 64px: a quiet frame, one raised tab, one accent.
   It grounds on the accent rather than on a surface so it stays legible on any
   background the add-ons list happens to paint behind it. */
function icon() {
    const t = loadTokens("light");
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`,
        `<rect width="64" height="64" rx="10" fill="${t("accent")}"/>`,
        `<rect x="8" y="10" width="22" height="12" rx="4" fill="${t("surface-default")}"/>`,
        `<rect x="34" y="10" width="22" height="12" rx="4" fill="${t("accent")}"/>`,
        `<rect x="8" y="28" width="48" height="8" rx="4" fill="${t("accent")}"/>`,
        `<rect x="8" y="42" width="48" height="14" rx="4" fill="${t("surface-default")}"/>`,
        `</svg>`,
        ``,
    ].join("\n");
}

const manifest = () => ({
    manifest_version: 2,
    name: "Halon",
    version: VERSION,
    description: "Slate and blue, one accent, hairline structure. WCAG 2.1 AA in both schemes.",
    browser_specific_settings: { gecko: { id: "halon@halon.theme" } },
    icons: { 48: "icon.svg", 96: "icon.svg" },
    theme: variant("light"),
    dark_theme: variant("dark"),
});

/* ---------- write or check ---------- */

const outputs = [
    ["firefox/manifest.json", JSON.stringify(manifest(), null, 4) + "\n"],
    ["firefox/icon.svg", icon()],
];

let stale = false;
for (const [relative, contents] of outputs) {
    const outPath = join(root, relative);

    if (check) {
        if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
            console.error(`${outPath} is stale — run: node scripts/build-firefox.mjs`);
            stale = true;
        } else {
            console.log(`${relative} is up to date.`);
        }
        continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, contents);
    console.log(`Wrote ${outPath}`);
}
if (stale) process.exit(1);
