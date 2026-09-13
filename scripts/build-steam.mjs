#!/usr/bin/env node
/* Generates the Millennium theme for the Steam client from the GTK token files.
 *
 * Steam's client is a Chromium view, so unlike the Cinnamon and LMMS ports this
 * one keeps the two-layer rule in the shipped artifact: the generated sheets open
 * with a `:root` block holding every token as a `--halon-*` custom property, and
 * the component rules underneath only ever say `var(--halon-…)`. Both schemes
 * live in that one block through `light-dark()`, and the scheme is picked by the
 * theme's own setting in Steam — see steam/README.md.
 *
 * The hard part of theming Steam is not colour, it is naming. Steam's client CSS
 * is built from CSS modules, so nearly every class is a content hash like
 * `_3Z7VQ1IMk4E3HsHvrkLNgo`, and a sheet written against those reads as noise and
 * rots silently when Steam rebuilds a module. So the sources here are written
 * against names — `%TopBar%`, `%GameListEntry%` — and steam/selectors.json holds
 * the mapping. Steam ships the same names in its JavaScript bundles (the module
 * maps survive minification as `Name:"hash"` pairs), so --refresh re-derives the
 * mapping from an installed client and reports every name whose hash moved.
 *
 * Usage:
 *   node scripts/build-steam.mjs             # -> steam/*.css, steam/skin.json
 *   node scripts/build-steam.mjs --check     # fail if the output is stale
 *   node scripts/build-steam.mjs --refresh   # re-derive steam/selectors.json
 *                                            #   from $STEAM_ROOT's steamui
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const refresh = process.argv.includes("--refresh");

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
    return { names: Object.keys(raw), get: (name) => resolve(name) };
};

const LIGHT = loadTokens("light");
const DARK = loadTokens("dark");

/* The token block every generated sheet opens with. `color-scheme` is what makes
   light-dark() pick a side, so the scheme files set only that one variable and
   the whole palette follows. The default, `light dark`, defers to the desktop. */
function tokenBlock() {
    const lines = [
        "/* Layer 1 — the token set, both schemes. Nothing below this block names a colour. */",
        ":root {",
        "    color-scheme: var(--halon-color-scheme, light dark);",
        "",
    ];
    for (const name of LIGHT.names) {
        const light = LIGHT.get(name);
        const dark = DARK.get(name);
        const value = light === dark ? light : `light-dark(${light}, ${dark})`;
        lines.push(`    --halon-${name}: ${value};`);
    }
    lines.push("}", "");
    return lines.join("\n");
}

/* ---------- selectors ---------- */

const selectorsPath = join(root, "steam/selectors.json");

/* Steam compiles the same component into several bundles — the main window, the
   friends window, the overlay — so one name legitimately owns several hashes.
   :is() takes the list without breaking compound selectors like
   `%ContextMenuItem%%ContextMenuItemSelected%`, and carries a class's
   specificity rather than the sum of the list's. */
const expand = (classes) =>
    classes.length === 1 ? `.${classes[0]}` : `:is(${classes.map((c) => `.${c}`).join(", ")})`;

function loadSelectors() {
    const file = JSON.parse(readFileSync(selectorsPath, "utf8"));
    const map = {};
    for (const [name, entry] of Object.entries(file.selectors)) map[name] = expand(entry.classes);
    return map;
}

/* ---------- refresh ---------- */

/* Rebuilds the name -> hash table from an installed client. Steam's JS bundles
   carry the CSS-module maps verbatim, so a `Name:"hash"` pair whose hash also
   appears as a class in the shipped CSS is a real component name. A name can
   have several candidates; selectors.json records which ones the theme uses, and
   this only reports drift rather than rewriting a curated choice, because two
   unrelated modules both exporting `Container` is the normal case. */
function refreshSelectors() {
    const steamRoot = process.env.STEAM_ROOT ?? join(process.env.HOME ?? "", ".local/share/Steam");
    const ui = join(steamRoot, "steamui");
    if (!existsSync(ui)) {
        console.error(`no Steam client at ${ui} — set STEAM_ROOT to the Steam directory`);
        process.exit(1);
    }

    const cssDir = join(ui, "css");
    let css = "";
    for (const f of readdirSync(cssDir)) if (f.endsWith(".css")) css += readFileSync(join(cssDir, f), "utf8");
    const present = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));

    const candidates = new Map();
    for (const f of readdirSync(ui)) {
        if (!f.endsWith(".js")) continue;
        const src = readFileSync(join(ui, f), "utf8");
        for (const m of src.matchAll(/([A-Za-z][A-Za-z0-9_]{2,}):"(-?[_a-zA-Z][\w-]{6,})"/g)) {
            const [, name, hash] = m;
            if (!present.has(hash)) continue;
            if (!candidates.has(name)) candidates.set(name, new Set());
            candidates.get(name).add(hash);
        }
    }

    const file = JSON.parse(readFileSync(selectorsPath, "utf8"));
    const changelist = join(ui, "changelist.txt");
    const build = existsSync(changelist)
        ? readFileSync(changelist, "utf8").trim().split(/\s+/)[0]
        : file.steamBuild;
    let drifted = 0;

    for (const [name, entry] of Object.entries(file.selectors)) {
        const found = candidates.get(entry.symbol) ?? new Set();
        const gone = entry.classes.filter((c) => !present.has(c));
        const unnamed = entry.classes.filter((c) => present.has(c) && !found.has(c));

        if (gone.length) {
            console.error(`${name}: ${gone.join(", ")} no longer in Steam's CSS` +
                (found.size ? ` — candidates for ${entry.symbol}: ${[...found].join(", ")}` : ""));
            drifted++;
        } else if (unnamed.length) {
            console.error(`${name}: ${unnamed.join(", ")} is still styled but no longer exported as ${entry.symbol}`);
            drifted++;
        }
    }

    file.steamBuild = build;
    writeFileSync(selectorsPath, JSON.stringify(file, null, 4) + "\n");
    console.log(`Checked ${Object.keys(file.selectors).length} selectors against Steam build ${build}.`);
    if (drifted) {
        console.error(`${drifted} need a new hash — find it in the client's CSS and update steam/selectors.json.`);
        process.exit(1);
    }
    console.log("All selectors still resolve.");
}

