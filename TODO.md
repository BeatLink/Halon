# TODO

- [ ] Review the X-Monitor mockups in `mockups/x-monitor/` for ideas to fold into
  `THEME-DESIGN-GUIDE.md`. The guide covers progress bars and meters but says nothing yet about
  charts or status marks beyond a badge. Candidates:
  - Data series colors: a small set told apart by lightness as well as hue, the first being the
    accent (X-Monitor added `--series-1` to `--series-3`).
  - Gauges: a round-capped arc at a meter's 6px thickness, beside the value rather than around it.
  - Uptime strips: one rounded cell per check, with the up share printed beside the row.
  - Share bars: one bar split into parts, each part's value printed in a legend beneath.
  - Status tiles: a dot, a name and a caption, the border and ground tinted by the state.
  - A card in warning or failed taking a hint of that state on its border and ground, while a
    healthy card stays plain.
  - Equal-height cards in a row, with the label at the top and the value centred below it.
