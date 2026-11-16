# projectmem - pos-project

_Last updated: 2026-11-16_

## Project purpose
**VoltFlow POS** (`pos-eet-himmel`) is an enterprise-grade, touch-optimized Point of Sale (POS) system engineered for retail, grocery, and hospitality businesses. It bridges a high-performance **React 19** touchscreen UI with a resilient **Python FastAPI** hardware backend, wrapped in a…

## Recent issues
- [OPEN] #0002 Fractional qty truncated by parseInt in tax.js/normalizeSale: 0.35 kg sale stored as total 0, qty 0 [src/utils/tax.js:13; src/api/posApi.js normalizeSale] (open)
- [OPEN] #0001 Cash sales with fractional total rejected by backend 422 TOTAL_MISMATCH; UI shows success, sale never persisted [src/App.jsx handleCompleteSale; backend/routers/sales.py:939] (open)
- [DONE] #legacy_b2dc Legacy issue: fix(printer): resolve active online POS printer and prevent spooler paper waste (fixed)
- [DONE] #legacy_933c Legacy issue: fix(ui): optimize POS layout and ergonomics for 1600x900 screens (fixed)
- [DONE] #legacy_4534 Legacy issue: fix(security): apply constant-time token compare and division-by-zero guard on VAP (fixed)
- [DONE] #legacy_2ca4 Legacy issue: fix(printer): unify receipt typography, restore line pitch, and align edge-to-edge separators (fixed)
- [DONE] #legacy_1db3 Legacy issue: fix(hardware): bundle escpos capabilities and add win32print spooler fallback for NSIS installs (fixed)

## Decisions
- No decisions logged yet.

## Notes
- docs(roadmap): update REMOTE_WEB_DASHBOARD_PLAN with Phase 2.6 status
- feat(nav): streamline navbar tabs and build config
- feat(cart): redesign last receipt quick action chip
- docs: pivot Phase 3 to paperless QR receipts and move loyalty to end
- feat(mcp): optimize openrouter routing with tiered models and replication guide
- perf(startup): accelerate backend boot and status detection on launch
- feat(mcp): add jev intelligence suite and serena server config
- feat(eet): update CA EET renewal spec and server URLs
- chore(eet): import official CA PEM certs and v1.2a spec
- chore(agents): sync jev suite and sonnet 5.5 model tiers

## Key files
- `docs/ROADMAP.md`
- `docs/plans/REMOTE_WEB_DASHBOARD_PLAN.md`
- `backend_cloud/routers/auth.py`
- `backend_cloud/routers/staging.py`
- `backend_cloud/tests/test_auth.py`
- `backend_cloud/tests/test_routers.py`
- `backend/services/remote_staging_sync.py`
- `.serena/memories/database.md`
- `.serena/memories/security_and_auth.md`
- `backend_cloud/database.py`
- `backend_cloud/routers/catalog.py`
- `backend_cloud/routers/exports.py`
- `backend_cloud/snapshot_service.py`
- `web/src/api/cloudApi.js`
- `web/src/pages/CatalogPage.jsx`
- `web/src/pages/TaxExportsPage.jsx`
- `2.6`
- `scripts/build/build_windows_release.bat`
- `src-tauri/tauri.conf.json`
- `src/__tests__/App.test.jsx`

## Open questions
- None logged yet.
