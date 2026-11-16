# Batch E plan: layout and touch ergonomics (F-018, F-020, F-007, F-031, F-032)

Status: waiting for approval. No code changed yet.

## 1. Goal

On the real counter screen (touch PC at 1366x768 or 1920x1080) every main control is easy to hit with a finger, the cart and the navbar read clearly, and no screen is clipped. The phone and tablet layouts are removed rather than repaired.

## 2. Decisions (taken)

- **Supported devices: touch PC only.** The owner's phone use goes to the cloud `web/` dashboard. This means the half-built mobile mode is deleted instead of finished (F-018 option "mobile not supported").
- **Default text size: Large (L)**, using the existing A+ cycle. The cashier can still change it.

## 3. Facts (checked in code)

- Mobile mode lives in `App.jsx` (`isMobile`, `mobilePosTab`, the `mobile-hidden` class names on three columns, the `mobile-pos-tabs` bar, about 9 places), in `layout.css` (the `max-width: 768px` block with `.mobile-hidden` rules, other media queries at 580, 1050, 1100, 1240, 1300 px) and in the navbar (hamburger and drawer for screens under 900 px, with `drawer-nav-btn` buttons). `.mobile-pos-tab` has no CSS at all (F-018).
- `index.html` viewport meta has `maximum-scale=1, user-scalable=no`.
- `StoreConfigContext.jsx` already derives `fontSize` (default M) and `cycleFontSize`.
- Measured at 1366x768 (F-020, F-007): navbar tabs 34 px high, 26 controls under 40 px on Historie, language selector 32 px, clock and status text 8.7 to 10.4 px, cart title collapses to "N", weighed item price wraps.
- F-031: the stock intake modal table is 898 px in an 813 px modal. F-032: the write-off product select is about 50 px wide and a red tax notice shows before any item is chosen.
- The navbar reachability test I added clicks `.drawer-nav-btn` buttons; if the drawer goes, that test must only check the desktop bar.

## 4. Phases

**Phase 1: tests first.**
- A CSS guard test that reads `tokens.css` and `layout.css` and checks: `button` has a touch minimum height of 44 px, `.nav-tab` is 48 px, no `font-size` below 12 px in the navbar and status chips. (jsdom does not lay out, so the test reads the stylesheet text.)
- A source guard that fails while `isMobile`, `mobilePosTab`, `mobile-pos-tab` or `mobile-hidden` exist.
- Default font size test: with no saved config the font size is `lg`.
- Intake modal: table sits in a horizontally scrollable wrapper or fits (checked by class or style in the source); write-off select has a minimum width; the tax notice is hidden until an item is chosen (render test).
- Gate: tests red for the right reasons.

**Phase 2: remove the mobile and tablet code.**
- Delete the `isMobile` state, the tab bar, the `mobile-hidden` class use, the mobile CSS block, and the hamburger drawer markup and CSS; keep the status badges in the navbar. Restore zoom in the viewport meta (`user-scalable` allowed) for low-vision users.
- Update the reachability test to the desktop bar only.
- Gates, `/code-review` at `medium`, live check at 1366x768 and 1920x1080.

**Phase 3: touch sizes and default text size.**
- `tokens.css`: `min-height: 44px` for buttons and inputs on the touch screen, tab height 48 px, text floor 12 px; default font size `lg`.
- Navbar: group the secondary icon buttons (theme, font size, sound, print daily summary, lock) into labelled controls or a "Více" menu so the first screen does not show eight unlabelled icons (F-007).
- Cart column minimum width so the title and count badge do not collapse; weighed item price on one line (F-007).
- Gates, live check at 1366x768 including the Historie tab, Katalog and Sklad (the controls under 40 px listed in F-020).

**Phase 4: modal fixes (F-031, F-032).**
- Intake modal: table scrolls horizontally or columns narrow; write-off select wider; tax notice only after an item is chosen.
- Gates, live check, review, records.

Each phase commits separately.

## 5. Risks

- Raising every button to 44 px can push content off screen at 1366x768. The live check at that size is the real test; the font size and sizes can be tuned after it.
- Large default text reduces what fits. If it is too much at 1366x768, fall back to M for that resolution only.
- Removing the drawer removes the way to reach the status badges below 900 px; with touch PC only that is accepted.
- Real finger accuracy cannot be judged in the browser pane. The audit plan calls for a 15-minute test with the real cashier on the real screen; final sizes should come from it.

## 6. Out of scope

Phone and tablet support, the cloud `web/` dashboard, inline style and hex color enforcement, remaining Czech text, security batch.

## 7. Phase 1 result

