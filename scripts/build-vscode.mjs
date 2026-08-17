#!/usr/bin/env node
/* Generates the VS Code color themes from the GTK token files.
 *
 * VS Code themes are JSON, so like Cinnamon there is no variable layer in the
 * shipped artifact — the two-layer rule survives by keeping the mapping here in
 * token names and substituting at build time. Both schemes come from the same
 * mapping; only the token file differs. The workbench mapping follows the
 * component treatments in THEME-DESIGN-GUIDE.md §6 (navigation frame → activity
 * bar, title bar, tab bar, status bar; the active tab is a raised card on it,
 * marked by elevation, heading text and the accent rather than by its fill). Syntax highlighting has no precedent in the guide, so it stays
 * inside §1.1's palette: slate carries structure, weight carries names, the
 * accent carries keywords, and the §3.4 off-ramp violet carries literals.
 *
 * Usage:
 *   node scripts/build-vscode.mjs             # both schemes -> vscode/themes
 *   node scripts/build-vscode.mjs --check     # fail if the output is stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.HALON_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

const TRANSPARENT = "#00000000";

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
    return (name) => hexify(resolve(name));
};

/* VS Code accepts only #RRGGBB / #RRGGBBAA, so rgba() tokens are converted. */
const hexify = (value) => {
    if (value.startsWith("#")) {
        return value.length === 4 ? "#" + [...value.slice(1)].map((c) => c + c).join("") : value.toLowerCase();
    }
    const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if (!m) throw new Error(`unparseable color: ${value}`);
    const byte = (n) => Math.round(Number(n)).toString(16).padStart(2, "0");
    return ("#" + byte(m[1]) + byte(m[2]) + byte(m[3]) + (m[4] === undefined ? "" : byte(m[4] * 255))).toLowerCase();
};

const withAlpha = (hex, fraction) =>
    hex.slice(0, 7) + Math.round(fraction * 255).toString(16).padStart(2, "0");

/* ---------- the theme ---------- */

