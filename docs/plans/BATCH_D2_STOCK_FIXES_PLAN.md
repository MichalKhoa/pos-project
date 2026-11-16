# Batch D2 plan: fix the stock screen findings F-029 and F-030

Status: waiting for approval. No code changed yet. Follows Batch D (see `BATCH_D_STOCK_ACCESS_PLAN.md`). F-031 and F-032 (layout) stay with Batch E.

## 1. Goal

After an intake, write-off or physical audit the Sklad table shows the new stock at once, and the tax, deposit and physical inventory screens reach the backend in every way the app can run (Vite dev server, Tauri window, backend-served page).

## 2. Facts (checked in code)

- F-029: `submitStockIntake` (`src/api/posApi.js:1547`) and the write-off call (`:1592`) call `invalidateApiCache('presets')`. No code caches anything under the tag `presets`; the preset list and the categories use the tag `catalog` (`:625`, `:695`, 5 minute TTL). So the call does nothing and the refresh in `InventoryView` returns the cached list.
- The physical audit (`PhysicalInventoryModal.jsx:138`) and the deposit movement (`DepositPackagingModal.jsx:59`) are plain `fetch` calls with no cache invalidation at all. An audit changes stock, so it has the same problem.
- F-030: seven calls use a relative `/api/v1/...` URL: `TaxReportsModal.jsx` lines 20, 38, 78; `DepositPackagingModal.jsx` lines 19, 59; `PhysicalInventoryModal.jsx` lines 138, 166. Everything else goes through `API_BASE_URL` in `posApi.js` (not exported today).
- Existing tests in `src/__tests__/tax_inventory_roadmap_features.test.jsx` mock `fetch` and check the relative URLs, so they need the new URL form.
- `DepositPackagingModal.fetchSummary` ignores a non-OK response and an error only goes to the console, so the user sees an empty book.

## 3. Decisions (defaults, say if you disagree)

1. **How to fix the URLs:** export `API_BASE_URL` from `posApi.js` and build the seven URLs from it. Not new wrapper functions: the modals keep their current logic and only the URL changes (smallest change).
2. **How to fix the cache:** change the two `invalidateApiCache('presets')` calls to `'catalog'`, and add `invalidateApiCache('catalog')` after a successful physical audit. Deposit movements do not change presets, so no invalidation there.
3. **Deposit summary error:** show a short error line in the modal when the summary cannot be loaded (new translation key in cs, vi, en), instead of an empty book with 0.00 Kč.

## 4. Phases

**Phase 1: tests first.**
- `api_caching.test.jsx` style test: after `submitStockIntake` and the write-off call succeed, a second `fetchPresetsBackend` hits the network again. Same for the audit helper path (a small exported helper is not needed; test the modal's call with a mocked `fetch` and check `fetchPresetsBackend` refetches).
- Update `tax_inventory_roadmap_features.test.jsx` to expect `http://127.0.0.1:8000/api/v1/...`; add a test per modal that no `fetch` call uses a URL starting with `/`.
- A guard test in the style of `translation_keys.test.js`: scan the source of `src/components` for `fetch(` with a relative `/api` URL and fail if found.
- Add a test that the deposits modal shows the error line when the summary request fails.
- Gate: new tests red for the right reasons.

**Phase 2: implement.**
- Export `API_BASE_URL`; replace the seven URLs; change the two tags; add the audit invalidation; add the deposit error line and its three translations.
- Gates: vitest, lint, build, backend tests, `/code-review` at `high`? The change touches stock quantities but not money or VAT, so `medium`; raise to `high` if the diff grows.
- Live check against a backend on a throwaway data folder (as in Batch D Phase 3): run an intake and see the table update at once; open the tax, deposit and physical inventory screens on the Vite dev server and see them load.

**Phase 3: record and commit.** Result section here, statuses in `FINDINGS.md` and `FIX_RECOMMENDATIONS.md`, projectmem notes.

## 5. Risks

- Other code may rely on the stale list (for example an optimistic local update that is later overwritten). The live check covers the Sklad table; the register tiles read the same list and will now refresh too.
- The Tauri case is inferred, not run. The fix is correct either way because it uses the same base URL as every other call.

## 6. Out of scope

F-031, F-032 (layout), second pass over ledger, CSV and labels, real printing.

## 7. Phase 1 result

Added `src/__tests__/stock_cache_and_urls.test.jsx` (8 tests) and changed two URL assertions in `tax_inventory_roadmap_features.test.jsx` to the full backend address.

New file, today:
- Control (two reads with no stock change fetch once): passes.
- Refetch after stock intake, after write-off, and after a physical audit (driven through the modal): all fail with "expected 1 to be 2". That is F-029.
- Deposit book and tax reports make a relative `/api` call: both fail. A source scan finds three files with a relative `/api` fetch. That is F-030.
- Deposit book with a failing summary shows no `role="alert"` error: fails.

Existing file: "submits audit reconciliation" and "records a supplier intake movement" fail because they now expect the full address.

All 9 failures are for the intended reasons. Phase 2 makes them pass.
