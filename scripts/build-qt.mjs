#!/usr/bin/env node
/* Generates the Qt theme from the GTK token files.
 *
 * Qt has no variable layer of its own — neither a colour scheme file nor a Qt
 * style sheet can hold a named colour — so the two-layer rule survives the way
 * it does in the VS Code and Cinnamon builds: the mapping lives here in token
 * names and is substituted at build time. Both schemes come from one mapping.
 *
 * Three artifacts per scheme, because Qt splits the job three ways:
 *
 *   colors/qt5ct, colors/qt6ct   QPalette — what every unstyled widget uses
 *   Halon.qss                    geometry and component treatments (§4, §6)
 *   assets/<scheme>/*.svg        indicator glyphs, off the shared geometry
 *
 * The palette alone gets the colours right and the shapes wrong; §4 is explicit
 * that this reads as the host toolkit wearing the theme's colours, which is why
 * the style sheet is part of the theme rather than an extra.
 *
 * qt5ct and qt6ct take the same file format but disagree on length: Qt 6.6 added
 * QPalette::Accent, so a Qt 6 scheme has 22 roles where a Qt 5 one has 21, and a
 * file of the wrong length is rejected rather than padded. Hence two directories.
 *
 * Usage:
 *   node scripts/build-qt.mjs             # -> qt/
 *   node scripts/build-qt.mjs --check     # fail if the output is stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GLYPH, svg, boxedSvg, chevronSvg } from "./assets.mjs";

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
    return (name) => resolve(name);
};

const rgb = (value) => {
    if (value.startsWith("#")) {
        const h = value.length === 4 ? "#" + [...value.slice(1)].map((c) => c + c).join("") : value;
        return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const nums = value.match(/[\d.]+/g);
    if (!nums) throw new Error(`unparseable color: ${value}`);
    return nums.slice(0, 3).map(Number);
};

/* Qt colour scheme files are #AARRGGBB — alpha first, and always present. */
const argb = (value, alpha = 1) => {
    const byte = (n) => Math.round(n).toString(16).padStart(2, "0");
    return "#" + byte(alpha * 255) + rgb(value).map(byte).join("");
};

/* Style sheets take ordinary CSS colours, so tokens pass through as written. */
const qssRgba = (value, alpha) => `rgba(${rgb(value).join(", ")}, ${alpha})`;

/* ---------- the palette ---------- */

/* QPalette roles in enum order — the file format is positional, so this list is
   the format. Qt 6.6 appends Accent; everything before it is shared. */
const ROLES = [
    "WindowText", "Button", "Light", "Midlight", "Dark", "Mid", "Text", "BrightText",
    "ButtonText", "Base", "Window", "Shadow", "Highlight", "HighlightedText", "Link",
    "LinkVisited", "AlternateBase", "NoRole", "ToolTipBase", "ToolTipText", "PlaceholderText",
];

function palette(scheme) {
    const t = loadTokens(scheme);

    /* Window is the frame (§6.4) and Base is the content surface (§6.2): chrome
       recedes, views and inputs are raised onto it. Every Qt widget that has no
       style-sheet rule still lands on the right side of that line. */
    const active = {
        WindowText: t("text-body"),
        Button: t("surface-secondary"),
    /* Light and Midlight are the bevel ramp's top: Qt reads them as lighter than
       Button, so a border token here inverts the ramp and any app that fills a
       surface with palette(light) gets a grey card instead of the raised one. */
        Light: t("surface-default"),
        Midlight: t("surface-default"),
        Dark: t("text-tertiary"),
        Mid: t("border-hover"),
        Text: t("text-body"),
        BrightText: t("text-on-fill"),
        ButtonText: t("text-body"),
        Base: t("surface-default"),
        Window: t("surface-secondary"),
        Shadow: t("shadow-base"),
        Highlight: t("accent"),
        HighlightedText: t("text-on-fill"),
        Link: t("accent"),
        LinkVisited: t("badge-experimental"),
        AlternateBase: t("surface-secondary"),
        NoRole: t("surface-default"),
        ToolTipBase: t("surface-navigation"),
        ToolTipText: t("text-heading"),
        PlaceholderText: t("text-tertiary"),
    };

    /* Disabled is §6.1's .5 opacity expressed in a palette: text drops to the
       muted ramp, surfaces stay put so nothing shifts when a control greys out. */
    const disabled = {
        ...active,
        WindowText: t("text-tertiary"),
        Text: t("text-tertiary"),
        ButtonText: t("text-tertiary"),
        BrightText: t("text-tertiary"),
        Highlight: t("border-default"),
        HighlightedText: t("text-secondary"),
        PlaceholderText: t("text-tertiary"),
    };

    /* Inactive is the same selection at low alpha, per §6.5 — not another colour.
       Its text goes back to the body ramp: white on a 30% accent would not survive. */
    const inactive = { ...active, HighlightedText: t("text-body") };

    const line = (map, alphas = {}) =>
        ROLES.map((role) => argb(map[role], alphas[role] ?? 1)).join(", ");

    const body = (accent) => [
        "[ColorScheme]",
        `active_colors=${line(active)}${accent ? ", " + argb(t("accent")) : ""}`,
        `disabled_colors=${line(disabled)}${accent ? ", " + argb(t("border-default")) : ""}`,
        `inactive_colors=${line(inactive, { Highlight: 0.3 })}${accent ? ", " + argb(t("accent"), 0.3) : ""}`,
        "",
    ].join("\n");

    return { qt5: body(false), qt6: body(true) };
}

