/* The single source of truth for indicator glyph geometry.
 *
 * GTK consumes glyph-only SVGs (the box is CSS); St renders whole-control
 * SVGs (box and glyph in one image). Both compose from these shapes, so a
 * checkmark is the same curve everywhere — the demo, GTK, and the shell.
 */

export const GLYPH_SIZE = 14;

export const GLYPH = {
    check: 'M3.5 7.5 L6 10 L10.5 4.5',
    dash: 'M4 7 H10',
    dotRadius: 2.8,
    strokeWidth: 1.8,
};

export const svg = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

const stroked = (d, colour) =>
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${GLYPH.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* Glyph alone, for GTK's -gtk-icon-source. */
export const glyphSvg = {
    check: (colour) => svg(GLYPH_SIZE, GLYPH_SIZE, stroked(GLYPH.check, colour)),
    dash: (colour) => svg(GLYPH_SIZE, GLYPH_SIZE, stroked(GLYPH.dash, colour)),
    dot: (colour) => svg(GLYPH_SIZE, GLYPH_SIZE,
        `<circle cx="7" cy="7" r="${GLYPH.dotRadius}" fill="${colour}"/>`),
};

/* Whole control, for St: a 16px box with the 14px glyph centred inside. */
export const boxedSvg = {
    check: (fill, glyph) => svg(16, 16,
        `<rect x="1" y="1" width="14" height="14" rx="4" fill="${fill}"/>` +
        `<g transform="translate(1,1)">${stroked(GLYPH.check, glyph)}</g>`),
    checkOff: (fill, border) => svg(16, 16,
        `<rect x="1.5" y="1.5" width="13" height="13" rx="4" fill="${fill}" stroke="${border}"/>`),
    radio: (fill, glyph) => svg(16, 16,
        `<circle cx="8" cy="8" r="6.5" fill="${fill}"/>` +
        `<circle cx="8" cy="8" r="${GLYPH.dotRadius}" fill="${glyph}"/>`),
    radioOff: (fill, border) => svg(16, 16,
        `<circle cx="8" cy="8" r="6" fill="${fill}" stroke="${border}"/>`),
};
