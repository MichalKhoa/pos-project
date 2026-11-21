# Catalogue tile redesign plan

Scope: register preset tiles only (`PresetTileCard`, `register.css`, tile style setting). No catalogue table view, no modal changes except what the shared card forces.

## Goals

- Price never wraps; name gets full tile width.
- Icon becomes a background watermark instead of an 18px corner icon.
- Category colour tints the whole tile instead of a 4.5px left stripe.
- VAT hidden by default.
- Four style variants reduced to two.

## Decisions

1. Styles: `tinted` (new default) and `color-fill` (kept). Legacy stored values (`left-stripe`, `modern-card`, `modern-glass`) normalise to `tinted` on the frontend. No DB migration; the backend column keeps free text.
2. Watermark: Lucide icon from `getPresetIconComponent`, ~72px, bottom-right, rotate -10deg, opacity 0.16 (cap 0.12 on `color-fill`), `pointer-events: none`, clipped by `overflow: hidden` already on `.preset-card`.
3. No icon and no photo: first letter of the name as watermark.
4. Photo (`imageUrl`): photo fills the tile, dark scrim under the text, white text. No watermark.
5. Price: bottom-left chip, `white-space: nowrap`, `font-variant-numeric: tabular-nums`. Open-price items show no chip.
6. Stock badge moves to top-right. Out-of-stock tile dims to 50% opacity.
7. Name: up to 3 lines, `hyphens: auto` (`lang` already set), no ellipsis on 2 lines.
8. Keep `×N` multiplier badge, edit-mode outline, drag states, density classes.
9. Default of `showPresetVat` stays false in `initialData.js`. Backend `config.py:144` returns `True` when the column is null; fix to `False` so both agree (one line).

## Phases

### Phase 1 — card markup and tinted style
Files: `src/components/presets/PresetTileCard.jsx`, `src/styles/register.css` (`.preset-card*` blocks, density blocks, mobile block near line 2385).
- Replace corner icon with watermark element; move price to chip; stock badge top-right.
- Delete `left-stripe`, `modern-card`, `modern-glass` CSS; add `tinted`.
- Style normalisation helper (one function, used by card, `QuickPresetGrid`, `PresetsCatalogView`).
- Verify: `npm run test`, `npm run lint`, browser check at compact, standard, large density, light and dark theme.

### Phase 2 — color-fill, photo, fallbacks
Files: same as phase 1.
- `color-fill` watermark and contrast; photo tile with scrim; letter fallback.
- Contrast guard: if `--card-accent` is very light, force dark text (small luminance helper, unit tested).
- Verify: unit test for helper; visual check with white, yellow, black and red accents.

### Phase 3 — settings and defaults
Files: `src/components/settings/LayoutSection.jsx`, `src/data/initialData.js`, `backend/routers/config.py`, i18n strings (CZ, VI, EN).
- Settings control shows two options; selected state follows normalised value.
- `initialData.js` default `tinted`; backend default for `showPresetVat` set to false.
- Verify: backend tests, settings UI check, saved legacy value shows `tinted`.

### Phase 4 — tests and review
Files: `src/__tests__/PresetTileCard.test.jsx` (+ new cases).
- Cases: watermark rendered with icon, letter fallback, photo tile, price chip hidden for open price, legacy style normalisation, stock badge position class.
- Run full quality gates, then `/code-review` (medium).

## Out of scope

Frequent-items row, long-press edit, sorting, catalogue table view.

## Risks

- `PresetTileCard` is shared with `PresetModal` preview; check it after phase 1.
- `PresetsCatalogView.jsx:247` builds its own `style-*` class; it must use the same normaliser or it loses styling.
- Custom `--card-accent` colours chosen by the owner may have poor contrast; phase 2 guard covers it.
