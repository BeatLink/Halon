#!/usr/bin/env node
/* Generates the LMMS theme from the GTK token files.
 *
 * An LMMS theme is a directory holding a style.css and any artwork that
 * overrides the stock set; LMMS puts the chosen directory first on its
 * `resources:` search path and falls back to its own default theme for
 * every file the directory does not carry, so a theme that only recolours
 * needs nothing but the style sheet. That sheet is a Qt style sheet with
 * one addition: LMMS exposes its canvas colours — piano roll grid, clip
 * fills, meter thresholds — as `qproperty-*` declarations, so the parts a
 * plain Qt theme cannot reach are named here too.
 *
 * Dark only, and deliberately. LMMS's stock artwork — knobs, LEDs, LCD
 * digits, faders, key caps — is drawn for a dark host, and a light scheme
 * would need all ~290 images redrawn rather than recoloured. See lmms/README.md.
 *
 * Usage:
 *   node scripts/build-lmms.mjs             # -> lmms/Halon/style.css
 *   node scripts/build-lmms.mjs --check     # fail if the output is stale
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

const t = loadTokens("dark");

/* Qt's parser takes rgba alpha as 0-255, so every translucent value is emitted that way. */
const fade = (name, alpha) => `rgba(${rgb(t(name)).join(", ")}, ${Math.round(alpha * 255)})`;

/* Mixes a token towards another by ratio, for the two shades §3 has no token between. */
const mix = (name, towards, ratio) => {
    const [a, b] = [rgb(t(name)), rgb(t(towards))];
    const byte = (n) => Math.round(n).toString(16).padStart(2, "0");
    return "#" + a.map((v, i) => byte(v + (b[i] - v) * ratio)).join("");
};

/* ---------- the sheet ---------- */

/* LMMS paints its own chrome, so §6.4's frame is the toolbars, the sidebar and the
   track control panels, and §6.2's raised content surface is every editor canvas. */
const frame = t("surface-navigation");
const frameHover = t("surface-navigation-hover");
const canvas = t("surface-default");
const desk = t("surface-root");

/* The four clip kinds are categories rather than states, so they take the theme's
   four non-accent hues and leave @accent free to mean selection (§6.5). */
const clip = {
    midi: t("syntax-string"),
    sample: t("syntax-number"),
    automation: t("badge-experimental"),
    pattern: t("syntax-type"),
};