/* ---------- the style sheet ---------- */

/* Indicators are images because a bare fill cannot say "partially checked", and
   they come off the same geometry as the GTK and Cinnamon ones — one checkmark
   curve for the whole theme. Paths are relative; see the README on absolutising
   them, which Qt requires because it resolves url() against the working
   directory rather than against the style sheet. */
function indicators(scheme) {
    const t = loadTokens(scheme);
    const dash = (fill, glyph) => svg(16, 16,
        `<rect width="16" height="16" rx="4" fill="${fill}"/>` +
        `<path d="${GLYPH.dash}" transform="translate(1,1)" fill="none" stroke="${glyph}" ` +
        `stroke-width="${GLYPH.strokeWidth}" stroke-linecap="round"/>`);

    /* A disabled toggle is an image, so the palette's disabled ramp cannot reach
       it — without a second set, a locked checkbox stays at full accent and reads
       as live. The glyph survives at the muted ramp so the state is still told. */
    return {
        "check-on.svg": boxedSvg.check(t("accent"), t("text-on-fill")),
        "check-off.svg": boxedSvg.checkOff(t("surface-default"), t("border-control")),
        "check-mixed.svg": dash(t("accent"), t("text-on-fill")),
        "radio-on.svg": boxedSvg.radio(t("accent"), t("text-on-fill")),
        "radio-off.svg": boxedSvg.radioOff(t("surface-default"), t("border-control")),
        "check-on-disabled.svg": boxedSvg.check(t("border-default"), t("text-tertiary")),
        "check-off-disabled.svg": boxedSvg.checkOff(t("surface-secondary"), t("border-default")),
        "check-mixed-disabled.svg": dash(t("border-default"), t("text-tertiary")),
        "radio-on-disabled.svg": boxedSvg.radio(t("border-default"), t("text-tertiary")),
        "radio-off-disabled.svg": boxedSvg.radioOff(t("surface-secondary"), t("border-default")),
        "chevron-up.svg": chevronSvg.up(t("text-secondary")),
        "chevron-down.svg": chevronSvg.down(t("text-secondary")),
        "chevron-right.svg": chevronSvg.right(t("text-secondary")),
        "branch-open.svg": chevronSvg.down(t("text-tertiary")),
        "branch-closed.svg": chevronSvg.right(t("text-tertiary")),
        "branch-open-selected.svg": chevronSvg.down(t("text-on-fill")),
        "branch-closed-selected.svg": chevronSvg.right(t("text-on-fill")),
    };
}

