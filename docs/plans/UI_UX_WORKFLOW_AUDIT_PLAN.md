# VoltFlow POS — Workflow, UI and UX Audit Plan

Status: DRAFT, awaiting approval. No code changes are part of this plan; the audit produces findings only. Fixes get their own plan afterwards.

## 1. Goal

Find friction, errors and inconsistencies in how a cashier and an owner use the POS, so that the common counter task (scan, total, pay, hand over receipt) is fast, hard to get wrong, and usable on a touchscreen in a busy večerka.

Target users:
- **Cashier** (parents, non-technical, touchscreen, queue pressure, often one-handed or with items in the other hand).
- **Owner/admin** (settings, stock, reports, Z-report, EET, backups).
- **Customer** (customer-facing display window).

## 2. Scope

In scope (screens and components found in `src/`):

| Area | Main files |
| --- | --- |
| Shell, navigation, lock | `App.jsx`, `Navbar.jsx`, `LockScreenModal.jsx`, `AdminPinModal.jsx`, `ShutdownModal.jsx`, `useAutoLock.js` |
| Register / sale | `QuickPresetGrid.jsx`, `ManualKeypad.jsx`, `keypad/*`, `Cart.jsx`, `cart/CartItemInspector.jsx`, `CustomItemModal.jsx`, `DiscountModal.jsx`, `presets/*`, `PriceCheckModal.jsx`, `UnknownBarcodeModal.jsx`, `ParkedCartsDrawer.jsx` |
| Payment | `PaymentModal.jsx`, `payment/*` (cash, card, QR, split), `CheckoutFlashBanner.jsx` |
| Receipt | `ReceiptModal.jsx`, `receipt/*`, `receiptHtmlGenerator.js` |
| Returns and refunds | `RefundModal.jsx`, receipt-scan return flow |
| Cash and shift | `cash/CashDrawerMovementModal.jsx`, `cash/ZReportModal.jsx`, `ShiftStatsWidget.jsx` |
| Inventory | `InventoryView.jsx`, `inventory/*` |
| History and analytics | `SalesHistoryView.jsx`, `history/*`, `AnalyticsView.jsx`, date pickers |
| Catalog admin | `PresetsCatalogView.jsx`, `PresetModal.jsx`, `CategoryManagerModal.jsx` |
| Settings | `SettingsView.jsx`, `settings/*` |
| Offline and sync | `useOfflineSync.js`, `PendingSyncModal.jsx`, `SyncNotificationBanner.jsx`, `ToastUndo.jsx` |
| Customer display | `CustomerDisplayView.jsx`, `styles/customer-display.css` |
| i18n | `i18n/translations.js` (CZ, VI, EN) |
| Styling system | `styles/*.css`, `tokens.css` |

Out of scope: backend logic correctness, EET crypto, ČSOB protocol details, the `web/` cloud dashboard (separate audit later), installer and update scripts. Backend is touched only where a UX symptom depends on it (error messages, latency, hardware failure handling).

## 3. Method

1. **Task-based walkthroughs.** Run each workflow in section 4 end to end in the app, with a stopwatch for tap count and time, on a touch-sized viewport. Record every hesitation, dead end or error.
2. **Heuristic evaluation.** Score every screen against Nielsen's 10 heuristics plus POS-specific rules: minimum 48 px touch targets, no hover-only actions, no tiny text at arm's length, confirmation for destructive actions, always-visible total.
3. **Failure-path testing.** Break things on purpose: printer offline, card terminal timeout, backend down, wrong PIN, scanner unknown barcode, stock 0, double tap on Pay, cancel mid-payment.
4. **Static checks.** Grep and tooling for accessibility and consistency issues: ARIA and label coverage (only about 41 `aria-`/`role=` hits across components at survey time), `@media` usage versus the touch layout, hard-coded colors outside `tokens.css`, hard-coded strings outside `translations.js`, missing keys between CZ, VI and EN.
5. **Visual consistency review.** Screenshots of every screen at 1920x1080, 1366x768, 1024x768 (tablet) and 375x812 (mobile mode, `isMobile` breakpoint at 768 px), light and dark if supported.
6. **Existing test coverage map.** Check which workflows have Vitest coverage (`src/__tests__/`) and which have none, so the later fix plan knows where to add regression tests.

Tools: built-in browser pane with `npm run dev`, `resize_window` presets, screenshots, `read_console_messages` for runtime errors, Vitest and Oxlint for the static baseline. Real hardware checks (receipt printer, drawer pulse, ČSOB terminal, customer LCD, barcode scanner) need the physical store setup and are listed as manual steps in section 7.

## 4. Workflows to audit

Each gets a flow map (steps, taps, decision points, error exits) and a pass/fail against the criteria listed.

