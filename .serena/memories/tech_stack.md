# Tech Stack & Environment

## Frontend
- React 19, Vite, Lucide Icons, Vanilla CSS design tokens (`index.css`).
- Modular views: Code-split via `React.lazy()` + `<Suspense>` (`SettingsView`, `SalesHistoryView`, `InventoryView`, `CustomerDisplayView`, `PresetsCatalogView`).
- Custom hooks: `useCart`, `useRegisterKeypad`, `usePosAudio`, `usePosConfig`.
- Financial utilities: `src/utils/tax.js` (`roundCZK`, `calculateCartTotals`, `calculateCashChange`).
- API client: Custom `fetch` wrapper in `src/api/posApi.js`.

## Backend
- Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2.0+.
- Database: SQLite (`backend/pos_store.db`).
- Cryptography: `pycryptodome`, `cryptography` (PKCS#12 certificate parsing & RSA signing).
- Fiscal & Networking: `requests` (SOAP HTTP POST), `python-escpos` (thermal printers).

## Desktop & Native Shell
- Tauri v2 (`src-tauri/`): Native Rust desktop wrapper for Linux & Windows.
- Capabilities & plugins: `tauri-plugin-shell`, `tauri-plugin-process`, `tauri-plugin-log`.
- PyInstaller sidecar: Standalone backend packaging (`backend/dist_standalone/pos-backend-standalone`) bundled as `pos-backend-<target-triple>`.
- System tray integration, auto-health polling, and clean child process shutdown.

## Quality Assurance & Testing
- Unit testing: `vitest` (`npm run test`) for financial calculations and invariants.
- Linter: `oxlint` (`npm run lint`) enforcing 0-warning policy.
- Build: `vite build` (`npm run build`) targeting `dist/`.
- Backend testing: `python -m unittest discover -s backend/tests -p "test_*.py"`.
- Agent rules & discipline: `AGENTS.md` and `.serena/memories/` synchronization.

## Related Memories
- Execution and launch configurations: `mem:testing_and_launch`
- Frontend components: `mem:frontend/components`
- Frontend state orchestration: `mem:frontend/core`