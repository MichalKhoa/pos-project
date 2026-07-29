# Tech Stack & Environment

## Frontend
- React 19, Vite, Lucide Icons, Vanilla CSS design tokens (`index.css`).
- API client: Custom `fetch` wrapper in `src/api/posApi.js`.

## Backend
- Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2.0+.
- Database: SQLite (`backend/pos_store.db`).
- Cryptography: `pycryptodome`, `cryptography` (PKCS#12 certificate parsing & RSA signing).
- Fiscal & Networking: `requests` (SOAP HTTP POST), `python-escpos` (thermal printers).

## Ignore Policies & Quality Assurance
- `.gitignore`: Excludes `node_modules/`, `backend/venv/`, `dist/`, `pos_store.db`, `backend/certs/*.p12`, `.serena/cache/`, `.serena/project.local.yml`, `.antigravity/`, `.gemini/`.
- `.geminiignore`: Excludes heavy builds/deps, database files, and `.serena/cache/` while leaving `.serena/memories/` indexed for AI context.
- Code quality: `oxlint` (`npm run lint`), `vite build` (`npm run build`).

## Related Memories
- Execution and launch configurations: `mem:testing_and_launch`