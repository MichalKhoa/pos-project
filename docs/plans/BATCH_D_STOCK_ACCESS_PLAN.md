# Batch D plan: make stock management reachable (F-017)

Status: decisions made (option a, no admin gate); waiting for approval to start Phase 1. No code changed yet.

## 1. Goal

A cashier or owner can open the stock screens (stock intake, write-off, physical inventory, CSV import, deposit packaging, movement ledger, tax reports, barcode labels) from the running app, and a test fails if a top-level view ever becomes unreachable again.

## 2. Facts (checked in code)

- `src/App.jsx:1151` still renders `InventoryView` when `activeTab === 'inventory'`. Nothing sets that tab.
- Commit `73f37c9` ("streamline navbar tabs") removed the "Sklad" tab from both the desktop navbar and the mobile drawer in `src/components/Navbar.jsx`. The translation key `nav.inventory` ("Sklad" / "Kho hàng" / "Inventory") still exists in all three languages.
- `InventoryView.jsx` is a full screen of 528 lines with its own search, category filter, low-stock filter, CSV import/export and ten modals under `src/components/inventory/`. It is not a small panel.
- `PresetsCatalogView.jsx` (Katalog) is 350 lines and already has its own toolbar, which is clipped at 1024 px (F-018).
- The removed tab had no admin gate. The navbar already knows `isAdmin`.

## 3. Decisions needed

1. **Where does stock live?** Options:
   - (a) Restore the "Sklad" tab in the navbar and drawer. Smallest change: re-add two buttons and reuse the existing view and translations. **Recommended.**
   - (b) Move the entry points into Katalog. Needs a refactor of a 528-line view into a section, and Katalog's toolbar is already crowded.
   - (c) Put it under Settings. Hides a daily task behind a settings page.
   The earlier commit removed the tab on purpose ("streamline"), so the owner may have wanted fewer tabs. If deliveries are daily, a visible tab is right; if weekly, Katalog is acceptable but costs more.
2. **Admin gate?** Default: no gate on viewing stock levels, but keep whatever PIN prompts the modals already use. Alternative: show the tab only in admin mode, like the settings entries. Write-off and physical inventory change money-relevant data, so a gate on those two is worth considering.

## 4. Phases (assuming option a with no gate)

**Phase 1: tests first.**
- Add `src/__tests__/navbar_reachability.test.jsx`: render `App` (or `Navbar` plus the tab switch) and assert that every tab key rendered by `App.jsx` (`register`, `presets`, `inventory`, `history`, `analytics`, `settings`) has a navbar button and a drawer button that opens it. It fails today for `inventory`.
- Gate: new test red for the right reason.

**Phase 2: restore the tab.**
- `Navbar.jsx`: re-add the desktop `nav-tab` and the drawer `drawer-nav-btn` for `inventory` with `Package` icon and `t('nav.inventory')`, placed after Katalog. Check the tab pill animation still lines up (it reads `tabRefs`).
- Check the navbar fits at 1366 px and 1024 px with six tabs; if not, report it under F-018 rather than redesigning here.
- Gates: vitest, lint, build, backend tests, `/code-review` at `medium` (no money path touched), live check in the browser pane.

**Phase 3: first look at the stock screens.**
- They were unreachable during the audit. Open each modal once, record anything obviously broken as new findings in `docs/audit/FINDINGS.md` (flow W15), and fix only what blocks reaching the screens. Fixing those findings is a later batch.

## 5. Risks

- Six tabs may not fit at 1024 px; the navbar is already tight.
- The screens were never exercised in the audit, so Phase 3 may find more problems than a one-line tab fix suggests. Scope stays at "record, do not fix".
- If the owner chooses (b) or (c), Phase 2 grows from about 20 lines to a real refactor and needs its own plan.

## 6. Out of scope

Layout and touch sizes (Batch E), shared `ConfirmModal` (Batch F), real-device tests.

## 7. Phase 1 result

Added `src/__tests__/navbar_reachability.test.jsx`. It reads the view keys from `App.jsx` (every `activeTab === '…'` comparison), renders `Navbar` with a spy for `setActiveTab`, clicks every `.nav-tab` and every `.drawer-nav-btn`, and checks each view key was opened. It runs once per view for the desktop bar and once per view for the mobile drawer. Today 11 of 13 cases pass and 2 fail: the `inventory` view has neither a desktop tab nor a drawer button. That is the F-017 defect, so the test is red for the right reason. Phase 2 makes it green.

## 8. Phase 2 result

`Navbar.jsx` now has a "Sklad" button (Package icon, `t('nav.inventory')`) in the desktop bar and in the mobile drawer, placed after Katalog, with the same tab-pill ref handling as the other tabs. The reachability test is green. Gates: 381 frontend tests pass, lint clean, build OK, 213 backend tests pass. Live check in the browser pane: the tab opens the stock screen at 1366 px, and all six tabs fit at 1024 px. `/code-review` at `medium` found nothing. The Sklad tab is not admin-gated, as decided. Not checked: the mobile drawer on a real phone width (Batch E).

## 9. Phase 3 result

Opened the stock screens in the browser pane against a backend that used a throwaway data folder, so no real data was touched. Checked:
- Stock intake: ran a full intake (100 pieces, 201 from the server, movement recorded). Found F-029 (list stays stale) and F-031 (table clipped).
- Write-off: opened and rendered, did not submit. Found F-032.
- Tax reports and deposits: opened; both fail on the Vite dev server because of relative URLs (F-030).
- Physical inventory: opened and rendered an empty list; did not submit.

Not checked: movement ledger content, CSV import and export, barcode labels, submitting a write-off or physical audit, real printing, touch use. These need a second pass, ideally after F-029 and F-030 are fixed.

No code was changed in this phase. F-029 and F-030 are the two worth fixing first because they can double stock or break whole screens.

## 10. Batch D status

F-017 fixed. Four new findings (F-029 to F-032) recorded and not fixed.
