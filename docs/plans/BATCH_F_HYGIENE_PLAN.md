# Batch F plan: hygiene (F-009, F-010, F-013, F-023, F-024, F-025)

Status: waiting for approval. No code changed yet.

## 1. Goal

Stop the debt from growing and fix the parts a cashier actually meets: native browser dialogs for destructive actions, Czech text a Vietnamese cashier cannot read, icon buttons with no name, and B2B fields with no keyboard hint. This batch does not rewrite the styling.

## 2. Facts (counted today)

- 21 `confirm(` or `alert(` calls in 11 files (the audit counted 17). Most in `InventoryView.jsx` (3), `App.jsx` (3), `csvExporter.js` (2), `SettingsView.jsx` (2), `TechnicianTab.jsx` (2), `QuickPresetGrid.jsx` (2), `PresetsCatalogView.jsx` (2), `DepositPackagingModal.jsx` (2).
- 501 `<button` tags with no `type` attribute. Inside a `<form>` such a button submits it.
- No `inputMode` anywhere in `PaymentModal.jsx` or `src/components/payment/`. The B2B IČO field is a plain text input.
- Hard-coded Czech: the audit lists `ReceiptPreviewPaper.jsx`, `TaxReportsModal.jsx`, `PhysicalInventoryModal.jsx`, `DepositPackagingModal.jsx`. `ReceiptPreviewPaper` prints receipts and its Czech text is fixed on purpose (receipts stay Czech by law), so it is excluded.
- The translation guard test (`translation_keys.test.js`) already makes every `t()` key exist in cs, vi and en.

## 3. Scope and decisions (defaults, say if you disagree)

1. **Shared `ConfirmModal` (F-010).** One component with two variants: normal, and "type the word" for irreversible actions (delete all sales, reset data). It replaces the 21 native dialogs. `alert` messages become a flash banner or an inline error, not a modal.
2. **Translate by screen (F-009, F-023)** only the screens in `confirm`/`alert` sites and the three inventory/tax modals, because the ConfirmModal work touches them anyway. Not a repo-wide extraction.
3. **Guard against new debt (F-024)** with a test, not a rewrite: fail if `confirm(`/`alert(` appears again in `src`, and if a `<button` without `type` appears in a changed file is too noisy, so instead fix the 501 buttons with a one-time script and then guard with a test that counts zero.
4. **Hex colors and inline styles:** not enforced in this batch (2 553 inline styles is too many to gate). Left as "apply tokens when touching a file".
5. **Accessible names (F-013):** add `aria-label` to the icon-only buttons in the navbar and the register screen. List is found by a test that renders those screens and finds buttons with no text and no name.
6. **B2B keyboard (F-025):** add `inputMode="numeric"` to IČO and DIČ-number fields and `autoComplete="off"`. Moving B2B into its own step is a larger redesign and stays out.

## 4. Phases

**Phase 1: guard tests first (red).**
- No `confirm(`/`alert(` in `src` outside tests; no `<button` without `type`; every icon-only button on Navbar and Register has an accessible name; IČO input has `inputMode="numeric"`.
- Gate: tests red for the right reasons.

**Phase 2: mechanical fixes.**
- Script adds `type="button"` to the 501 buttons (skip ones that already have `type`; keep submit buttons inside forms as `type="submit"` after checking each `<form>`).
- Add `aria-label`s and `inputMode`.
- Gates, `/code-review` at `medium`, and a live click-through of the register, payment and navbar.

**Phase 3: `ConfirmModal` and native dialog replacement.**
- Build `ConfirmModal` (large touch buttons, typed-word variant, Escape and backdrop handling) with its own tests and cs/vi/en strings.
- Replace the 21 sites screen by screen; destructive ones (delete all sales, reset data, delete preset) use the typed-word or red variant. Translate the texts of the touched screens.
- Gates, `/code-review` at `medium` (`high` for the delete-sales and refund sites), live check of each replaced dialog.

**Phase 4: record and commit.** Result sections, statuses in the audit files.

## 5. Risks

- Adding `type="button"` can change behaviour where a button relied on the default submit. The script must keep submit buttons inside `<form>`; tests and the live click-through cover it.
- The typed word must be translated and the Vietnamese cashier must be able to type it; use a word shown on screen, not a hidden one.
- 21 call sites in 11 files is a wide diff; each phase commits separately.

## 6. Out of scope

Hex color and inline style enforcement, repo-wide string extraction, moving B2B into a dedicated step, receipt text (stays Czech), Batch E layout.

## 7. Phase 1 result

Added `src/__tests__/ui_hygiene.test.jsx` with four guard tests. All four are red for the intended reasons:
- Native dialogs: 21 `confirm(` or `alert(` calls found (`App.jsx:316` and others).
- Button type: 66 `<button>` tags without `type`. This corrects the plan: the 501 figure came from a line-based grep that counted every multi-line tag; the test reads whole tags, so 66 is the real number and Phase 2 is smaller than planned.
- Navbar names: 6 navbar buttons have neither text nor an `aria-label` (the hamburger button and five others).
- IČO field: no `inputmode="numeric"`.

The Register-screen check of icon-only buttons is not in this phase; the navbar is the only screen covered, because rendering the whole app for it costs more than it finds. Phase 2 can add it if the live click-through shows unnamed buttons there.
