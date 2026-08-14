#!/usr/bin/env node
/* Generates gtk/Halon/shared/_reset.css.
 *
 * Halon imports Adwaita as a base so that widgets it does not style still render.
 * The cost is that Adwaita's raised look is applied through contextual selectors
 * — `headerbar button`, `.linked > button`, `dialog button` — which outrank a
 * plain `button` rule, so half the buttons in an application keep the gradient
 * and the inset highlight unless every context is matched again.
 *
 * That is a context x state matrix, and writing it by hand means 140 selectors
 * pasted into a stylesheet where a reviewer cannot tell which are load-bearing.
 * Declaring the two axes and expanding them is the same output, one edit.
 *
 * Usage:
 *   node scripts/build-gtk.mjs           # write the file
 *   node scripts/build-gtk.mjs --check   # fail if it is stale
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "gtk/Halon/shared/_reset.css");
const check = process.argv.includes("--check");

/* Every place Adwaita styles a button with more specificity than `button`. */
const BUTTON_CONTEXTS = [
    "", "headerbar ", ".titlebar ", "toolbar ", ".primary-toolbar ", "dialog ",
    "messagedialog ", "popover ", "infobar ", "actionbar ", "searchbar ",
    "stackswitcher ", ".linked > ", "list row ", "notebook ", ".path-bar ",
    "combobox ", "spinbutton ", ".osd ", "placessidebar ",
];

/* Compound states matter: Adwaita has separate grey paints for e.g.
   checked-while-focused and checked-in-backdrop, so single states leave
   grey showing on whichever focus state the flat list missed. */
const BUTTON_STATES = ["", ":hover", ":active", ":checked", ":disabled", ":backdrop", ":focus",
    ":checked:backdrop", ":active:backdrop", ":hover:backdrop", ":disabled:backdrop",
    ":checked:hover", ":checked:focus", ":focus:hover"];

const ENTRY_CONTEXTS = ["entry", "spinbutton", "headerbar entry", "searchbar entry",
                        "popover entry", ".linked > entry"];
const ENTRY_STATES = ["", ":focus", ":disabled", ":backdrop"];

/* The raised look, in four properties. */
const FLATTEN = [
    "background-image: none;",
    "box-shadow: none;",
    "text-shadow: none;",
    "-gtk-icon-shadow: none;",
];

const expand = (contexts, node, states) =>
    contexts.flatMap((c) => states.map((s) => `${c}${node}${s}`.trim()));

const rule = (selectors, decls) =>
    `${selectors.join(",\n")} {\n${decls.map((d) => "    " + d).join("\n")}\n}\n`;

const buttons = expand(BUTTON_CONTEXTS, "button", BUTTON_STATES);
const entries = ENTRY_CONTEXTS.flatMap((c) => ENTRY_STATES.map((s) => `${c}${s}`));

const out = `/* GENERATED FILE — do not edit.
 *
 * Built by scripts/build-gtk.mjs from a context x state matrix.
 * ${buttons.length} button selectors, ${entries.length} entry selectors.
 *
 * Purpose: neutralise the Adwaita base's raised styling at the same specificity
 * it was applied with, so Halon's own rules are what the user sees. Imported
 * after the base and the tokens, before the component layer.
 */

${rule(buttons, FLATTEN)}
${rule(entries, FLATTEN.slice(0, 3))}`;

if (check) {
    if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== out) {
        console.error(`${outPath} is stale — run: node scripts/build-gtk.mjs`);
        process.exit(1);
    }
    console.log("gtk: _reset.css is up to date.");
    process.exit(0);
}

writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
console.log(`  ${buttons.length} button + ${entries.length} entry selectors from ` +
            `${BUTTON_CONTEXTS.length}+${ENTRY_CONTEXTS.length} contexts`);