function stylesheet(scheme) {
    const t = loadTokens(scheme);
    const a = (name, alpha) => qssRgba(t(name), alpha);
    const assets = `assets/${scheme}`;

    return `/* GENERATED FILE — do not edit.
 * Halon for Qt, ${scheme} scheme. Built from gtk/Halon/shared/_tokens-${scheme}.css
 * by scripts/build-qt.mjs; edit the mapping there, then rebuild.
 *
 * Geometry is THEME-DESIGN-GUIDE.md §4: one 32px control height, 28px rows, a
 * 34px frame, and the radius ladder. Load it over the Fusion style — it assumes
 * Fusion's element structure for everything it does not restyle.
 */

/* ---------- base ---------- */

QWidget {
    color: ${t("text-body")};
    font-size: 13px;
    selection-background-color: ${t("accent")};
    selection-color: ${t("text-on-fill")};
}

QWidget:disabled {
    color: ${t("text-tertiary")};
}

QMainWindow,
QDialog,
QDockWidget {
    background-color: ${t("surface-secondary")};
}

/* Content views are the raised surface, §6.2 — everything else recedes. */
QAbstractScrollArea,
QAbstractItemView,
QTextEdit,
QPlainTextEdit,
QTextBrowser {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
}

/* ---------- the frame — §6.4 ---------- */

QMenuBar,
QToolBar,
QStatusBar {
    background-color: ${t("surface-navigation")};
    color: ${t("text-on-navigation")};
    border: none;
}

QMenuBar,
QToolBar {
    min-height: 34px;
    padding: 2px 8px;
    spacing: 4px;
}

QStatusBar {
    min-height: 27px;
    padding: 0px 12px;
}

QStatusBar::item {
    border: none;
}

QMenuBar::item {
    background-color: transparent;
    color: ${t("text-on-navigation")};
    padding: 6px 9px;
    border-radius: 5px;
}

QMenuBar::item:selected,
QMenuBar::item:pressed {
    background-color: ${t("surface-navigation-hover")};
    color: ${t("text-heading")};
}

QToolBar::separator {
    background-color: ${t("border-default")};
    width: 1px;
    margin: 6px 4px;
}

/* ---------- buttons — §6.1, three weights ---------- */

QPushButton {
    background-color: transparent;
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("text-body")};
    font-weight: 500;
    min-height: 16px;
    padding: 7px 14px;
}

QPushButton:hover {
    border-color: ${t("accent")};
}

QPushButton:focus {
    border-color: ${t("accent")};
    outline: none;
}

/* The one primary action on a view. Qt marks it for us; nothing else is filled. */
QPushButton:default {
    background-color: ${t("accent")};
    border-color: ${t("accent")};
    color: ${t("text-on-fill")};
}

QPushButton:default:hover {
    background-color: ${a("accent", 0.85)};
    border-color: ${a("accent", 0.85)};
}

QPushButton:disabled {
    border-color: ${t("border-default")};
    color: ${t("text-tertiary")};
}

QPushButton:default:disabled {
    background-color: ${t("border-default")};
    border-color: ${t("border-default")};
}

/* Tool buttons are the flat weight: no border until hover, never a fill swap,
   because a fill swap can paint out an independently-coloured icon (§6.1). */
QToolButton {
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: ${t("text-secondary")};
    min-width: 22px;
    min-height: 22px;
    padding: 4px;
}

QToolButton:hover {
    border-color: ${t("border-default")};
    color: ${t("text-heading")};
}

QToolButton:pressed,
QToolButton:checked {
    background-color: ${t("surface-navigation-hover")};
    color: ${t("text-heading")};
}

/* In the frame, a tool button takes the frame's own label colour. */
QToolBar > QToolButton {
    color: ${t("text-on-navigation")};
}

QToolBar > QToolButton:hover {
    border-color: ${t("surface-navigation-hover")};
    color: ${t("text-heading")};
}

/* A split tool button's menu half is a sub-control, and the style-sheet engine
   paints it as a black block wherever the sheet styles QToolButton but leaves
   the sub-control unnamed. The padding is what reserves room for it. */
QToolButton[popupMode="1"] {
    padding-right: 18px;
}

QToolButton::menu-button {
    background-color: transparent;
    border: none;
    width: 14px;
}

QToolButton::menu-arrow,
QToolButton::menu-indicator {
    height: 8px;
    image: url(${assets}/chevron-down.svg);
    subcontrol-origin: padding;
    subcontrol-position: center right;
    width: 8px;
}

/* ---------- inputs — §6.2 ---------- */

QLineEdit,
QSpinBox,
QDoubleSpinBox,
QDateEdit,
QTimeEdit,
QDateTimeEdit {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("text-body")};
    min-height: 16px;
    padding: 7px 11px;
    selection-background-color: ${t("accent")};
    selection-color: ${t("text-on-fill")};
}

/* The fill never moves — only the boundary does. Dropping the field to the
   secondary surface on hover would put the placeholder at 4.34:1. */
QLineEdit:hover,
QSpinBox:hover,
QDoubleSpinBox:hover,
QDateTimeEdit:hover,
QLineEdit:focus,
QSpinBox:focus,
QDoubleSpinBox:focus,
QDateTimeEdit:focus,
QTextEdit:focus,
QPlainTextEdit:focus {
    border-color: ${t("accent")};
}

QLineEdit:disabled,
QSpinBox:disabled,
QDoubleSpinBox:disabled,
QDateTimeEdit:disabled {
    background-color: ${t("surface-secondary")};
    color: ${t("text-tertiary")};
}

/* §6.3's hazard reaches the stepper too, not just the combo box: restyling the
   field's background drops the base style's button behind each arrow, and what
   is left is the bare arrow, positioned against a box it no longer fits — it
   lands outside the rounded border. A stepper cannot be left unstyled the way
   an arrow can, so its geometry is stated here and the glyph comes off the
   shared chevron. The right padding is the room the two buttons need. */
QSpinBox,
QDoubleSpinBox,
QDateEdit,
QTimeEdit,
QDateTimeEdit {
    padding-right: 26px;
}

QSpinBox::up-button,
QSpinBox::down-button,
QDoubleSpinBox::up-button,
QDoubleSpinBox::down-button,
QDateEdit::up-button,
QDateEdit::down-button,
QTimeEdit::up-button,
QTimeEdit::down-button,
QDateTimeEdit::up-button,
QDateTimeEdit::down-button {
    background-color: transparent;
    border: none;
    subcontrol-origin: border;
    width: 20px;
}

QSpinBox::up-button,
QDoubleSpinBox::up-button,
QDateEdit::up-button,
QTimeEdit::up-button,
QDateTimeEdit::up-button {
    subcontrol-position: top right;
    margin: 3px 5px 0px 0px;
}

QSpinBox::down-button,
QDoubleSpinBox::down-button,
QDateEdit::down-button,
QTimeEdit::down-button,
QDateTimeEdit::down-button {
    subcontrol-position: bottom right;
    margin: 0px 5px 3px 0px;
}

QSpinBox::up-arrow,
QDoubleSpinBox::up-arrow,
QDateEdit::up-arrow,
QTimeEdit::up-arrow,
QDateTimeEdit::up-arrow {
    image: url(${assets}/chevron-up.svg);
    width: 10px;
    height: 10px;
}

QSpinBox::down-arrow,
QDoubleSpinBox::down-arrow,
QDateEdit::down-arrow,
QTimeEdit::down-arrow,
QDateTimeEdit::down-arrow {
    image: url(${assets}/chevron-down.svg);
    width: 10px;
    height: 10px;
}

/* A closed combo box is an action affordance, not a text field — §6.3. The
   arrow is left to the base style: overriding it here is how ports lose it. */
QComboBox {
    background-color: transparent;
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("accent")};
    font-weight: 500;
    min-height: 16px;
    padding: 7px 11px;
}

QComboBox:hover,
QComboBox:focus,
QComboBox:on {
    border-color: ${t("accent")};
}

QComboBox:disabled {
    color: ${t("text-tertiary")};
}

/* The open list is a normal readable surface, whatever the closed control does. */
QComboBox QAbstractItemView {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("text-body")};
    padding: 5px;
    selection-background-color: ${t("accent")};
    selection-color: ${t("text-on-fill")};
}

/* ---------- toggles — §6.2: the boundary is the control, so it clears 3:1 ---------- */

QCheckBox,
QRadioButton {
    color: ${t("text-body")};
    spacing: 8px;
}

QCheckBox::indicator,
QRadioButton::indicator {
    width: 16px;
    height: 16px;
}

QCheckBox::indicator:unchecked        { image: url(${assets}/check-off.svg); }
QCheckBox::indicator:checked          { image: url(${assets}/check-on.svg); }
QCheckBox::indicator:indeterminate    { image: url(${assets}/check-mixed.svg); }
QRadioButton::indicator:unchecked     { image: url(${assets}/radio-off.svg); }
QRadioButton::indicator:checked       { image: url(${assets}/radio-on.svg); }

QCheckBox::indicator:unchecked:disabled     { image: url(${assets}/check-off-disabled.svg); }
QCheckBox::indicator:checked:disabled       { image: url(${assets}/check-on-disabled.svg); }
QCheckBox::indicator:indeterminate:disabled { image: url(${assets}/check-mixed-disabled.svg); }
QRadioButton::indicator:unchecked:disabled  { image: url(${assets}/radio-off-disabled.svg); }
QRadioButton::indicator:checked:disabled    { image: url(${assets}/radio-on-disabled.svg); }

QCheckBox:disabled,
QRadioButton:disabled {
    color: ${t("text-tertiary")};
}

/* ---------- lists, trees, tables — §6.5 ---------- */

QAbstractItemView {
    alternate-background-color: ${t("surface-secondary")};
    outline: none;
    selection-background-color: ${t("accent")};
    selection-color: ${t("text-on-fill")};
}

QAbstractItemView::item {
    min-height: 22px;
    padding: 3px 8px;
}

QAbstractItemView::item:hover {
    background-color: ${t("border-default")};
    color: ${t("text-heading")};
}

/* A selected row is a solid accent fill; its icon must not stay accent-coloured. */
QAbstractItemView::item:selected {
    background-color: ${t("accent")};
    color: ${t("text-on-fill")};
}

/* Inactive selection is left to the palette, which already carries it at 30%
   (§6.5) in its inactive colour group. A :!active rule here would fight it
   rather than help: the style sheet's :active follows widget focus while the
   indent column beside it follows window activation, so the two disagree the
   moment a view is merely unfocused — and the row splits into a pale band with
   a full-strength block welded to its left. One authority, no seam. */

/* Qt paints ::item per cell, not per row, so a radius here cuts a multi-column
   row into one chip per column with a gap at every boundary. Only a view that
   is single-column by construction can carry the row radius; a tree or a table
   takes a square fill and reads as one continuous band. The padding is what
   keeps the rounded ends off the frame, which would otherwise clip them flat. */
QListView {
    padding: 4px;
}

QListView::item {
    border-radius: 6px;
}

QTreeView::item,
QTableView::item {
    border-radius: 0px;
}

/* The indent column is outside ::item, so the style paints it from the palette:
   left alone it fills at full-strength Highlight while the row beside it is the
   30% inactive fill, which reads as a stray block welded to the row. It is held
   transparent in every state instead, so the selection band is exactly the row.
   ::branch honours :selected but not :!active, so matching the fill is not an
   option — only clearing it is.

   Styling ::branch at all is §6.3's hazard in its exact form: the moment there
   is a rule here, the base style stops drawing the expander and the tree loses
   the one control that opens it. That is why the arrows are restated below
   rather than left to Fusion — off the same chevron as the stepper. */
QTreeView::branch:has-children:!has-siblings:closed,
QTreeView::branch:closed:has-children:has-siblings {
    image: url(${assets}/branch-closed.svg);
}

QTreeView::branch:open:has-children:!has-siblings,
QTreeView::branch:open:has-children:has-siblings {
    image: url(${assets}/branch-open.svg);
}

/* On a selected row the indent takes the accent fill, so the arrow has to
   invert with it — the muted glyph is 1.7:1 on that blue and disappears. */
QTreeView::branch:has-children:!has-siblings:closed:selected,
QTreeView::branch:closed:has-children:has-siblings:selected {
    image: url(${assets}/branch-closed-selected.svg);
}

QTreeView::branch:open:has-children:!has-siblings:selected,
QTreeView::branch:open:has-children:has-siblings:selected {
    image: url(${assets}/branch-open-selected.svg);
}

/* Last, and stated at every specificity the arrow rules above reach: Qt resolves
   ::branch by the most specific match, so a plain :selected rule placed first is
   discarded for exactly the rows that have an arrow — which is all of them.
   Transparent is not enough — the base style has already painted the highlight
   underneath by then, so the selected states name the fill they want. */
QTreeView::branch,
QTreeView::branch:hover {
    background-color: transparent;
}

QTreeView::branch:selected,
QTreeView::branch:has-children:selected,
QTreeView::branch:has-siblings:selected,
QTreeView::branch:open:has-children:selected,
QTreeView::branch:open:has-children:has-siblings:selected,
QTreeView::branch:open:has-children:!has-siblings:selected,
QTreeView::branch:closed:has-children:selected,
QTreeView::branch:closed:has-children:has-siblings:selected,
QTreeView::branch:has-children:!has-siblings:closed:selected {
    background-color: ${t("accent")};
}

QHeaderView {
    background-color: transparent;
    border: none;
}

QHeaderView::section {
    background-color: ${t("surface-secondary")};
    border: none;
    border-bottom: 1px solid ${t("border-default")};
    border-right: 1px solid ${t("border-default")};
    color: ${t("text-secondary")};
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
}

/* The header meets the view's 8px frame, so its outer sections carry the same
   corner — a square section against a rounded frame leaves a visible notch. A
   tree's first section is its own top-left corner; a table's is the corner
   button below, because the row header owns that column. */
QTreeView QHeaderView::section:first {
    border-top-left-radius: 8px;
}

QHeaderView::section:horizontal:last {
    border-top-right-radius: 8px;
}

/* The square between the two headers, and the one between the two scroll bars. */
QTableCornerButton::section {
    background-color: ${t("surface-secondary")};
    border: none;
    border-bottom: 1px solid ${t("border-default")};
    border-right: 1px solid ${t("border-default")};
    border-top-left-radius: 8px;
}

QAbstractScrollArea::corner {
    background-color: transparent;
    border: none;
}

QTableView {
    gridline-color: ${t("border-default")};
}

/* ---------- menus — §6.6 ---------- */

QMenu {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("text-body")};
    padding: 5px;
}

QMenu::item {
    border-radius: 5px;
    min-height: 20px;
    padding: 6px 24px 6px 9px;
}

QMenu::item:selected {
    background-color: ${t("accent")};
    color: ${t("text-on-fill")};
}

QMenu::item:disabled {
    color: ${t("text-tertiary")};
}

QMenu::separator {
    background-color: ${t("border-default")};
    height: 1px;
    margin: 5px 9px;
}

QMenu::icon {
    padding-left: 9px;
}

QToolTip {
    background-color: ${t("surface-navigation")};
    border: 1px solid ${t("border-default")};
    border-radius: 6px;
    color: ${t("text-heading")};
    padding: 5px 9px;
}

/* ---------- tabs — §6.4: a raised card, marked by lift, text and the accent ---------- */

QTabWidget::pane {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    top: -1px;
}

QTabBar {
    background-color: transparent;
    qproperty-drawBase: 0;
}

/* Only the top corners round. The selected tab is marked by an accent
   border-bottom, and a radius on that edge bends the underline up into a U. */
QTabBar::tab {
    background-color: transparent;
    border: 1px solid transparent;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    color: ${t("text-on-navigation")};
    margin: 3px 1px;
    min-height: 20px;
    padding: 4px 10px;
}

QTabBar::tab:hover {
    background-color: ${t("surface-navigation-hover")};
    color: ${t("text-heading")};
}

QTabBar::tab:selected {
    background-color: ${t("surface-default")};
    border-bottom: 2px solid ${t("accent")};
    color: ${t("text-heading")};
}

QTabBar::close-button:hover {
    background-color: ${t("status-danger")};
    border-radius: 4px;
}

/* ---------- scrollbars — §6.8 ---------- */

QScrollBar:vertical,
QScrollBar:horizontal {
    background-color: transparent;
    border: none;
    margin: 0px;
}

QScrollBar:vertical   { width: 10px; }
QScrollBar:horizontal { height: 10px; }

QScrollBar::handle:vertical,
QScrollBar::handle:horizontal {
    background-color: ${t("border-hover")};
    border: 1px solid transparent;
    border-radius: 4px;
}

QScrollBar::handle:vertical   { min-height: 28px; }
QScrollBar::handle:horizontal { min-width: 28px; }

QScrollBar::handle:hover {
    background-color: ${t("text-tertiary")};
}

QScrollBar::add-line,
QScrollBar::sub-line,
QScrollBar::add-page,
QScrollBar::sub-page {
    background: none;
    border: none;
    height: 0px;
    width: 0px;
}

/* ---------- progress, sliders, splitters ---------- */

/* The track is a line on a surface, not a fill on the frame: at
   surface-secondary it is the same colour as the window it usually sits on and
   the unfilled part of the bar disappears. §4.3 sets the 6px height, and §3.6
   puts the value in a label beside the bar rather than inside it — 6px cannot
   hold text, and Qt draws it clipped across the middle if it is left visible. */
QProgressBar {
    background-color: ${t("border-default")};
    border: none;
    border-radius: 3px;
    color: transparent;
    max-height: 6px;
}

QProgressBar::chunk {
    background-color: ${t("accent")};
    border-radius: 3px;
}

QSlider::groove:horizontal {
    background-color: ${t("border-default")};
    border-radius: 3px;
    height: 6px;
}

QSlider::sub-page:horizontal {
    background-color: ${t("accent")};
    border-radius: 3px;
}

/* Sub-controls are drawn by the style sheet, so the palette's disabled ramp
   never reaches them and a locked slider is otherwise identical to a live one. */
QSlider::sub-page:horizontal:disabled {
    background-color: ${t("border-hover")};
}

QSlider::handle:horizontal:disabled {
    background-color: ${t("surface-secondary")};
    border-color: ${t("border-hover")};
}

QProgressBar::chunk:disabled {
    background-color: ${t("border-hover")};
}

QSlider::handle:horizontal {
    background-color: ${t("surface-default")};
    border: 1px solid ${t("border-control")};
    border-radius: 8px;
    height: 16px;
    margin: -6px 0px;
    width: 16px;
}

QSlider::handle:horizontal:hover {
    border-color: ${t("accent")};
}

/* Gutters are invisible until grabbed, §6.8. */
QSplitter::handle {
    background-color: transparent;
}

QSplitter::handle:hover,
QSplitter::handle:pressed {
    background-color: ${t("accent")};
}

/* ---------- containers ---------- */

QGroupBox {
    background-color: transparent;
    border: 1px solid ${t("border-default")};
    border-radius: 8px;
    color: ${t("text-heading")};
    font-weight: 600;
    margin-top: 12px;
    padding: 16px;
}

QGroupBox::title {
    color: ${t("text-secondary")};
    font-size: 12px;
    left: 12px;
    padding: 0px 4px;
    subcontrol-origin: margin;
    subcontrol-position: top left;
}

QDockWidget {
    color: ${t("text-secondary")};
    titlebar-close-icon: none;
    titlebar-normal-icon: none;
}

QDockWidget::title {
    background-color: ${t("surface-secondary")};
    border-bottom: 1px solid ${t("border-default")};
    padding: 7px 12px;
    text-align: left;
}

QFrame[frameShape="4"] {
    background-color: ${t("border-default")};
    border: none;
    max-height: 1px;
}

QFrame[frameShape="5"] {
    background-color: ${t("border-default")};
    border: none;
    max-width: 1px;
}
`;
}

/* ---------- write or check ---------- */

const outputs = [];
for (const scheme of ["light", "dark"]) {
    const name = scheme === "dark" ? "Halon-Dark" : "Halon";
    const { qt5, qt6 } = palette(scheme);
    outputs.push([`qt/colors/qt5ct/${name}.conf`, qt5]);
    outputs.push([`qt/colors/qt6ct/${name}.conf`, qt6]);
    outputs.push([`qt/${name}.qss`, stylesheet(scheme)]);
    for (const [file, contents] of Object.entries(indicators(scheme))) {
        outputs.push([`qt/assets/${scheme}/${file}`, contents]);
    }
}

let stale = false;
for (const [relative, contents] of outputs) {
    const outPath = join(root, relative);

    if (check) {
        if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
            console.error(`${outPath} is stale — run: node scripts/build-qt.mjs`);
            stale = true;
        }
        continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, contents);
}

if (check) {
    if (!stale) console.log(`qt: ${outputs.length} files are up to date.`);
    else process.exit(1);
} else {
    console.log(`Wrote ${outputs.length} files under qt/`);
}