Added `src/__tests__/touch_layout.test.jsx` with 9 tests. All 9 are red for the intended reasons:
- No `--touch-min: 44px` token and no touch minimum on `button`.
- `.nav-tab` is 40 px high, not 48.
- Five navbar or status rules use text below 12 px (for example `.nav-font-size-badge` at 0.6rem).
- `App.jsx` still has the mobile mode (`isMobile`, `mobilePosTab`, `mobile-pos-tab`, `mobile-hidden`).
- The viewport meta still blocks zoom.
- The default font size is `md`, not `lg`.
- Intake modal table wrapper has no horizontal scroll; the write-off product select has no `minWidth`; the "Režim" notice shows with no item chosen.

Note for later phases: Vitest turns CSS imports into empty strings, so the CSS guards read the stylesheets from disk with `readFileSync` (a first version using `?raw` passed vacuously and was fixed). The reachability test from Batch D still clicks drawer buttons; Phase 2 narrows it to the desktop bar.

## 8. Phase 2 result

- `App.jsx`: removed `isMobile`, `mobilePosTab`, the media-query listener, the `mobile-hidden` class use on the three columns and the whole `mobile-pos-tabs` bar.
- `Navbar.jsx`: removed the hamburger button, the slide-in drawer with its second copy of the tab buttons and the technician banner, the drawer state and handler, and the unused `Menu` and `X` imports. The status badges and quick tools stay in the navbar.
- `layout.css`: removed the 768 px mobile block, the 1050 px drawer block and the hamburger and drawer-technician rules (about 350 lines removed in total). The 1240, 1300 and 1100 px desktop compaction rules stay.
- `index.html`: the viewport meta no longer blocks zoom.
- `navbar_reachability.test.jsx`: now checks the desktop bar only.
- Gates: lint clean, build OK. 395 of 402 frontend tests pass; the 2 mobile guards from Phase 1 are now green and the 7 still red are the Phase 3 and 4 tests (touch sizes, default text size, intake and write-off modals). The 213 backend tests were not touched by this phase and were not rerun. `/code-review` at `medium`: no findings.
- Live check at 1366x768: the register screen renders with the six tabs and the status chips in one row and no hamburger button. Not checked: 1920x1080, other tabs after the CSS removal beyond the register screen.

## 9. Phase 3 result

- `tokens.css`: new `--touch-min: 44px`; buttons, text inputs and selects get `min-height: var(--touch-min)`.
- `layout.css`: navbar tabs are 48 px (44 px in the slim style). The 1600x900 compact block, which is the one that applies at 1366x768 and was the real source of the 34 px tabs, now keeps tabs at 48 px, tool buttons and the clock chip at 44 px, and the islands tall enough for them; tab padding and the right island gap are tighter so everything still fits. The five navbar and status rules under 12 px now use 12 px.
- `register.css`, `settings.css`, `InventoryStockTable.jsx`: category chips, segmented buttons and the three Sklad filter pills raised to 44 px.
- Default text size is Large: `DEFAULT_STORE_CONFIG.fontSize` and the fallbacks are `lg`. Stores that already saved a size keep it. The `App.test.jsx` font cycling test now starts at L.
- Measured live at 1366x768 after the change: remaining controls under 44 px on the register, Katalog, Sklad, Historie, Analytika and Nastavení tabs went from dozens to none on Historie and Analytika, and to the items fixed above elsewhere; the page no longer scrolls sideways.
- Gates: 399 of 402 frontend tests pass (the 3 red are the Phase 4 modal tests), lint clean, build OK. `/code-review` at `medium`: one plausible finding, below.
- Open: the navbar content is still about 5 px wider than its container at 1366x768 (no page scroll; the power button touches the edge). The audit's idea of grouping the secondary tools (theme, font size, sound) into one menu would free about 130 px and is not done. Small inputs inside other modals (for example the keypad label field) were not individually measured. Real finger accuracy still needs the 15-minute test with the cashier.

## 10. Phase 4 result

- `StockIntakeModal.jsx`: the item table container scrolls sideways (`overflowX: auto`) and the table has a 760 px minimum width, so the new-price column and the delete button are reachable. Live: the table is 887 px in an 809 px container and scrolls.
- `StockWriteOffModal.jsx`: the product select has a 220 px minimum width (was about 50 to 160 px). The "Režim: ..." tax notice shows only once a product is chosen.
- Gates: 402 of 402 frontend tests pass (all of `touch_layout.test.jsx` is green), lint clean, build OK, 213 backend tests pass. `/code-review` at `medium`: no findings.
- Live check on the Vite dev server confirmed the three changes above. Not checked: submitting an intake or write-off after the change (the logic is untouched), touch use.

## 11. Batch E status

Done: F-018 (phone and tablet mode removed, zoom allowed), F-020 (44 px minimum, 48 px tabs, 12 px text floor), F-007 (Large default, compact navbar sizes), F-031, F-032. Open: the navbar is still about 5 px wider than its container at 1366x768 (grouping theme, font size and sound into one menu would fix it); small inputs inside other modals were not individually measured; the 15-minute test with the real cashier on the real screen has not been done and should set the final sizes.
