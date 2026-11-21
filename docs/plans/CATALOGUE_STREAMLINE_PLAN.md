# Catalogue (register preset grid) streamline plan

Scope: the register's "Katalog položek" panel: `QuickPresetGrid.jsx` header, `CategoryFilterBar.jsx`, `PresetTileCard.jsx`, and the matching blocks in `register.css`. The Katalog tab (`PresetsCatalogView`) is out of scope.

## Audit (measured at 1366x768, standard density, seed data of 19 items)

### A. Uneven tiles
1. Row heights differ: tiles without a price are 72 px tall, tiles with a price chip are 86 px (rows 1, 2 and 4 are 72/86/86/72 px). The chip is only rendered when the item has a fixed price, so the row jumps by the chip height. Open-price items are the ones affected.
2. Tile height comes from `min-height` plus content, not from a fixed row height. Any 3-line name or stock badge also grows its row.
3. Stock badge sits inside `.preset-card-header` next to the name, so it narrows the name and adds a line. The tile plan already says "top-right"; the code still flows it inline.
4. Name clamps to 3 lines in a 72 px tile; two-line names with a chip already fill the tile. Names wrap mid-word at 130 px ("Houbičky na nádobí 3 ks" takes 3 lines).
5. Three separate media-query blocks set `min-height` for the same tiles (60/72/84/88/105), so the same tile differs by window height.

### B. Overcrowded header
1. Header holds up to 7 controls in one nowrap row: multiplier chip, Vlastní položka, Přidat, Upravit/Hotovo, Kontrola ceny, Kategorie (admin), search. Content is 907 px in an 888 px box: the search field is clipped and a horizontal scrollbar appears under the grid.
2. The title wraps to two lines ("Katalog / položek") because the row has no room.
3. Edit mode adds duplicates: "Hotovo" in the header and in the edit bar; "Správa kategorií" as a chip in the category bar, as a button in the edit bar, and as the admin header button; plus hint text and trash zone. Five elements say the same two things.
4. Add and Edit are setup tasks the cashier does not use during a sale. They share the row with sale actions (Vlastní položka, Kontrola ceny).
5. About 100 lines of inline style in the header repeat the same height, padding and font values on every button; they do not follow the `.nav-tab` or density rules.
6. Hard-coded Czech strings bypass i18n: "Hotovo", "Aktivní násobič množství", "Zapnout/Vypnout režim úprav…", "Kontrola ceny / Cenovka (F2)", "Kliknutím upravíte • Přetažením změníte pořadí". VI and EN users see Czech.
7. The "(19)" count shows next to the title always, but only matters while searching or filtering.

### C. Category bar and grid chrome
1. Chips are 44 px tall pills that wrap onto several lines; 8 categories take about 2 rows and push tiles down. Empty `.category-scroll-btn` / `.scroll-btn-right` rules show a scroller was planned and abandoned.
2. A gradient separator line sits between the chips and tiles in addition to spacing.
3. Edit mode puts a dashed outline and a pencil icon on every tile; with the multiplier on, every tile also gets an amber glow and a `×N` badge. At 19 tiles this is noise; the header chip already shows the multiplier.
4. Dead CSS: `.category-scroll-btn` (the `.preset-corner-icon svg` rules still size the edit-mode pencil).

## Decisions to confirm

1. Multiplier: keep the header chip, drop the per-tile `×N` badge and amber glow. (Recommended; the keypad also shows it.)
2. Open-price tiles: show a dashed empty price slot so the row stays even and the tile signals "enter price". Alternative: reserve the space and show nothing.
3. Category chips: single scrolling row (40 px) instead of wrapping. Alternative: keep wrap but cap at 2 rows with a "more" chip.

## Target layout

Header, one row, 44 px, never wraps or clips:
`[Katalog položek]  [search ............]  [Vlastní položka]  [price-check icon]  [edit icon]`
- Title on one line, count only while search or a category filter is active.
- Search takes the remaining width.
- Vlastní položka stays labelled (the only entry to the custom-item modal; core sale action).
- Kontrola ceny becomes icon-only with title and the F2 hint; keeps its active highlight.
- Upravit becomes icon-only toggle; active state shows amber.
- Přidat, Správa kategorií and the admin Kategorie button leave the header. They live only in the edit bar.

Edit bar (visible in edit mode only): hint, `+ Přidat položku`, `Správa kategorií`, trash zone, `Hotovo`. The header edit icon stays as the toggle; the extra category chip is removed.

Tiles: fixed row height per density (`grid-auto-rows`), name clamps to 2 lines (3 on large), price slot always reserved, stock badge absolute top-right, one set of heights shared by all media queries via CSS variables.

## Phases

### Phase 1 — tiles (CSS + `PresetTileCard.jsx`)
- `grid-auto-rows` per density; heights as variables (`--tile-h`), remove the repeated min-height overrides in the 1600x900 block.
- Always render the price slot; dashed chip for open price (decision 2).
- Stock badge absolute top-right (hidden in edit mode); name clamp 2 lines. Fixed rows apply only to the register grid (density class); the Katalog tab grid and modal preview keep min-height 88px.
- Drop per-tile multiplier badge and glow (decision 1). (`.preset-corner-icon svg` rules are not dead: they size the edit-mode pencil. Keep.)
- Verify: all tiles in a density share one height at compact/standard/large, light and dark; `PresetTileCard.test.jsx` updated.

### Phase 2 — header (`QuickPresetGrid.jsx`, `register.css`, `translations.js`)
- Replace inline styles with `.catalog-action` classes; icon-only price check and edit; move Přidat and Kategorie into the edit bar; remove duplicate Hotovo and the category chip.
- Title nowrap; count only when filtering.
- Add i18n keys (CZ, VI, EN) for the hard-coded strings; keep `translation_keys.test.js` green.
- Verify: no horizontal overflow at 1024, 1280, 1366 and 1600 wide; header height constant; edit mode shows each action once.

### Phase 3 — category bar (`CategoryFilterBar.jsx`, `register.css`)
- Single-row horizontal scroll, 40 px chips, fade edge; remove separator and the dead scroll-button rules (decision 3).
- Verify: 12 categories do not push tiles down; drag-reorder in edit mode still works.

### Phase 4 — tests and review
- Add cases: header has no duplicate controls in edit mode, price slot present for open-price items, no header overflow (`scrollWidth <= clientWidth`) in jsdom where measurable, i18n keys present.
- Gates: `npm run test`, `npm run lint`, `npm run build`, then `/code-review` medium.

## Out of scope

Sorting, frequent-items row, long-press edit, Katalog tab table view, tile style variants.

## Risks

- `PresetTileCard` is shared with the `PresetModal` preview; check it after phase 1.
- `open_price_modal.test.jsx` and `PresetTileCard.test.jsx` query the header buttons and the multiplier badge; expect edits.
- Cart footer height gotcha: this change does not touch `.cart-footer`.