/* ---------- sources ---------- */

/* A source keeps @token references and %Selector% names; both are substituted
   here so the two-layer rule and the naming survive into a sheet Steam can read. */
function compile(sources, selectors) {
    const banner = [
        "/* Halon for Steam — GENERATED FILE, do not edit.",
        " * Built from steam/src/ and gtk/Halon/shared/_tokens-*.css by scripts/build-steam.mjs.",
        " */",
        "",
    ].join("\n");

    const body = sources
        /* Drop each source's own banner; its prose talks about @tokens and %names%. */
        .map((name) => readFileSync(join(root, "steam/src", name), "utf8").replace(/^\/\*[\s\S]*?\*\/\n\n/, ""))
        .join("\n")
        .replace(/%([A-Za-z][A-Za-z0-9]*)%/g, (_, name) => {
            const value = selectors[name];
            if (value === undefined) throw new Error(`unknown selector: %${name}%`);
            return value;
        })
        .replace(/@([a-z][\w-]*)/g, (whole, name) => {
            if (!LIGHT.names.includes(name)) return whole; /* @media, @keyframes, … */
            return `var(--halon-${name})`;
        });

    return banner + tokenBlock() + "\n" + body;
}

/* ---------- skin.json ---------- */

/* UseDefaultPatches is Millennium's own mapping of file name to Steam window, and
   Steam-WebKit covers the store and community browser views; between them every
   window this theme styles is covered, so the theme carries no Patches of its own.
   The one condition is the scheme, which sets a single variable (see tokenBlock). */
const skin = () => ({
    name: "Halon",
    author: "BeatLink",
    description: "Slate and blue, one accent, hairline structure. A recessed frame and raised content.",
    version: VERSION,

    github: { owner: "BeatLink", repo_name: "Halon" },
    header_image: "https://raw.githubusercontent.com/BeatLink/Halon/main/screenshots/demo-dark.png",
    splash_image: "https://raw.githubusercontent.com/BeatLink/Halon/main/screenshots/demo-dark.png",
    tags: ["Dark", "Light", "Minimal", "Accessible"],

    "Steam-WebKit": "webkit.css",
    UseDefaultPatches: true,

    Conditions: {
        "Color scheme": {
            description:
                "Dark is the default because Steam's own unthemed corners are dark. " +
                "System follows the desktop's light/dark setting.",
            tab: "Appearance",
            default: "Dark",
            values: {
                Dark: { TargetCss: { affects: [".*"], src: "scheme-dark.css" } },
                Light: { TargetCss: { affects: [".*"], src: "scheme-light.css" } },
                System: {},
            },
        },
    },
});

/* ---------- write or check ---------- */

const scheme = (name) =>
    [
        "/* Halon for Steam — GENERATED FILE, do not edit. */",
        "",
        "/* The whole palette is light-dark() pairs, so pinning color-scheme picks a side. */",
        ":root {",
        `    --halon-color-scheme: ${name};`,
        "}",
        "",
    ].join("\n");

if (refresh) {
    refreshSelectors();
} else {
    const selectors = loadSelectors();
    const outputs = [
        ["steam/skin.json", JSON.stringify(skin(), null, 4) + "\n"],
        ["steam/scheme-light.css", scheme("light")],
        ["steam/scheme-dark.css", scheme("dark")],
        ["steam/libraryroot.custom.css", compile(["_widgets.css", "_shell.css", "_library.css"], selectors)],
        ["steam/friends.custom.css", compile(["_widgets.css", "_friends.css"], selectors)],
        ["steam/webkit.css", compile(["_webkit.css"], selectors)],
        /* No bigpicture.custom.css: Big Picture is a second design rather than a
           second skin of this one, and UseDefaultPatches simply finds nothing to
           inject. steam/README.md says why. */
    ];

    let stale = false;
    for (const [relative, contents] of outputs) {
        const outPath = join(root, relative);

        if (check) {
            if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
                console.error(`${outPath} is stale — run: node scripts/build-steam.mjs`);
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
}