| # | Workflow | Key questions |
| --- | --- | --- |
| W1 | Start of day: launch, unlock, open shift, opening cash | Is shift open forced or forgotten? Is lock screen fast? |
| W2 | Scan barcode sale, cash payment, receipt | Taps from scan to done? Change shown large? Auto-focus on scanner kept after every modal? |
| W3 | Preset tile sale (no barcode), quantity change, weight item | Tile size, category switch, long-name truncation, weight modal keypad |
| W4 | Manual keypad and custom item (open price, VAT choice) | Wrong-VAT risk, error recovery, backspace hold |
| W5 | Card payment (ČSOB terminal), timeout, decline, manual fallback | Status clarity, can cashier cancel safely, no double charge |
| W6 | QR payment with email verification | Waiting state clarity, timeout, fallback to cash |
| W7 | Split payment | Remaining amount clarity, mixed methods, undo |
| W8 | Discounts (line and cart) | Discoverability, percent vs amount, reason capture, permission |
| W9 | Park cart and resume | Visibility of parked count, accidental loss |
| W10 | Price check mode (F2) | Does it leave cart untouched? Exit path clear? |
| W11 | Last receipt reprint and storno | Reachability, confirmation, wrong-receipt risk |
| W12 | Refund and receipt-scan return (line-item) | Quantity cap clarity, cash vs card refund, stock effect shown |
| W13 | Cash drawer movement (pay-in, pay-out) | Reason required? Audit trail visible? |
| W14 | End of day: Z-report, shift close, cash count, shutdown | Count helper, discrepancy display, can it be closed twice |
| W15 | Stock intake, write-off, physical inventory, CSV import, barcode labels | Bulk entry speed, mistakes recoverable, supplier price history |
| W16 | Catalog admin: add/edit/reorder presets, categories, drag and drop | Touch drag usability, color and icon pickers, delete confirmation |
| W17 | Sales history, filters, date ranges, receipt inspector, analytics | Period selection speed on touch, empty states, export |
| W18 | Settings: store profile, printer, terminal, receipt, layout, security, backup, diagnostics | Grouping, test-print feedback, dangerous settings guarded by admin PIN |
| W19 | Offline and sync: backend down, pending sync, recovery | Does the cashier know sale is queued? Banner noise? |
| W20 | Language switch CZ, VI, EN | Layout breaks on long strings, untranslated text |
| W21 | Customer display | Readability at distance, idle state, language, in-sync with cart |
| W22 | Technician session and admin PIN | Lockout, PIN entry ergonomics, timeouts |

W2, W5, W11 and W14 are the highest-traffic or highest-risk and are audited first.

## 5. Evaluation criteria and severity

Per finding record: workflow ID, screen/component with file path, observed behavior, why it matters, evidence (screenshot or step list), suggested direction, severity.

Severity scale:
- **S1 Blocker**: money or data loss risk, sale cannot complete, wrong amount charged or recorded, no recovery path.
- **S2 Major**: slows a frequent task noticeably, error likely under queue pressure, unclear state during payment or sync.
- **S3 Minor**: inconsistency, awkward wording, small target, cosmetic issue in an infrequent screen.
- **S4 Polish**: nice-to-have.

Quantitative targets to measure against (adjust after W2 baseline):
- Scanned item, exact cash: 3 taps or fewer after the last scan.
- Any primary button at least 48 x 48 px, with at least 8 px spacing.
- Total amount and change visible without scrolling in every payment state.
- Every destructive action has confirmation or undo.
- Every async hardware action shows progress, success and failure within 1 second of state change.

## 6. Phases

| Phase | Work | Output |
| --- | --- | --- |
| P0 Setup | Run `npm run dev`, backend via `start.sh`, seed data, confirm tests and lint baseline | Reproducible audit environment, baseline notes |
| P1 Flow mapping | Read code for W1 to W22, draw step and tap maps, list states and error exits | `docs/audit/flow-maps.md` |
| P2 Live walkthrough: critical flows | W2, W5, W11, W14 plus W1, W3, W4 on touch viewport with timings | Timed results, first findings |
| P3 Live walkthrough: remaining flows | W6 to W10, W12, W13, W15 to W22 | Findings list |
| P4 Failure-path testing | Offline, printer, terminal, bad input, double-tap, cancel | Failure matrix |
| P5 Static and visual pass | a11y grep, token/string hygiene, i18n key diff, screenshots at all viewports | Consistency report with screenshot set |
| P6 Synthesis | Dedupe, assign severity, group into themes, rank by impact over effort | `docs/audit/FINDINGS.md` and prioritized backlog |
| P7 Review | Walk results with the owner, confirm priorities, decide what becomes a fix plan | Approved fix scope |

Rough effort: P0 0.5 day, P1 1 day, P2 1 day, P3 1.5 days, P4 1 day, P5 1 day, P6 0.5 day, P7 0.5 day. About 7 working days solo; P1, P3 and P5 can run in parallel subagents if wanted.

## 7. Manual checks needing real hardware or the owner

- Receipt printer: print, cut, drawer pulse, out-of-paper behavior.
- ČSOB Ingenico terminal: approve, decline, cancel, unplug.
- Customer LCD or second window on a real second screen.
- Barcode scanner focus behavior with modals open.
- Real cashier on the touchscreen PC: 15 minutes of observation, ideally 5 real transactions, without coaching. This gives the most valuable UX data and cannot be simulated.

## 8. Deliverables

- `docs/audit/flow-maps.md`: step and tap maps per workflow.
- `docs/audit/FINDINGS.md`: findings table with severity, evidence, direction.
- `docs/audit/screenshots/`: viewport and state captures.
- Prioritized backlog: top 10 fixes, quick wins (under 1 hour each) separated out.
- Test gap list for later regression tests.

## 9. Risks and assumptions

- Assumes dev environment can run frontend and backend locally with seed data; hardware is mocked or absent during P2 to P5.
- Browser-pane testing does not reproduce real touch input or the Tauri kiosk window; touch-specific findings are marked "needs device confirmation".
- Findings from code reading alone are marked "unverified" until reproduced in the UI.
- Audit does not change code. Fixes follow the project rule: phased `implementation_plan.md` and approval before multi-file changes.

## 10. Open questions for the owner

1. Which screen sizes and which device does the real cashier PC use (resolution, touch only, or touch plus mouse)?
2. Is Vietnamese or Czech the cashier's working language, and is English needed at all for the counter?
3. Are there known pain points from real use that should be audited first?
4. May I use the live store setup (real printer and terminal) for P4 and section 7, and when?
5. Should the cloud `web/` dashboard be added as a second audit after this one?
