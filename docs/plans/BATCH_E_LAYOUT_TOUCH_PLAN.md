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
