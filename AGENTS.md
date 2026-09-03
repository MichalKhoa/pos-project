# Himmel POS — Agent Instructions & Engineering Guidelines

## 1. Project Overview & Architecture
Himmel POS (`pos-eet-himmel`): touchscreen Point of Sale system.
- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (No Tailwind). Port `5173`.
- **Backend**: Python 3.10+ FastAPI, Uvicorn, SQLAlchemy 2.0+, SQLite (`backend/pos_store.db`). Port `8000`.
- **Hardware**: ESC/POS thermal printers (`python-escpos`), RJ11 drawer, WebSocket customer LCD display (`/api/v1/ws/customer-display`), ČSOB Ingenico Move 3500 terminal TCP API, IMAP bank email payment listener.
- **Fiscalization**: Czech EET 2.0 PKCS#12 signing, RSA-SHA256 PKP, SHA-1 BKP, SOAP dispatcher + offline queue fallback.

---

## 2. Core Principles & Engineering Standards

### Build Discipline & Simplicity
- **Reuse First**: Check `src/utils/`, `src/hooks/`, `backend/services/`, `src/api/posApi.js` before writing code.
- **Surgical Edits**: Touch only task-required files. Preserve comments + docstrings.
- **Clean Orphans**: Remove unused imports, variables, props introduced by changes.

### Financial Precision & Invariants
- **Currency**: Never use raw binary float. Use `roundCZK` (frontend) and `Decimal` (backend) with 2 decimals.
- **VAT Invariants**: Czech tiers (21%, 12%, 0%). Base + VAT must strictly equal total.
- **Sales Immutability**: SQLite completed sales records immutable. Corrections/returns require reverse refund transactions (`refund_status`, `refunded_amount`).

### Touch Ergonomics & UI Rules
- **Touch Targets**: Min **40px–44px** height for buttons, chips, keypad keys.
- **No Text Wrap**: Action buttons and chips enforce `white-space: nowrap` and `flex-shrink: 0`.
- **Fluid Layout**: Viewport fit `100dvh`, no horizontal scroll (`max-width: 100vw; overflow-x: hidden`).
- **Sizing & Overflow**:
  - Check flex/grid shrink (`min-width: 0`, `overflow: hidden`, or `overflow-y: auto`).
  - No text/icon overlaps: explicit `gap`, truncate variable labels (`text-overflow: ellipsis`).
  - Modals enforce `max-height: 90dvh`, body `overflow-y: auto`, header/footer `flex-shrink: 0` for 1024x768 / 1280x800 screens.
  - Multi-language length checks: ensure Czech and Vietnamese text fit containers.

### Internationalization (i18n)
- User-visible text MUST use `useTranslation()` (`t('key.path')`).
- Add all new strings across 3 languages in `src/i18n/translations.js`: `cs` (Czech), `vi` (Vietnamese), `en` (English).

### Implementation Planning Discipline
- **Mandatory Plan**: Create `implementation_plan.md` before multi-file/feature changes.
- **Phased Subtasks**: Partition complex tasks into sequential numbered phases (Phase 1, 2, 3...).
- **User Approval**: Get explicit user plan approval before code edits.
- **Autonomous Exception**: Serena memory updates (`.serena/memories/`), Codegraph queries/indexing, and requested git commit/push require NO approval or planning gates.
- **Follow-Ups & Next Plans**: End every task/phase with targeted questions and 2–3 structured next plan options.

### Knowledge Base & Index Discipline (Serena & Codegraph)
- **Autonomous Access & Updates**: Full authority to inspect, query, read, edit, write, and update Serena memories (`.serena/memories/`) and Codegraph (`.codegraph/`, `codegraph_explore`) anytime without asking for permission.
- **Sync Serena Memories**: Update `.serena/memories/` via `edit_memory` / `write_memory` when models, hooks, utilities, or API contracts change. Never allow drift.
- **Codegraph AST Index**: Call `codegraph_explore` first for structure and blast radius. Query/rebuild index autonomously.

---

## 3. Directory Structure & Conventions

```
pos-project-himmel/
├── backend/
│   ├── main.py              # FastAPI app, static mount, lifespan, routers
│   ├── database.py          # SQLAlchemy engine, session maker, auto-migration
│   ├── models.py            # SQLite ORM models (Sale, Item, Preset, Config, etc.)
│   ├── routers/             # REST endpoints (sales, config, printer, payments, etc.)
│   ├── services/            # Business logic (eet, escpos, email_payment_listener, etc.)
│   └── tests/               # Python unittest suite
├── src/
│   ├── App.jsx              # Main POS register shell (code-split views)
│   ├── api/                 # REST API client wrapper (posApi.js)
│   ├── components/          # UI components and modals
│   ├── hooks/               # Custom React hooks (useCart, useRegisterKeypad, usePosAudio, etc.)
│   ├── i18n/                # Localization dictionary (translations.js)
│   ├── utils/               # Tax, currency, audio, and formatting utilities
│   └── index.css            # Design tokens and styles
├── .agents/rules/           # Antigravity rule definitions
└── .serena/memories/        # Serena domain memory index
```

---

## 4. Verification & Quality Gates

Run before completing any task:

1. **Frontend Tests**: `npm run test` (all pass).
2. **Frontend Lint**: `npm run lint` (0 errors, 0 warnings).
3. **Frontend Build**: `npm run build` (builds cleanly to `dist/`).
4. **Backend Tests**: `python -m unittest discover -s backend/tests -p "test_*.py"` (all pass).
5. **Serena Memory Sync**: domain memories match codebase.
6. **Git Hygiene & Autonomous Operations**:
   - Hygiene: no foreign/temp files staged.
   - Autonomous Commit & Push: when prompted to commit/push, stage surgical files (`git add`), write Conventional Commit, `git commit`, and `git push origin <branch>` without extra confirmation.
