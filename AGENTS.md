# VoltFlow POS — Project Instructions

## 1. Stack & Architecture
Tauri v2 (`src-tauri/`) desktop shell + React 19 / Vanilla CSS (`src/`) + FastAPI / SQLite (`backend/pos_store.db`).
PyInstaller sidecar (`pos-backend.exe`). Thermal printers (ESC/POS), customer LCD, EET 2.0 PKCS#12 signing.

## 2. Domain Invariants
- **Financial Precision**: Never use binary float. Frontend: `roundCZK()`. Backend: `Decimal` (2 places).
- **VAT**: Czech tiers (21%, 12%, 0%). Base + VAT strictly equals total.
- **Sales Immutability**: Completed sales records immutable. Corrections use reverse refund transactions (`refund_status`, `refunded_amount`).
- **Touch Ergonomics**: Min 40–44px targets. Action chips `white-space: nowrap; flex-shrink: 0`. Fit `100dvh`, no horizontal scroll (`max-width: 100vw`). Modals `max-height: 90dvh`.
- **i18n**: User-visible text MUST use `t('key.path')`. Add all new strings to `cs`, `vi`, `en` in `src/i18n/translations.js`.
- **Serena Memory**: Update `.serena/memories/` when models, hooks, utilities, or API contracts change.

## 3. Verification Gates (Run Before Done)
- Frontend Tests: `npm run test | tokless`
- Frontend Lint: `npm run lint | tokless`
- Frontend Build: `npm run build | tokless`
- Backend Tests: `python -m unittest discover -s backend/tests -p "test_*.py" | tokless`
- Git Operations: When prompted to commit/push, stage surgical files, write Conventional Commit, push to branch autonomously.