const sheet = `/* Halon for LMMS — GENERATED FILE. Built from gtk/Halon/shared/_tokens-dark.css by scripts/build-lmms.mjs. */

/* ---------------------------------------------------------------------- palette ---------------------------------------------------------------------- */

/* LMMS builds its QPalette from this widget, so it is what every control with no rule below lands on. */
lmms--gui--LmmsPalette {
	qproperty-background: ${frame};
	qproperty-windowText: ${t("text-body")};
	qproperty-base: ${canvas};
	qproperty-text: ${t("text-body")};
	qproperty-button: ${frameHover};
	qproperty-buttonText: ${t("text-body")};
	qproperty-brightText: ${t("text-heading")};
	qproperty-shadow: ${t("shadow-base")};
	qproperty-highlight: ${t("accent")};
	qproperty-highlightedText: ${t("text-on-fill")};
}

QLabel, QTreeWidget, QListWidget, QGroupBox, QMenuBar, QCheckBox {
	color: ${t("text-body")};
}

/* The desk behind the editor windows is the outermost chrome, one step back from every canvas on it. */
QMdiArea {
	background-color: ${desk};
}

/* ---------------------------------------------------------------------- text and lists ---------------------------------------------------------------------- */

QTreeView {
	outline: none;
	alternate-background-color: ${frame};
}

QTreeWidget::item {
	padding: 5px 8px;
	border-radius: 6px;
}

QTreeWidget::item:hover,
QTreeWidget::branch:hover {
	background-color: ${frameHover};
	color: ${t("text-heading")};
	padding-left: 0px;
}

QTreeWidget::item:selected,
QTreeWidget::branch:selected {
	background-color: ${t("accent")};
	color: ${t("text-on-fill")};
	padding-left: 0px;
}

QTreeView::branch:has-children:open {
	border-image: url("resources:open_branch.png") 0;
}

QTreeView::branch:has-children:closed {
	border-image: url("resources:closed_branch.png") 0;
}

lmms--gui--FileBrowser QCheckBox {
	font-size: 8pt;
	color: ${t("text-body")};
}

/* ---------------------------------------------------------------------- inputs ---------------------------------------------------------------------- */

/* §6.2 — a hairline and the content surface at rest, the border asserting itself on focus. */
QLineEdit {
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	padding: 4px 11px;
	background: ${canvas};
	color: ${t("text-body")};
	selection-background-color: ${t("accent")};
	selection-color: ${t("text-on-fill")};
}

QLineEdit:hover {
	border: 1px solid ${t("border-focus")};
}

QLineEdit:focus {
	border: 1px solid ${t("border-focus")};
}

QLineEdit:read-only {
	border: 1px solid transparent;
	background: transparent;
}

QTextEdit, QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {
	color: ${t("text-body")};
	selection-background-color: ${t("accent")};
	selection-color: ${t("text-on-fill")};
}

/* ---------------------------------------------------------------------- overlays ---------------------------------------------------------------------- */

/* §6.6 — transient overlays belong to the frame rather than the page. */
QToolTip {
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	padding: 4px 8px;
	background: ${frame};
	color: ${t("text-heading")};
}

lmms--gui--TextFloat, lmms--gui--SimpleTextFloat {
	background: ${frame};
	color: ${t("text-heading")};
}

QSplashScreen QLabel {
	color: ${t("text-heading")};
}

QMenu {
	border: 1px solid ${t("border-default")};
	background-color: ${canvas};
	padding: 5px;
}

QMenu::separator {
	height: 1px;
	background: ${t("border-default")};
	margin: 4px 0px;
}

QMenu::item {
	color: ${t("text-body")};
	padding: 6px 32px 6px 22px;
	margin: 1px 0px;
	border-radius: 5px;
}

QMenu::item:selected {
	color: ${t("text-on-fill")};
	background-color: ${t("accent")};
}

QMenu::item:disabled {
	color: ${t("text-tertiary")};
	background-color: transparent;
}

QMenu::icon {
	margin: 3px;
}

QMenu::indicator {
	width: 16;
	height: 16;
	opacity: 0;
	border: 1px solid ${t("border-control")};
	border-radius: 4px;
	background-color: ${canvas};
}

QMenu::indicator:checked {
	image: url("resources:apply.png");
}

QMenu::indicator:selected {
	image: url("resources:apply-selected.png");
	border: 1px solid ${t("border-focus")};
	background-color: ${canvas};
}

/* ---------------------------------------------------------------------- generic controls ---------------------------------------------------------------------- */

/* LMMS styles its own widgets and leaves the rest to Qt, so dialogs need §4 and §6 spelled out here. */
QDialog, QMessageBox {
	background: ${canvas};
}

QMenuBar {
	background: ${frame};
	padding: 2px 4px;
}

QMenuBar::item {
	background: transparent;
	color: ${t("text-on-navigation")};
	padding: 5px 9px;
	border-radius: 6px;
}

QMenuBar::item:selected {
	background: ${frameHover};
	color: ${t("text-heading")};
}

QPushButton {
	color: ${t("text-body")};
	background: transparent;
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	padding: 5px 14px;
	font-weight: 500;
}

QPushButton:hover {
	border: 1px solid ${t("accent")};
	color: ${t("text-heading")};
}

QPushButton:pressed, QPushButton:default {
	color: ${t("text-on-fill")};
	background: ${t("accent")};
	border: 1px solid ${t("accent")};
}

QPushButton:disabled {
	color: ${t("text-tertiary")};
	background: transparent;
	border: 1px solid ${t("border-default")};
}

/* §6.3 — a closed select is an action affordance, so it is ghosted and its text takes the accent. */
QComboBox {
	background-color: transparent;
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	padding: 4px 8px;
	color: ${t("accent")};
	font-weight: 500;
}

QComboBox:hover {
	border: 1px solid ${t("accent")};
}

QComboBox::drop-down {
	border: none;
	width: 20px;
}

QComboBox QAbstractItemView {
	background: ${canvas};
	border: 1px solid ${t("border-default")};
	color: ${t("text-body")};
	selection-background-color: ${t("accent")};
	selection-color: ${t("text-on-fill")};
	outline: none;
}

QSpinBox, QDoubleSpinBox {
	background: ${canvas};
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	padding: 4px 6px;
	color: ${t("text-body")};
}

QSpinBox:hover, QDoubleSpinBox:hover,
QSpinBox:focus, QDoubleSpinBox:focus {
	border: 1px solid ${t("border-focus")};
}

/* §6.2 — toggles are the exception that keeps a 3:1 boundary, because the border is the control. */
QCheckBox::indicator, QRadioButton::indicator, QGroupBox::indicator {
	width: 14px;
	height: 14px;
	border: 1px solid ${t("border-control")};
	background: ${canvas};
}

QCheckBox::indicator, QGroupBox::indicator {
	border-radius: 4px;
}

QRadioButton::indicator {
	border-radius: 8px;
}

QCheckBox::indicator:hover, QRadioButton::indicator:hover, QGroupBox::indicator:hover {
	border: 1px solid ${t("accent")};
}

QCheckBox::indicator:checked, QRadioButton::indicator:checked, QGroupBox::indicator:checked {
	background: ${t("accent")};
	border: 1px solid ${t("accent")};
}

QCheckBox:disabled, QRadioButton:disabled {
	color: ${t("text-tertiary")};
}

QTabWidget::pane {
	background: ${canvas};
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
}

QTabBar::tab {
	background: transparent;
	color: ${t("text-on-navigation")};
	border: 1px solid transparent;
	border-radius: 8px;
	padding: 5px 10px;
	margin: 1px;
}

QTabBar::tab:hover {
	background: ${frameHover};
	color: ${t("text-heading")};
}

/* §6.4 — a selected tab is a raised card: fill, heading text and an accent edge together. */
QTabBar::tab:selected {
	background: ${canvas};
	border: 1px solid ${t("border-default")};
	border-bottom: 2px solid ${t("accent")};
	color: ${t("text-heading")};
}

QHeaderView::section {
	background: ${frame};
	color: ${t("text-secondary")};
	border: none;
	border-bottom: 1px solid ${t("border-default")};
	padding: 5px 12px;
}

QProgressBar {
	background: ${frame};
	border: none;
	border-radius: 3px;
	height: 6px;
	text-align: center;
	color: ${t("text-body")};
}

QProgressBar::chunk {
	background: ${t("accent")};
	border-radius: 3px;
}

QSplitter::handle {
	background: transparent;
}

/* LmmsPalette overrides ten QPalette roles and leaves the rest on Qt's light standard palette, so
   AlternateBase and the Light/Midlight/Mid/Dark bevel ramp arrive white. Only the first is settable
   from a style sheet; the rest are headed off by giving every framed widget an explicit border. */
/* A scroll area resets itself to the application palette and keeps NoFrame, so no rule above
   reaches its viewport and it paints from whichever Base the host palette happens to carry. */
QAbstractScrollArea {
	background-color: ${canvas};
}

QAbstractScrollArea > QWidget > QWidget {
	background-color: ${canvas};
}

QAbstractItemView {
	alternate-background-color: ${frame};
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	outline: none;
}

QFrame[frameShape="1"], QFrame[frameShape="2"],
QFrame[frameShape="3"], QFrame[frameShape="6"] {
	border: 1px solid ${t("border-default")};
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

QStatusBar {
	background: ${frame};
	color: ${t("text-secondary")};
}

QStatusBar::item {
	border: none;
}

QSplitter::handle:hover {
	background: ${t("accent")};
}

/* ---------------------------------------------------------------------- editor canvases ---------------------------------------------------------------------- */

lmms--gui--AutomationEditor {
	color: ${t("text-body")};
	background-color: ${canvas};
	qproperty-backgroundShade: ${fade("text-heading", 0.04)};
	qproperty-outOfBoundsShade: ${fade("shadow-base", 0.6)};
	qproperty-nodeInValueColor: ${fade("accent", 0.6)};
	qproperty-nodeOutValueColor: ${fade("status-danger", 0.6)};
	qproperty-nodeTangentLineColor: ${t("text-secondary")};
	qproperty-crossColor: ${fade("accent", 0.6)};
	qproperty-lineColor: ${t("border-default")};
	qproperty-beatLineColor: ${t("border-hover")};
	qproperty-barLineColor: ${t("border-control")};
	qproperty-graphColor: ${fade("badge-experimental", 0.7)};
	qproperty-scaleColor: ${frame};
	qproperty-ghostNoteColor: ${fade("text-tertiary", 0.5)};
	qproperty-detuningNoteColor: ${fade("status-danger", 0.5)};
	qproperty-ghostSampleColor: ${fade("text-tertiary", 0.5)};
}

lmms--gui--PositionLine {
	qproperty-tailGradient: true;
	qproperty-lineColor: ${t("text-heading")};
	qproperty-recordingColor: ${t("status-danger")};
}

lmms--gui--PianoRoll {
	background-color: ${canvas};
	qproperty-backgroundShade: ${fade("text-heading", 0.03)};
	qproperty-outOfBoundsShade: ${fade("shadow-base", 0.6)};
	qproperty-noteModeColor: ${t("accent")};
	qproperty-noteColor: ${t("accent")};
	qproperty-stepNoteColor: ${t("status-danger")};
	qproperty-currentStepNoteColor: ${t("status-warning")};
	qproperty-noteTextColor: ${t("text-on-fill")};
	qproperty-noteOpacity: 230;
	qproperty-noteBorders: false;
	qproperty-selectedNoteColor: ${t("text-heading")};
	qproperty-ghostNoteColor: ${t("border-hover")};
	qproperty-ghostNoteTextColor: ${t("text-heading")};
	qproperty-ghostNoteOpacity: 90;
	qproperty-ghostNoteBorders: false;
	qproperty-barColor: ${t("accent")};
	qproperty-markedSemitoneColor: ${fade("accent", 0.14)};
	qproperty-knifeCutLine: ${t("status-danger")};

	/* Piano keys */
	qproperty-whiteKeyWidth: 64;
	qproperty-whiteKeyActiveTextColor: ${t("text-on-fill")};
	qproperty-whiteKeyActiveTextShadow: ${fade("text-heading", 0.4)};
	qproperty-whiteKeyActiveBackground: ${t("accent")};
	qproperty-whiteKeyInactiveTextColor: ${t("text-on-light")};
	qproperty-whiteKeyInactiveTextShadow: ${fade("text-heading", 0.4)};
	qproperty-whiteKeyInactiveBackground: ${t("text-body")};
	qproperty-whiteKeyDisabledBackground: ${t("text-tertiary")};
	qproperty-blackKeyWidth: 48;
	qproperty-blackKeyActiveBackground: ${t("accent")};
	qproperty-blackKeyInactiveBackground: ${mix("surface-root", "border-default", 0.35)};
	qproperty-blackKeyDisabledBackground: ${t("border-default")};

	/* Grid colors */
	qproperty-lineColor: ${t("border-default")};
	qproperty-beatLineColor: ${t("border-hover")};
	qproperty-barLineColor: ${t("border-control")};

	/* Text on the white piano keys */
	qproperty-textColor: ${t("text-on-light")};
	qproperty-textColorLight: ${t("accent")};
	qproperty-textShadow: ${fade("text-heading", 0.4)};
}

lmms--gui--PianoView {
	background-color: ${canvas};
}

/* Song and pattern editor canvases are content, so they are raised off the frame around them. */
lmms--gui--TrackContainerView QFrame {
	background-color: ${canvas};
}

lmms--gui--TrackContainerView QLabel {
	background: none;
}

lmms--gui--TrackContentWidget {
	/* colors */
	qproperty-darkerColor: ${frameHover};
	qproperty-lighterColor: ${canvas};
	qproperty-coarseGridColor: ${t("border-control")};
	qproperty-fineGridColor: ${t("border-default")};
	qproperty-horizontalColor: ${t("border-default")};
	qproperty-embossColor: rgba(0, 0, 0, 0);

	/* line widths */
	qproperty-coarseGridWidth: 1;
	qproperty-fineGridWidth: 1;
	qproperty-horizontalWidth: 1;
	qproperty-embossWidth: 0;

	/* positive offset shifts emboss to the right */
	qproperty-embossOffset: 0;
}

/* Track controls frame the grid rather than carry it, so they take the recessed surface. */
lmms--gui--TrackView > QWidget {
	background-color: ${frame};
}

lmms--gui--TimeLineWidget {
	font-size: 7pt;
	min-height: 1.5em;
	max-height: 1.5em;

	qproperty-inactiveLoopColor: ${t("border-default")};
	qproperty-inactiveLoopBrush: ${t("border-default")};
	qproperty-inactiveLoopInnerColor: ${t("border-default")};
	qproperty-inactiveLoopHandleColor: ${fade("text-tertiary", 0.5)};

	qproperty-activeLoopColor: ${t("accent")};
	qproperty-activeLoopBrush: ${t("accent")};
	qproperty-activeLoopInnerColor: ${t("accent")};
	qproperty-activeLoopHandleColor: ${fade("text-heading", 0.8)};

	qproperty-loopRectangleVerticalPadding: 1;
	qproperty-loopHandleWidth: 8;

	qproperty-barLineColor: ${t("text-tertiary")};
	qproperty-barNumberColor: ${t("text-secondary")};
}

/* ---------------------------------------------------------------------- clips ---------------------------------------------------------------------- */

lmms--gui--ClipView {
	qproperty-mutedColor: ${fade("text-tertiary", 0.55)};
	qproperty-mutedBackgroundColor: ${frameHover};
	qproperty-selectedColor: ${t("accent")};
	qproperty-patternClipBackground: ${frameHover};
	qproperty-textColor: ${t("text-on-fill")};
	qproperty-textBackgroundColor: rgba(0, 0, 0, 0);
	qproperty-textShadowColor: rgba(0, 0, 0, 0);
	qproperty-gradient: false;
	qproperty-markerColor: ${fade("text-on-fill", 0.5)};
	font-size: 11px;
}

lmms--gui--MidiClipView {
	background-color: ${clip.midi};
	color: ${t("text-on-fill")};

	qproperty-noteFillColor: ${fade("text-on-fill", 0.85)};
	qproperty-noteBorderColor: ${clip.midi};
	qproperty-mutedNoteFillColor: ${fade("text-tertiary", 0.85)};
	qproperty-mutedNoteBorderColor: ${frameHover};
}

lmms--gui--SampleClipView {
	background-color: ${clip.sample};
	color: ${t("text-on-fill")};
}

lmms--gui--AutomationClipView {
	background-color: ${clip.automation};
	color: ${fade("text-on-fill", 0.7)};
}

lmms--gui--PatternClipView {
	background-color: ${clip.pattern};
	qproperty-emptyTrackHeightRatio: 0.5;
	qproperty-verticalPadding: 0.15;
	qproperty-noteVerticalSpacing: 0.2;
	qproperty-noteHorizontalSpacing: 0.2;
	qproperty-noteColor: ${t("text-on-fill")};
}

/* ---------------------------------------------------------------------- scroll bars ---------------------------------------------------------------------- */

/* §6.8 — transparent track, a border-hover thumb that brightens under the pointer. */
QScrollBar:horizontal {
	background: transparent;
	border: none;
	height: 10px;
	margin: 0px 10px;
}

QScrollBar:vertical {
	background: transparent;
	border: none;
	width: 10px;
	margin: 10px 0px;
}

QScrollBar::add-page, QScrollBar::sub-page {
	background: none;
}

QScrollBar::handle:horizontal {
	background: ${t("border-hover")};
	border: 3px solid transparent;
	border-radius: 5px;
	min-width: 24px;
}

QScrollBar::handle:vertical {
	background: ${t("border-hover")};
	border: 3px solid transparent;
	border-radius: 5px;
	min-height: 24px;
}

QScrollBar::handle:hover, QScrollBar::handle:pressed {
	background: ${t("text-tertiary")};
}

QScrollBar::handle:disabled {
	background: transparent;
}

lmms--gui--EffectRackView QScrollBar::handle:vertical:disabled {
	background: ${t("border-default")};
	border: 3px solid transparent;
	border-radius: 5px;
}

QScrollBar::add-line, QScrollBar::sub-line {
	background: transparent;
	border: none;
	border-radius: 0px;
	subcontrol-origin: margin;
}

QScrollBar::add-line:horizontal	{ subcontrol-position: right; width: 10px; }
QScrollBar::sub-line:horizontal	{ subcontrol-position: left; width: 10px; }
QScrollBar::add-line:vertical	{ subcontrol-position: bottom; height: 10px; }
QScrollBar::sub-line:vertical	{ subcontrol-position: top; height: 10px; }

QScrollBar::add-line:hover, QScrollBar::sub-line:hover,
QScrollBar::add-line:pressed, QScrollBar::sub-line:pressed,
QScrollBar::add-line:disabled, QScrollBar::sub-line:disabled {
	background: transparent;
}

QScrollBar::left-arrow:horizontal, QScrollBar::right-arrow:horizontal,
QScrollBar::up-arrow:vertical, QScrollBar::down-arrow:vertical {
	border: none;
	background-color: none;
	width: 5px;
	height: 5px;
}

QScrollBar::left-arrow:horizontal, QScrollBar::right-arrow:horizontal {
	margin-top: 3px;
}

QScrollBar::up-arrow:vertical, QScrollBar::down-arrow:vertical {
	margin-left: 3px;
}

QScrollBar::left-arrow:horizontal { background-image: url("resources:sbarrow_left.png"); }
QScrollBar::right-arrow:horizontal { background-image: url("resources:sbarrow_right.png"); }
QScrollBar::up-arrow:vertical { background-image: url("resources:sbarrow_up.png"); }
QScrollBar::down-arrow:vertical { background-image: url("resources:sbarrow_down.png"); }
QScrollBar::left-arrow:horizontal:disabled { background-image: url("resources:sbarrow_left_d.png"); }
QScrollBar::right-arrow:horizontal:disabled { background-image: url("resources:sbarrow_right_d.png"); }
QScrollBar::up-arrow:vertical:disabled { background-image: url("resources:sbarrow_up_d.png"); }
QScrollBar::down-arrow:vertical:disabled { background-image: url("resources:sbarrow_down_d.png"); }
lmms--gui--EffectRackView QScrollBar::up-arrow:vertical:disabled { background-image: url("resources:sbarrow_up.png"); }
lmms--gui--EffectRackView QScrollBar::down-arrow:vertical:disabled { background-image: url("resources:sbarrow_down.png"); }

/* ---------------------------------------------------------------------- buttons ---------------------------------------------------------------------- */

/* §6.1 — the default weight: transparent with a neutral hairline, accent border on hover. */
QPushButton#btn {
	color: ${t("text-body")};
	padding: 4px 14px;
	border: 1px solid ${t("border-default")};
	border-radius: 8px;
	background: transparent;
	font-weight: 500;
}

QPushButton#btn:hover {
	border: 1px solid ${t("accent")};
	color: ${t("text-heading")};
}

QPushButton#btn:pressed,
QPushButton#btn:checked {
	color: ${t("text-on-fill")};
	border: 1px solid ${t("accent")};
	background: ${t("accent")};
}

QPushButton#btn:disabled {
	color: ${t("text-tertiary")};
	border: 1px solid ${t("border-default")};
}

/* 20px = 1px border + 2px padding + 14px icon + 2px padding + 1px border */
QPushButton#btn-mute,
QPushButton#btn-mute-inv,
QPushButton#btn-mute-inv:checked,
QPushButton#btn-solo,
lmms--gui--TrackOperationsWidget QPushButton {
	padding: 2;
	min-height: 14;
	max-height: 14;
	min-width: 14;
	max-width: 14;
}

/* 16px = 1px border + 2px padding + 10px icon + 2px padding + 1px border */
QPushButton#btn-stepper-down,
QPushButton#btn-stepper-left,
QPushButton#btn-stepper-right {
	padding: 2;
	min-height: 10;
	max-height: 10;
	min-width: 10;
	max-width: 10;
}

/* §6.1's flat weight — these repeat once per track, so they carry no border until hovered. */
QPushButton#btn-stepper-down,
QPushButton#btn-stepper-left,
QPushButton#btn-stepper-right,
QPushButton#btn-mute,
QPushButton#btn-mute-inv:checked,
QPushButton#btn-solo,
lmms--gui--TrackOperationsWidget QPushButton {
	border: 1px solid transparent;
	border-radius: 4px;
	background: transparent;
}

QPushButton#btn-stepper-down::menu-indicator,
QPushButton#btn-stepper-left::menu-indicator,
QPushButton#btn-stepper-right::menu-indicator,
lmms--gui--TrackOperationsWidget QPushButton::menu-indicator {
	image: none;
}

lmms--gui--TrackOperationsWidget QPushButton {
	image: url("resources:gear.svg");
}

QPushButton#btn-mute,
QPushButton#btn-mute-inv:checked {
	image: url("resources:speaker.svg");
}

QPushButton#btn-solo {
	image: url("resources:headphones.svg");
}

QPushButton#btn-stepper-left {
	image: url("resources:arrow-left.svg");
}

QPushButton#btn-stepper-right {
	image: url("resources:arrow-right.svg");
}

QPushButton#btn-stepper-down {
	image: url("resources:arrow-down.svg");
}

QPushButton#btn-stepper-down:hover,
QPushButton#btn-stepper-left:hover,
QPushButton#btn-stepper-right:hover,
QPushButton#btn-mute:hover,
QPushButton#btn-solo:hover,
lmms--gui--TrackOperationsWidget QPushButton:hover {
	border: 1px solid ${t("border-default")};
	background: transparent;
}

QPushButton#btn-stepper-down:pressed,
QPushButton#btn-stepper-left:pressed,
QPushButton#btn-stepper-right:pressed,
lmms--gui--TrackOperationsWidget QPushButton:pressed {
	border: 1px solid ${t("accent")};
	background: transparent;
}

/* Mute and solo are latched states, so they invert to a solid fill the way a status chip does. */
QPushButton#btn-mute-inv,
QPushButton#btn-mute:checked {
	image: url("resources:speaker_slash.svg");
	border: 1px solid ${t("status-danger")};
	background: ${t("status-danger")};
}

QPushButton#btn-solo:checked {
	border: 1px solid ${t("accent")};
	background: ${t("accent")};
}

/* ---------------------------------------------------------------------- toolbars ---------------------------------------------------------------------- */

/* §6.4 — every frame member is one surface; a strip of another colour between them is the tell. */
QWidget#mainToolbar {
	background: ${frame};
	border-bottom: 1px solid ${t("border-default")};
}

QToolBar {
	background: ${frame};
	border: none;
	border-bottom: 1px solid ${t("border-default")};
	padding: 2px 8px;
	spacing: 0;
}

QToolBar::separator {
	border: none;
	width: 8px;
}

QToolButton, QToolButton::menu-button {
	margin: 1px;
	padding: 3px;
	border: 1px solid transparent;
	border-radius: 6px;
	background: transparent;
	font-size: 10px;
	color: ${t("text-on-navigation")};
}

QToolButton:hover, QToolButton::menu-button:hover {
	border: 1px solid ${t("border-default")};
	background: ${frameHover};
	color: ${t("text-heading")};
}

QToolButton:pressed {
	border: 1px solid ${t("accent")};
	background: ${frameHover};
}

QToolButton:checked {
	border: 1px solid ${t("accent")};
	background: ${fade("accent", 0.2)};
	color: ${t("text-heading")};
}

QToolButton:checked:hover {
	border: 1px solid ${t("accent")};
	background: ${fade("accent", 0.3)};
}

QToolButton:disabled {
	color: ${t("text-tertiary")};
}

QToolButton[popupMode="1"] {
	margin-right: 13px;
	border-top-right-radius: 0;
	border-bottom-right-radius: 0;
}

QToolButton::menu-button {
	subcontrol-origin: margin;
	width: 13px;
	padding: 0;
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
}

/* The oscilloscope and CPU meter sit directly on the toolbar surface. */
lmms--gui--Oscilloscope {
	background: none;
	border: none;
	qproperty-leftChannelColor: ${t("accent")};
	qproperty-rightChannelColor: ${t("syntax-type")};
	qproperty-otherChannelsColor: ${t("badge-experimental")};
	qproperty-clippingColor: ${t("status-danger")};
}

lmms--gui--CPULoadWidget {
	border: none;
	background: url("resources:cpuload_bg.png");
	qproperty-stepSize: 1;
}

/* Master volume and pitch, on the main toolbar. */
lmms--gui--AutomatableSlider::groove:vertical {
	background: ${desk};
	border: 1px solid ${t("border-default")};
	border-radius: 2px;
	width: 2px;
	margin: 2px 2px;
}

lmms--gui--AutomatableSlider::handle:vertical {
	background: none;
	border-image: url("resources:main_slider.png");
	width: 26px;
	height: 10px;
	border-radius: 2px;
	margin: -4px -12px -2px;
}

lmms--gui--AutomatableSlider::groove:horizontal {
	background: ${desk};
	border: 1px solid ${t("border-default")};
	border-radius: 2px;
	height: 2px;
	margin: 2px;
}

lmms--gui--AutomatableSlider::handle:horizontal {
	background: none;
	border-image: url("resources:horizontal_slider.png");
	width: 10px;
	height: 26px;
	border-radius: 2px;
	margin: -12px -2px;
}

/* ---------------------------------------------------------------------- track labels and sidebar ---------------------------------------------------------------------- */

lmms--gui--TrackLabelButton {
	background-color: transparent;
	border: 1px solid transparent;
	color: ${t("text-body")};
	font-size: 11px;
	font-weight: normal;
	padding: 2px 4px;
}

lmms--gui--TrackLabelButton:hover {
	background: ${frameHover};
	border: 1px solid ${t("border-default")};
	color: ${t("text-heading")};
}

lmms--gui--TrackLabelButton:pressed {
	background: ${frameHover};
	border: 1px solid ${t("accent")};
}

/* §6.5 — the track you are on is a raised card, not a tinted row. */
lmms--gui--TrackLabelButton:checked {
	border: 1px solid ${t("border-default")};
	background: ${canvas};
	color: ${t("text-heading")};
}

lmms--gui--TrackLabelButton:checked:pressed {
	border: 1px solid ${t("accent")};
	background: ${canvas};
}

/* §6.4 — a page title is chrome, not a selection, so the header recedes rather than filling with accent. */
lmms--gui--SideBarWidget {
	selection-background-color: ${frameHover};
	selection-color: ${t("text-heading")};
}

lmms--gui--SideBar {
	subcontrol-position: center;
	background: ${frame};
	border-right: 1px solid ${t("border-default")};
}

lmms--gui--SideBar QToolButton {
	background: none;
	border: 1px solid transparent;
	color: ${t("text-on-navigation")};
	font-size: 12px;
}

lmms--gui--SideBar QToolButton:hover {
	background: ${frameHover};
	border: 1px solid transparent;
	color: ${t("text-heading")};
	font-size: 12px;
}

lmms--gui--SideBar QToolButton:pressed {
	background: ${frameHover};
	border: 1px solid ${t("accent")};
	font-size: 12px;
}

/* The open sidebar page is the tab-selection case: a raised fill plus an accent edge. */
lmms--gui--SideBar QToolButton:checked {
	background: ${canvas};
	border: 1px solid ${t("border-default")};
	border-left: 2px solid ${t("accent")};
	color: ${t("text-heading")};
	font-size: 12px;
}

lmms--gui--PluginDescWidget {
	border: 1px solid transparent;
	border-bottom: 1px solid ${t("border-default")};
	border-radius: 0px;
	background-color: transparent;
	color: ${t("text-body")};
	font-weight: bold;
	margin: 0px;
}

lmms--gui--PluginDescWidget:hover {
	background: ${frameHover};
	color: ${t("text-heading")};
}

/* ---------------------------------------------------------------------- windows, tabs and panels ---------------------------------------------------------------------- */

/* SubWindow paints its own title bar, so the gradient slots are given one flat frame colour each. */
lmms--gui--SubWindow {
	color: ${frame};
	qproperty-activeColor: ${frameHover};
	qproperty-textShadowColor: rgba(0, 0, 0, 0);
	qproperty-borderColor: ${t("border-default")};
}

lmms--gui--SubWindow > QLabel {
	color: ${t("text-on-navigation")};
	font-size: 12px;
	font-style: normal;
}

lmms--gui--SubWindow > QPushButton {
	background-color: transparent;
	border: 1px solid transparent;
	border-radius: 6px;
}

lmms--gui--SubWindow > QPushButton:hover {
	background-color: ${fade("text-heading", 0.12)};
	border: 1px solid ${t("border-default")};
	border-radius: 6px;
}

lmms--gui--TabWidget {
	background-color: ${canvas};
	qproperty-tabText: ${t("text-on-navigation")};
	qproperty-tabTitleText: ${t("text-heading")};
	qproperty-tabSelected: ${canvas};
	qproperty-tabTextSelected: ${t("text-heading")};
	qproperty-tabBackground: ${frame};
	qproperty-tabBorder: ${t("border-default")};
}

lmms--gui--GroupBox {
	background-color: ${canvas};
}

lmms--gui--EffectSelectDialog QScrollArea {
	background: ${canvas};
}

lmms--gui--SetupDialog QScrollArea {
	border: 0px;
}

lmms--gui--EffectControlDialog QGroupBox {
	background: ${canvas};
	margin-top: 1ex;
	padding: 10px 2px 1px;
	border-radius: 8px;
	border: 1px solid ${t("border-default")};
}

lmms--gui--EffectControlDialog QGroupBox::title {
	subcontrol-origin: margin;
	subcontrol-position: top center;
	background: ${canvas};
	color: ${t("text-secondary")};
	border-radius: 4px;
	border: none;
	padding: 2px 6px;
}

lmms--gui--Sf2InstrumentView > QLabel {
	font-size: 10px;
}

/* ---------------------------------------------------------------------- mixer ---------------------------------------------------------------------- */

lmms--gui--MixerView QPushButton,
lmms--gui--EffectRackView QPushButton,
lmms--gui--ControllerRackView QPushButton {
	font-size: 10px;
}

lmms--gui--MixerChannelView {
	background: ${frame};
	color: ${t("text-body")};
	qproperty-backgroundActive: ${canvas};
	qproperty-strokeOuterActive: ${t("accent")};
	qproperty-strokeOuterInactive: ${t("border-default")};
	qproperty-strokeInnerActive: ${t("accent")};
	qproperty-strokeInnerInactive: ${desk};
}

lmms--gui--MixerChannelView QGraphicsView {
	background: transparent;
	border-style: none;
}

lmms--gui--PeakIndicator {
	background-color: ${desk};
	font-size: 7pt;
}

/* The one place status colours mean what they say: a meter reading level against clipping. */
lmms--gui--Fader {
	qproperty-peakOk: ${t("status-success")};
	qproperty-peakWarn: ${t("status-warning")};
	qproperty-peakClip: ${t("status-danger")};
	qproperty-unityMarker: ${t("border-control")};
}

/* ---------------------------------------------------------------------- instrument graphs ---------------------------------------------------------------------- */

lmms--gui--EnvelopeGraph {
	qproperty-noAmountColor: ${t("border-control")};
	qproperty-fullAmountColor: ${t("accent")};
	qproperty-markerFillColor: ${t("text-heading")};
	qproperty-markerOutlineColor: ${desk};
}

lmms--gui--LfoGraph {
	qproperty-noAmountColor: ${t("border-control")};
	qproperty-fullAmountColor: ${t("accent")};
}

lmms--gui--VectorView {
	qproperty-colorTrace: ${t("accent")};
	qproperty-colorGrid: ${fade("border-default", 0.6)};
	qproperty-colorLabels: ${t("text-tertiary")};
}

lmms--gui--BarModelEditor {
	qproperty-backgroundBrush: ${canvas};
	qproperty-barBrush: ${t("accent")};
}

lmms--gui--CompressorControlDialog {
	qproperty-inVolAreaColor: ${fade("text-body", 0.07)};
	qproperty-inVolColor: ${fade("text-body", 0.4)};
	qproperty-outVolAreaColor: ${fade("text-body", 0.12)};
	qproperty-outVolColor: ${fade("text-body", 0.94)};
	qproperty-gainReductionColor: ${fade("status-danger", 0.82)};
	qproperty-kneeColor: ${t("accent")};
	qproperty-kneeColor2: ${t("syntax-type")};
	qproperty-threshColor: ${fade("accent", 0.4)};
	qproperty-textColor: ${fade("text-body", 0.5)};
	qproperty-graphColor: ${fade("border-default", 0.8)};
	qproperty-resetColor: ${fade("status-warning", 0.8)};
	qproperty-backgroundColor: ${desk};
}

/* ---------------------------------------------------------------------- knobs ---------------------------------------------------------------------- */

/* §1 — one accent. Every plugin's knobs read as the same control instead of a per-plugin hue. */
lmms--gui--Knob {
	color: ${t("accent")};
	qproperty-outerColor: ${t("accent")};
	/* Without these two the indicator line falls back to QPalette::WindowText and paints near-white. */
	qproperty-lineActiveColor: ${t("accent")};
	qproperty-arcActiveColor: ${fade("accent", 0.28)};
	qproperty-lineInactiveColor: ${t("border-control")};
	qproperty-arcInactiveColor: ${fade("border-control", 0.28)};
}

lmms--gui--TripleOscillatorView lmms--gui--Knob {
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 7;
	qproperty-centerPointX: 13.0;
	qproperty-centerPointY: 14.0;
	qproperty-lineWidth: 2;
}

lmms--gui--KickerInstrumentView lmms--gui--Knob#smallKnob {
	qproperty-innerRadius: 3;
	qproperty-outerRadius: 11.0;
	qproperty-centerPointX: 14.5;
	qproperty-centerPointY: 14.5;
	qproperty-lineWidth: 2;
}

lmms--gui--KickerInstrumentView lmms--gui--Knob#largeKnob {
	qproperty-innerRadius: 12.0;
	qproperty-outerRadius: 14.5;
	qproperty-centerPointX: 17.0;
	qproperty-centerPointY: 17.0;
	qproperty-lineWidth: 3;
}

lmms--gui--AudioFileProcessorView lmms--gui--Knob {
	qproperty-innerRadius: 4;
	qproperty-outerRadius: 11.2;
	qproperty-centerPointX: 18.5;
	qproperty-centerPointY: 16.5;
	qproperty-lineWidth: 3;
}

lmms--gui--OrganicInstrumentView lmms--gui--Knob {
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 7.5;
	qproperty-centerPointX: 10.5;
	qproperty-centerPointY: 10.5;
	qproperty-lineWidth: 1.5;
}

lmms--gui--OrganicInstrumentView lmms--gui--Knob#fx1Knob,
lmms--gui--OrganicInstrumentView lmms--gui--Knob#volKnob {
	qproperty-innerRadius: 4;
	qproperty-outerRadius: 10.0;
	qproperty-centerPointX: 18.5;
	qproperty-centerPointY: 13.8;
	qproperty-lineWidth: 2;
}

lmms--gui--Sf2InstrumentView lmms--gui--Knob {
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 9.2;
	qproperty-centerPointX: 15.5;
	qproperty-centerPointY: 15.42;
	qproperty-lineWidth: 2;
}

/* Sfxr draws its panel in a light wood tone, so its knobs need the inverting on-colour. */
lmms--gui--SfxrInstrumentView lmms--gui--Knob {
	color: ${t("text-on-light")};
	qproperty-outerColor: ${t("text-on-light")};
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 9;
	qproperty-lineWidth: 2;
}

lmms--gui--OpulenzInstrumentView lmms--gui--Knob {
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 9;
	qproperty-lineWidth: 2;
}

lmms--gui--SidInstrumentView lmms--gui--Knob {
	color: ${t("text-on-light")};
	qproperty-outerColor: ${t("text-on-light")};
	qproperty-innerRadius: 2;
	qproperty-outerRadius: 7;
	qproperty-lineWidth: 2;
}

lmms--gui--SlicerTView lmms--gui--Knob {
	qproperty-innerRadius: 1;
	qproperty-outerRadius: 11;
	qproperty-lineWidth: 3;
}

lmms--gui--WatsynView lmms--gui--Knob {
	qproperty-innerRadius: 1;
	qproperty-outerRadius: 7;
	qproperty-centerPointX: 9.5;
	qproperty-centerPointY: 9.5;
	qproperty-lineWidth: 2;
}

lmms--gui--WatsynView lmms--gui--Knob#mixKnob {
	qproperty-outerRadius: 13;
	qproperty-centerPointX: 15.5;
	qproperty-centerPointY: 15.5;
}

lmms--gui--MonstroView lmms--gui--Knob {
	qproperty-outerRadius: 9;
	qproperty-innerRadius: 6;
	qproperty-centerPointX: 10;
	qproperty-centerPointY: 10;
	qproperty-lineWidth: 2.5;
}

lmms--gui--NesInstrumentView lmms--gui--Knob {
	qproperty-outerRadius: 11.0;
	qproperty-innerRadius: 8.0;
	qproperty-centerPointX: 14.5;
	qproperty-centerPointY: 14.5;
	qproperty-lineWidth: 2;
}

lmms--gui--CompressorControlDialog lmms--gui--Knob {
	qproperty-lineWidth: 2;
}

lmms--gui--FrequencyShifterControlDialog lmms--gui--Knob {
	qproperty-lineWidth: 3;
}

lmms--gui--FrequencyShifterControlDialog lmms--gui--Knob#fs_glide,
lmms--gui--FrequencyShifterControlDialog lmms--gui--Knob#fs_dglide,
lmms--gui--FrequencyShifterControlDialog lmms--gui--Knob#fs_phase {
	qproperty-lineWidth: 2;
}
`;

/* ---------- write or check ---------- */

const outputs = [["lmms/Halon/style.css", sheet]];

let stale = false;
for (const [relative, contents] of outputs) {
    const outPath = join(root, relative);

    if (check) {
        if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== contents) {
            console.error(`${outPath} is stale — run: node scripts/build-lmms.mjs`);
            stale = true;
        }
        continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, contents);
}

if (check) {
    if (!stale) console.log(`lmms: ${outputs.length} files are up to date.`);
    else process.exit(1);
} else {
    console.log(`Wrote ${outputs.length} files under lmms/`);
}
