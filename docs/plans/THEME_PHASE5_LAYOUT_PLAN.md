# Theme Phase 5: Layout

Source: `docs/audit/THEME_DESIGN_AUDIT.md` (L1, L2, L3, L5, L6, CD1). Builds on phase 4 (`3efa92e`). First phase that changes JSX, so it is split into small steps with a test run after each.

## Changes

1. **Top bar (L1).** `Navbar.jsx` (473 lines), `layout.css`.
   - Keep: status pill, 6 tabs, clock, open drawer, print daily summary, lock, power, text size (the one tool an older cashier may need at the till).
   - Move to Settings > Layout: theme toggle and sound toggle. Add two switches in `LayoutSection.jsx` using the existing `theme` and `soundEnabled` state and setters already passed to `Navbar` (props reused, no new state).
   - Language selector stays in the bar (one control).
   - Add visible text labels under or beside the three tool icons that stay unlabelled: none added, instead keep `title` and `aria-label` as is. Labels on tabs already exist.
2. **Settings sidebar (L2).** `settings.css`, `SettingsView.jsx`. Width 250 px to 280 px, `white-space: normal` with two-line wrap instead of clipping, hide the grey `.settings-sidebar-desc` subtitle under each item (keep it as `title` tooltip). Labels unchanged.
3. **Catalog cards (L3).** `register.css` `.preset-grid` min column 130 px to 160 px (fewer, larger cards). Remove the VAT percentage from the card face (`PresetTileCard.jsx` and its three style variants); VAT stays in the item editor and cart line. Name wraps to two lines, price on its own line, no tax text competing.
4. **Icons (L5).** Remove decorative icons from labelled text controls that add nothing: category-bar "Všechny položky" chip icon, section headings in settings. Keep icons on payment, delete, print, drawer, lock. Limit: only where an icon sits next to a text label in a heading or chip; list the files in the commit message. Skip if it needs more than 10 files.
5. **Cash panel coins (L6).** `CashPaymentPanel.jsx`, `modals.css`. Replace `coin-disc` coloured discs with plain text chips (`+5 Kč`, `+10 Kč`, `+20 Kč`, `+50 Kč`), same size as banknote buttons, neutral style. Remove `.coin-disc*` rules.
6. **Customer display (CD1).** `customer-display.css`, `CustomerDisplayView.jsx` (own 16 px root, so it did not get phases 2 to 4 type changes). Flat `#0f172a` background (already flat from phase 2), no card shadows, weights 700 max, no uppercase, size floor 0.8 rem, same colour rules as phase 3: neutral total, green only for "paid". Keep a plain large price and store name.

## Not changed

Navigation structure and tab order. Routes. Settings content. Receipt styles. Border radius (E6): still undecided; if you want it, pick two values (6 px controls, 12 px cards) and it becomes a one-token change plus a grep for literal radii. Say so and I add it as step 7.

## Verify

- `npm run test`, `npm run lint`, `npm run build` after steps 1, 3 and 5. Tests that look up the theme, sound or price-tile VAT text are updated only where they fail; if a test asserts VAT on the card, I change the test to match the new design.
- Visual at 1366x768 and 1280x720, light and dark: top bar does not wrap, settings sidebar labels fully readable, catalog shows 4 to 5 columns, cash modal, customer display (`/?display`).
- `/code-review` at medium effort before commit.

## Risk

Medium. Moving theme and sound out of the top bar is a behaviour change for people who use them; they stay one click away in Settings. Larger catalog cards reduce items visible without scrolling (about 20 percent fewer); check the 13-item demo grid and a large catalog. Customer display is a separate Tauri window: only the browser view is checked.

## Open questions (defaults chosen)

1. Keep text size in the top bar (chosen) versus moving it to Settings too.
2. Larger cards 160 px (chosen) versus 150 px.
3. Border radius pair: do it now or skip.