function theme(scheme) {
    const dark = scheme === "dark";
    const t = loadTokens(scheme);
    const a = (name, fraction) => withAlpha(t(name), fraction);
    const tr = (light, darkValue) => (dark ? darkValue : light);

    /* The ANSI ramp lives in the Tilix schemes; reading it keeps one terminal palette across both. */
    const tilix = JSON.parse(readFileSync(join(root, dark ? "tilix/Halon-Dark.json" : "tilix/Halon.json"), "utf8"));
    const ansi = tilix.palette.map((c) => c.toLowerCase());

    const colors = {
        /* Base */
        "focusBorder": t("accent"),
        "foreground": t("text-body"),
        "disabledForeground": t("text-tertiary"),
        "descriptionForeground": t("text-secondary"),
        "errorForeground": t("status-danger"),
        "icon.foreground": t("text-secondary"),
        "widget.shadow": t("shadow-floating"),
        "widget.border": t("border-default"),
        "selection.background": t("focus-ring"),
        "sash.hoverBorder": t("accent"),
        "toolbar.hoverBackground": a("text-tertiary", 0.20),
        "toolbar.activeBackground": a("text-tertiary", 0.30),

        /* Text content */
        "textLink.foreground": t("accent"),
        "textLink.activeForeground": t("accent"),
        "textBlockQuote.background": t("surface-secondary"),
        "textBlockQuote.border": t("accent"),
        "textCodeBlock.background": t("surface-secondary"),
        "textPreformat.foreground": t("text-body"),
        "textPreformat.background": t("surface-secondary"),
        "textSeparator.foreground": t("border-default"),

        /* Buttons — §6.1: accent fill, opacity-only hover */
        "button.background": t("accent"),
        "button.foreground": t("text-on-fill"),
        "button.hoverBackground": a("accent", 0.85),
        "button.secondaryBackground": t("surface-secondary"),
        "button.secondaryForeground": t("text-body"),
        "button.secondaryHoverBackground": t("border-default"),
        "checkbox.background": t("surface-default"),
        "checkbox.foreground": t("accent"),
        "checkbox.border": t("border-control"),
        "badge.background": t("accent"),
        "badge.foreground": t("text-on-fill"),
        "progressBar.background": t("accent"),

        /* Inputs — §6.2: hairline at rest, accent on interaction */
        "input.background": t("surface-default"),
        "input.foreground": t("text-body"),
        "input.border": t("border-default"),
        "input.placeholderForeground": t("text-tertiary"),
        "inputOption.activeBackground": t("focus-ring"),
        "inputOption.activeBorder": t("accent"),
        "inputOption.activeForeground": t("text-heading"),
        "inputValidation.errorBackground": a("status-danger", 0.15),
        "inputValidation.errorForeground": t("text-body"),
        "inputValidation.errorBorder": t("status-danger"),
        "inputValidation.warningBackground": a("status-warning", 0.15),
        "inputValidation.warningForeground": t("text-body"),
        "inputValidation.warningBorder": t("status-warning-text"),
        "inputValidation.infoBackground": a("accent", 0.12),
        "inputValidation.infoForeground": t("text-body"),
        "inputValidation.infoBorder": t("accent"),
        "dropdown.background": t("surface-default"),
        "dropdown.listBackground": t("surface-default"),
        "dropdown.foreground": t("text-body"),
        "dropdown.border": t("border-default"),

        /* Lists and trees — §6.5: a selected row is a solid accent fill carrying text-on-fill,
           hover fill is border-default (the one hover that works on either surface) */
        "list.activeSelectionBackground": t("accent"),
        "list.activeSelectionForeground": t("text-on-fill"),
        "list.activeSelectionIconForeground": t("text-on-fill"),
        "list.focusBackground": t("accent"),
        "list.focusForeground": t("text-on-fill"),
        "list.focusHighlightForeground": t("text-on-fill"),
        "list.inactiveSelectionBackground": a("accent", tr(0.25, 0.30)),
        "list.hoverBackground": t("border-default"),
        "list.hoverForeground": t("text-heading"),
        "list.highlightForeground": t("accent"),
        "list.dropBackground": t("focus-ring"),
        "list.errorForeground": t("status-danger"),
        "list.warningForeground": t("status-warning-text"),
        "list.deemphasizedForeground": t("text-tertiary"),
        "list.invalidItemForeground": t("status-danger"),
        "listFilterWidget.background": t("surface-default"),
        "listFilterWidget.outline": t("accent"),
        "listFilterWidget.noMatchesOutline": t("status-danger"),
        "tree.indentGuidesStroke": t("border-hover"),

        /* Activity bar — the navigation rail, §6.4 */
        "activityBar.background": t("surface-navigation"),
        "activityBar.foreground": t("text-heading"),
        "activityBar.inactiveForeground": t("text-on-navigation"),
        "activityBar.activeBorder": t("accent"),
        "activityBar.activeBackground": t("surface-navigation-hover"),
        "activityBarBadge.background": t("accent"),
        "activityBarBadge.foreground": t("text-on-fill"),

        /* Side bar — §6.5: one step off the content surface */
        "sideBar.background": t("surface-secondary"),
        "sideBar.foreground": t("text-body"),
        "sideBar.border": t("border-default"),
        "sideBarTitle.foreground": t("text-heading"),
        "sideBarSectionHeader.background": TRANSPARENT,
        "sideBarSectionHeader.foreground": t("text-secondary"),
        "sideBarSectionHeader.border": t("border-default"),

        /* Editor tabs — §6.4: the active tab is a raised card, not a light block */
        "editorGroupHeader.tabsBackground": t("surface-navigation"),
        "editorGroupHeader.noTabsBackground": t("surface-navigation"),
        "editorGroupHeader.tabsBorder": TRANSPARENT,
        "editorGroup.border": t("border-default"),
        "editorGroup.dropBackground": t("focus-ring"),
        "tab.activeBackground": t("surface-default"),
        "tab.activeForeground": t("text-heading"),
        "tab.activeBorder": TRANSPARENT,
        "tab.activeBorderTop": TRANSPARENT,
        "tab.border": t("surface-navigation"),
        "tab.inactiveBackground": t("surface-navigation"),
        "tab.inactiveForeground": t("text-on-navigation"),
        "tab.hoverBackground": t("surface-navigation-hover"),
        "tab.hoverForeground": t("text-heading"),
        "tab.unfocusedActiveBackground": t("surface-default"),
        "tab.unfocusedActiveForeground": t("text-secondary"),
        "tab.unfocusedInactiveForeground": a("text-on-navigation", 0.60),

        /* Editor core */
        "editor.background": t("surface-default"),
        "editor.foreground": t("text-body"),
        "editorLineNumber.foreground": t("text-tertiary"),
        "editorLineNumber.activeForeground": t("text-secondary"),
        "editorCursor.foreground": t("accent"),
        "editor.selectionBackground": t("focus-ring"),
        "editor.inactiveSelectionBackground": a("accent", tr(0.08, 0.16)),
        "editor.selectionHighlightBackground": a("accent", tr(0.07, 0.14)),
        "editor.wordHighlightBackground": a("accent", tr(0.06, 0.12)),
        "editor.wordHighlightStrongBackground": a("accent", tr(0.10, 0.20)),
        "editor.findMatchBackground": tr(a("accent", 0.40), a("accent", 0.40)),
        "editor.findMatchBorder": tr(TRANSPARENT, t("accent")),
        "editor.findMatchHighlightBackground": tr(a("accent", 0.22), a("accent", 0.22)),
        "editor.findRangeHighlightBackground": a("accent", tr(0.04, 0.08)),
        "editor.hoverHighlightBackground": a("accent", tr(0.08, 0.16)),
        "editor.rangeHighlightBackground": a("accent", tr(0.04, 0.08)),
        "editor.lineHighlightBackground": t("surface-secondary"),
        "editor.lineHighlightBorder": TRANSPARENT,
        "editor.foldBackground": a("accent", tr(0.05, 0.10)),
        "editorLink.activeForeground": t("accent"),
        "editorWhitespace.foreground": t("border-hover"),
        "editorIndentGuide.background1": t("border-default"),
        "editorIndentGuide.activeBackground1": t("border-hover"),
        "editorRuler.foreground": t("border-default"),
        "editorCodeLens.foreground": t("text-tertiary"),
        "editorGhostText.foreground": t("text-tertiary"),
        "editorInlayHint.background": t("surface-secondary"),
        "editorInlayHint.foreground": t("text-tertiary"),
        "editorBracketMatch.background": a("accent", 0.10),
        "editorBracketMatch.border": t("accent"),
        "editorBracketHighlight.foreground1": t("text-secondary"),
        "editorBracketHighlight.foreground2": t("accent"),
        "editorBracketHighlight.foreground3": t("syntax-type"),
        "editorBracketHighlight.foreground4": t("text-secondary"),
        "editorBracketHighlight.foreground5": t("accent"),
        "editorBracketHighlight.foreground6": t("syntax-type"),
        "editorBracketHighlight.unexpectedBracket.foreground": t("status-danger"),
        "editorUnnecessaryCode.opacity": "#00000080",
        "editorLightBulb.foreground": t("status-warning-text"),
        "editorLightBulbAutoFix.foreground": t("accent"),
        "editorStickyScroll.background": t("surface-default"),
        "editorStickyScrollHover.background": t("surface-secondary"),

        /* Diagnostics — §3.6: warning marks use the text token, not the fill token */
        "editorError.foreground": t("status-danger"),
        "editorWarning.foreground": t("status-warning-text"),
        "editorInfo.foreground": t("accent"),
        "editorHint.foreground": t("text-tertiary"),
        "problemsErrorIcon.foreground": t("status-danger"),
        "problemsWarningIcon.foreground": t("status-warning-text"),
        "problemsInfoIcon.foreground": t("accent"),
        "editorMarkerNavigation.background": t("surface-default"),
        "editorMarkerNavigationError.background": t("status-danger"),
        "editorMarkerNavigationWarning.background": t("status-warning-text"),
        "editorMarkerNavigationInfo.background": t("accent"),

        /* Gutter and diff — status colors carrying meaning */
        "editorGutter.background": t("surface-default"),
        "editorGutter.addedBackground": t("status-success"),
        "editorGutter.modifiedBackground": t("accent"),
        "editorGutter.deletedBackground": t("status-danger"),
        "diffEditor.insertedTextBackground": a("status-success", tr(0.12, 0.20)),
        "diffEditor.removedTextBackground": a("status-danger", tr(0.12, 0.20)),
        "diffEditor.insertedLineBackground": a("status-success", tr(0.07, 0.12)),
        "diffEditor.removedLineBackground": a("status-danger", tr(0.07, 0.12)),
        "diffEditor.border": t("border-default"),
        "merge.currentHeaderBackground": a("status-success", 0.35),
        "merge.currentContentBackground": a("status-success", 0.12),
        "merge.incomingHeaderBackground": a("accent", 0.35),
        "merge.incomingContentBackground": a("accent", 0.12),
        "merge.commonHeaderBackground": a("text-tertiary", 0.30),
        "merge.commonContentBackground": a("text-tertiary", 0.12),

        /* Overview ruler and scrollbar — §6.8: flat track, slate thumb */
        "editorOverviewRuler.border": TRANSPARENT,
        "editorOverviewRuler.findMatchForeground": a("accent", 0.50),
        "editorOverviewRuler.errorForeground": t("status-danger"),
        "editorOverviewRuler.warningForeground": t("status-warning-text"),
        "editorOverviewRuler.infoForeground": t("accent"),
        "scrollbar.shadow": TRANSPARENT,
        "scrollbarSlider.background": a("border-hover", 0.60),
        "scrollbarSlider.hoverBackground": a("text-tertiary", 0.60),
        "scrollbarSlider.activeBackground": a("text-tertiary", 0.80),

        /* Minimap */
        "minimap.selectionHighlight": t("accent"),
        "minimap.findMatchHighlight": t("accent"),
        "minimap.errorHighlight": t("status-danger"),
        "minimap.warningHighlight": t("status-warning-text"),
        "minimapGutter.addedBackground": t("status-success"),
        "minimapGutter.modifiedBackground": t("accent"),
        "minimapGutter.deletedBackground": t("status-danger"),

        /* Widgets — §6.6: content surface with hairline, floating shadow */
        "editorWidget.background": t("surface-default"),
        "editorWidget.foreground": t("text-body"),
        "editorWidget.border": t("border-default"),
        "editorSuggestWidget.background": t("surface-default"),
        "editorSuggestWidget.border": t("border-default"),
        "editorSuggestWidget.foreground": t("text-body"),
        "editorSuggestWidget.selectedBackground": t("accent"),
        "editorSuggestWidget.selectedForeground": t("text-on-fill"),
        "editorSuggestWidget.selectedIconForeground": t("text-on-fill"),
        "editorSuggestWidget.focusHighlightForeground": t("text-on-fill"),
        "editorSuggestWidget.highlightForeground": t("accent"),
        "editorHoverWidget.background": t("surface-default"),
        "editorHoverWidget.foreground": t("text-body"),
        "editorHoverWidget.border": t("border-default"),
        "editorHoverWidget.statusBarBackground": t("surface-secondary"),
        "debugExceptionWidget.background": a("status-danger", 0.12),
        "debugExceptionWidget.border": t("status-danger"),

        /* Peek view */
        "peekView.border": t("accent"),
        "peekViewEditor.background": t("surface-secondary"),
        "peekViewEditorGutter.background": t("surface-secondary"),
        "peekViewEditor.matchHighlightBackground": tr(a("accent", 0.30), a("accent", 0.30)),
        "peekViewResult.background": t("surface-secondary"),
        "peekViewResult.fileForeground": t("text-heading"),
        "peekViewResult.lineForeground": t("text-secondary"),
        "peekViewResult.matchHighlightBackground": tr(a("accent", 0.30), a("accent", 0.30)),
        "peekViewResult.selectionBackground": t("accent"),
        "peekViewResult.selectionForeground": t("text-on-fill"),
        "peekViewTitle.background": t("surface-secondary"),
        "peekViewTitleLabel.foreground": t("text-heading"),
        "peekViewTitleDescription.foreground": t("text-secondary"),

        /* Panel */
        "panel.background": t("surface-default"),
        "panel.border": t("border-default"),
        "panelTitle.activeForeground": t("text-heading"),
        "panelTitle.activeBorder": t("accent"),
        "panelTitle.inactiveForeground": t("text-secondary"),
        "panelSectionHeader.background": t("surface-secondary"),
        "panelSection.border": t("border-default"),

        /* Status bar — part of the frame, §6.4; debugging borrows the experimental badge, §6.7 */
        "statusBar.background": t("surface-navigation"),
        "statusBar.foreground": t("text-on-navigation"),
        "statusBar.border": TRANSPARENT,
        "statusBar.noFolderBackground": t("surface-navigation"),
        "statusBar.noFolderForeground": t("text-on-navigation"),
        "statusBar.debuggingBackground": t("badge-experimental"),
        "statusBar.debuggingForeground": t("text-on-fill"),
        "statusBar.focusBorder": t("accent"),
        "statusBarItem.hoverBackground": t("surface-navigation-hover"),
        "statusBarItem.hoverForeground": t("text-heading"),
        "statusBarItem.activeBackground": t("surface-navigation-hover"),
        "statusBarItem.prominentBackground": t("surface-navigation-hover"),
        "statusBarItem.prominentForeground": t("text-heading"),
        "statusBarItem.prominentHoverBackground": t("surface-navigation-hover"),
        "statusBarItem.remoteBackground": t("accent"),
        "statusBarItem.remoteForeground": t("text-on-fill"),
        "statusBarItem.errorBackground": t("status-danger"),
        "statusBarItem.errorForeground": t("text-on-fill"),
        "statusBarItem.warningBackground": t("status-warning"),
        "statusBarItem.warningForeground": t("text-on-light"),

        /* Title bar — part of the frame, §6.4 */
        "titleBar.activeBackground": t("surface-navigation"),
        "titleBar.activeForeground": t("text-on-navigation"),
        "titleBar.inactiveBackground": t("surface-navigation"),
        "titleBar.inactiveForeground": a("text-on-navigation", 0.60),
        "titleBar.border": TRANSPARENT,
        "menubar.selectionBackground": t("surface-navigation-hover"),
        "menubar.selectionForeground": t("text-heading"),

        /* Menus — §6.6 */
        "menu.background": t("surface-default"),
        "menu.foreground": t("text-body"),
        "menu.selectionBackground": t("surface-secondary"),
        "menu.selectionForeground": t("text-heading"),
        "menu.selectionBorder": TRANSPARENT,
        "menu.separatorBackground": t("border-default"),
        "menu.border": t("border-default"),

        /* Command palette and quick input */
        "quickInput.background": t("surface-default"),
        "quickInput.foreground": t("text-body"),
        "quickInputTitle.background": t("surface-secondary"),
        "quickInputList.focusBackground": t("accent"),
        "quickInputList.focusForeground": t("text-on-fill"),
        "quickInputList.focusIconForeground": t("text-on-fill"),
        "pickerGroup.foreground": t("text-secondary"),
        "pickerGroup.border": t("border-default"),
        "keybindingLabel.background": t("surface-secondary"),
        "keybindingLabel.foreground": t("text-secondary"),
        "keybindingLabel.border": t("border-default"),
        "keybindingLabel.bottomBorder": t("border-hover"),

        /* Notifications — toasts belong to the frame, §6.6 */
        "notifications.background": t("surface-navigation"),
        "notifications.foreground": t("text-heading"),
        "notifications.border": t("surface-navigation-hover"),
        "notificationToast.border": t("surface-navigation-hover"),
        "notificationCenter.border": t("surface-navigation-hover"),
        "notificationCenterHeader.background": t("surface-navigation"),
        "notificationCenterHeader.foreground": t("text-heading"),
        "notificationLink.foreground": t("text-on-navigation"),
        "notificationsErrorIcon.foreground": t("status-danger"),
        "notificationsWarningIcon.foreground": t("status-warning"),
        "notificationsInfoIcon.foreground": t("text-on-navigation"),
        "banner.background": t("surface-navigation"),
        "banner.foreground": t("text-heading"),
        "banner.iconForeground": t("text-on-navigation"),

        /* Breadcrumbs */
        "breadcrumb.background": t("surface-default"),
        "breadcrumb.foreground": t("text-tertiary"),
        "breadcrumb.focusForeground": t("text-body"),
        "breadcrumb.activeSelectionForeground": t("text-heading"),
        "breadcrumbPicker.background": t("surface-default"),

        /* Terminal */
        "terminal.background": t("surface-default"),
        "terminal.foreground": t("text-body"),
        "terminal.selectionBackground": a("accent", 0.40),
        "terminal.selectionForeground": t("text-on-light"),
        "terminal.inactiveSelectionBackground": a("accent", tr(0.40, 0.25)),
        "terminalCursor.foreground": t("accent"),
        "terminal.ansiBlack": ansi[0],
        "terminal.ansiRed": ansi[1],
        "terminal.ansiGreen": ansi[2],
        "terminal.ansiYellow": ansi[3],
        "terminal.ansiBlue": ansi[4],
        "terminal.ansiMagenta": ansi[5],
        "terminal.ansiCyan": ansi[6],
        "terminal.ansiWhite": ansi[7],
        "terminal.ansiBrightBlack": ansi[8],
        "terminal.ansiBrightRed": ansi[9],
        "terminal.ansiBrightGreen": ansi[10],
        "terminal.ansiBrightYellow": ansi[11],
        "terminal.ansiBrightBlue": ansi[12],
        "terminal.ansiBrightMagenta": ansi[13],
        "terminal.ansiBrightCyan": ansi[14],
        "terminal.ansiBrightWhite": ansi[15],

        /* Debug */
        "debugToolBar.background": t("surface-navigation"),
        "debugToolBar.border": t("surface-navigation-hover"),
        "debugIcon.breakpointForeground": t("status-danger"),
        "debugIcon.startForeground": t("status-success"),
        "debugIcon.stopForeground": t("status-danger"),
        "debugIcon.restartForeground": t("status-success"),
        "debugIcon.pauseForeground": t("accent"),
        "debugIcon.stepOverForeground": t("accent"),
        "debugIcon.stepIntoForeground": t("accent"),
        "debugIcon.stepOutForeground": t("accent"),
        "debugIcon.continueForeground": t("status-success"),
        "editor.stackFrameHighlightBackground": a("status-warning", 0.15),
        "editor.focusedStackFrameHighlightBackground": a("status-success", 0.12),
        "debugConsole.infoForeground": t("accent"),
        "debugConsole.warningForeground": t("status-warning-text"),
        "debugConsole.errorForeground": t("status-danger"),
        "debugConsole.sourceForeground": t("text-secondary"),

        /* Testing */
        "testing.iconPassed": t("status-success"),
        "testing.iconFailed": t("status-danger"),
        "testing.iconErrored": t("status-danger"),
        "testing.iconQueued": t("status-warning-text"),
        "testing.iconSkipped": t("text-tertiary"),

        /* Git decorations */
        "gitDecoration.modifiedResourceForeground": t("accent"),
        "gitDecoration.addedResourceForeground": t("status-success"),
        "gitDecoration.untrackedResourceForeground": t("status-success"),
        "gitDecoration.deletedResourceForeground": t("status-danger"),
        "gitDecoration.renamedResourceForeground": t("status-success"),
        "gitDecoration.conflictingResourceForeground": t("status-warning-text"),
        "gitDecoration.ignoredResourceForeground": t("text-tertiary"),
        "gitDecoration.submoduleResourceForeground": t("text-secondary"),

        /* Settings, extensions, welcome */
        "settings.headerForeground": t("text-heading"),
        "settings.modifiedItemIndicator": t("accent"),
        "settings.focusedRowBackground": t("surface-secondary"),
        "settings.rowHoverBackground": a("accent", tr(0.04, 0.08)),
        "extensionButton.prominentBackground": t("accent"),
        "extensionButton.prominentForeground": t("text-on-fill"),
        "extensionButton.prominentHoverBackground": a("accent", 0.85),
        "extensionBadge.remoteBackground": t("accent"),
        "extensionBadge.remoteForeground": t("text-on-fill"),
        "welcomePage.tileBackground": t("surface-secondary"),
        "welcomePage.tileHoverBackground": t("border-default"),
        "welcomePage.progress.background": t("surface-secondary"),
        "welcomePage.progress.foreground": t("accent"),
        "walkthrough.embeddedEditorBackground": t("surface-secondary"),

        /* Symbol icons — the palette's three carrying hues, nothing off-ramp beyond §3.4 */
        "symbolIcon.classForeground": t("syntax-type"),
        "symbolIcon.interfaceForeground": t("syntax-type"),
        "symbolIcon.enumeratorForeground": t("syntax-type"),
        "symbolIcon.structForeground": t("syntax-type"),
        "symbolIcon.eventForeground": t("accent"),
        "symbolIcon.functionForeground": t("text-heading"),
        "symbolIcon.methodForeground": t("text-heading"),
        "symbolIcon.constructorForeground": t("text-heading"),
        "symbolIcon.constantForeground": t("syntax-number"),
        "symbolIcon.enumeratorMemberForeground": t("syntax-number"),
        "symbolIcon.variableForeground": t("text-secondary"),
        "symbolIcon.fieldForeground": t("text-secondary"),
        "symbolIcon.propertyForeground": t("text-secondary"),
        "symbolIcon.namespaceForeground": t("text-secondary"),
        "symbolIcon.moduleForeground": t("text-secondary"),
        "symbolIcon.keywordForeground": t("accent"),
        "symbolIcon.snippetForeground": t("text-secondary"),
        "symbolIcon.textForeground": t("text-secondary"),

        /* Charts */
        "charts.foreground": t("text-body"),
        "charts.lines": t("border-hover"),
        "charts.red": t("status-danger"),
        "charts.blue": t("accent"),
        "charts.yellow": t("status-warning"),
        "charts.orange": t("status-warning-text"),
        "charts.green": t("status-success"),
        "charts.purple": t("badge-experimental"),
    };

    /* Syntax is §3.7's role mapping. The three syntax hues carry the roles a
       single accent cannot separate — a type, a string and a number are all
       "not a keyword", and painting them one colour is what flattens code.
       Defined names stay bold text-heading: weight says "declared here", and it
       is now unambiguous because types have left that colour for teal. */
    const tokenColors = [
        { scope: ["comment", "punctuation.definition.comment"],
            settings: { foreground: t("text-tertiary"), fontStyle: "italic" } },
        { scope: ["string", "punctuation.definition.string"],
            settings: { foreground: t("syntax-string") } },
        { scope: ["constant.numeric", "constant.language", "constant.character", "constant.other", "support.constant", "variable.other.enummember"],
            settings: { foreground: t("syntax-number") } },
        { scope: ["constant.character.escape"],
            settings: { foreground: t("syntax-number"), fontStyle: "bold" } },
        { scope: ["keyword", "storage", "storage.type", "storage.modifier"],
            settings: { foreground: t("accent") } },
        { scope: ["keyword.operator", "punctuation", "meta.brace"],
            settings: { foreground: t("text-secondary") } },
        { scope: ["entity.name.function", "support.function", "meta.function-call.generic"],
            settings: { foreground: t("text-heading"), fontStyle: "bold" } },
        { scope: ["entity.name.type", "entity.name.class", "entity.name.struct", "entity.name.enum", "entity.name.interface", "entity.name.namespace", "support.class", "support.type", "entity.other.inherited-class"],
            settings: { foreground: t("syntax-type") } },
        { scope: ["support.type.property-name"],
            settings: { foreground: t("text-body"), fontStyle: "" } },
        { scope: ["support.type.property-name.json"],
            settings: { foreground: t("accent"), fontStyle: "" } },
        { scope: ["variable", "variable.parameter", "variable.other"],
            settings: { foreground: t("text-body") } },
        { scope: ["variable.language"],
            settings: { foreground: t("accent") } },
        { scope: ["entity.name.tag"],
            settings: { foreground: t("accent") } },
        { scope: ["punctuation.definition.tag"],
            settings: { foreground: t("text-secondary") } },
        { scope: ["entity.other.attribute-name"],
            settings: { foreground: t("text-secondary"), fontStyle: "italic" } },
        { scope: ["entity.other.attribute-name.class.css", "entity.other.attribute-name.id.css"],
            settings: { foreground: t("text-heading"), fontStyle: "bold" } },
        { scope: ["entity.name.function.decorator", "meta.decorator", "punctuation.decorator"],
            settings: { foreground: t("accent"), fontStyle: "italic" } },
        { scope: ["markup.heading", "entity.name.section.markdown"],
            settings: { foreground: t("text-heading"), fontStyle: "bold" } },
        { scope: ["markup.bold"],
            settings: { fontStyle: "bold" } },
        { scope: ["markup.italic"],
            settings: { fontStyle: "italic" } },
        { scope: ["markup.underline.link", "string.other.link"],
            settings: { foreground: t("accent") } },
        { scope: ["markup.quote"],
            settings: { foreground: t("text-secondary"), fontStyle: "italic" } },
        { scope: ["markup.inline.raw", "markup.fenced_code.block"],
            settings: { foreground: t("text-secondary") } },
        { scope: ["markup.inserted"],
            settings: { foreground: t("status-success") } },
        { scope: ["markup.deleted"],
            settings: { foreground: t("status-danger") } },
        { scope: ["markup.changed"],
            settings: { foreground: t("accent") } },
        { scope: ["invalid", "invalid.illegal"],
            settings: { foreground: t("status-danger") } },
        { scope: ["invalid.deprecated"],
            settings: { foreground: t("status-warning-text") } },
        { scope: ["token.info-token"],
            settings: { foreground: t("accent") } },
        { scope: ["token.warn-token"],
            settings: { foreground: t("status-warning-text") } },
        { scope: ["token.error-token"],
            settings: { foreground: t("status-danger") } },
        { scope: ["token.debug-token"],
            settings: { foreground: t("syntax-type") } },
    ];

    const bold = (name) => ({ foreground: t(name), bold: true });
    const semanticTokenColors = {
        "namespace": t("syntax-type"),
        "class": t("syntax-type"),
        "interface": t("syntax-type"),
        "enum": t("syntax-type"),
        "struct": t("syntax-type"),
        "type": t("syntax-type"),
        "typeParameter": t("syntax-type"),
        "function": bold("text-heading"),
        "method": bold("text-heading"),
        "macro": t("accent"),
        "keyword": t("accent"),
        "comment": { foreground: t("text-tertiary"), italic: true },
        "string": t("syntax-string"),
        "number": t("syntax-number"),
        "regexp": t("syntax-string"),
        "enumMember": t("syntax-number"),
        "variable": t("text-body"),
        "parameter": t("text-body"),
        "property": t("text-body"),
        "decorator": { foreground: t("accent"), italic: true },
    };

    return {
        name: dark ? "Halon Dark" : "Halon Light",
        type: scheme,
        semanticHighlighting: true,
        colors,
        tokenColors,
        semanticTokenColors,
    };
}

/* ---------- write or check ---------- */

let stale = false;
for (const scheme of ["light", "dark"]) {
    const outPath = join(root, `vscode/themes/halon-${scheme}-color-theme.json`);
    const banner =
        `// GENERATED FILE — do not edit.\n` +
        `// Built from gtk/Halon/shared/_tokens-${scheme}.css by scripts/build-vscode.mjs.\n` +
        `// Edit the mapping there, then rebuild.\n`;
    const out = banner + JSON.stringify(theme(scheme), null, 4) + "\n";

    if (check) {
        if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== out) {
            console.error(`${outPath} is stale — run: node scripts/build-vscode.mjs`);
            stale = true;
        } else {
            console.log(`${scheme}: halon-${scheme}-color-theme.json is up to date.`);
        }
        continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, out);
    console.log(`Wrote ${outPath}`);
}
if (stale) process.exit(1);
