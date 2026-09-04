# VoltFlow POS — Agent Instructions & Engineering Guidelines

## 1. Project Overview & Architecture
VoltFlow POS (`pos-eet-himmel`): touchscreen Point of Sale system.
- **Desktop Shell**: Tauri v2 (`src-tauri/`), native Rust wrapper, system tray integration, sidecar process lifecycle, and dual-screen customer display support.
- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (No Tailwind). Port `5173`.
- **Backend**: Python 3.10+ FastAPI, Uvicorn, SQLAlchemy 2.0+, SQLite (`backend/pos_store.db`). Port `8000`.
- **Standalone Packaging**: PyInstaller single-file backend freeze (`build_standalone.py`, `pos_backend.spec`), staged via `scripts/prepare_sidecar.py`, and NSIS installer generation via `build_windows_release.bat`.
- **Hardware**: ESC/POS thermal printers (`python-escpos`), RJ11 drawer pulse, WebSocket customer LCD display (`/api/v1/ws/customer-display`), ČSOB Ingenico Move 3500 terminal TCP API, IMAP bank email payment listener.
- **Fiscalization**: Czech EET 2.0 PKCS#12 signing, RSA-SHA256 PKP, SHA-1 BKP, SOAP dispatcher + offline queue fallback.

---

## 2. Core Principles & Engineering Standards

### Build Discipline & Simplicity
- **Reuse First**: Check `src/utils/`, `src/hooks/` (`useCart`, `useRegisterKeypad`, `useTauri`), `backend/services/`, `src/api/posApi.js` before writing code.
- **Surgical Edits**: Touch only task-required files. Preserve comments + docstrings.
- **Clean Orphans**: Remove unused imports, variables, props introduced by changes.
- **Token Discipline**: Follow `.agents/rules/token_discipline.md`. Call `codegraph_explore` first, shield context with `context-mode` for >200-line files, slice reads with `StartLine`/`EndLine`, and prompt `/clear` after commits.

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

### Implementation Planning Discipline & Anti-Looping
- **Mandatory Plan & Intent Verification**: Create `implementation_plan.md` before multi-file/feature changes. Always stop and obtain explicit user plan approval to verify user intent before making code edits.
- **Phased Subtasks**: Partition complex tasks into sequential numbered phases (Phase 1, 2, 3...).
- **Anti-Looping Circuit Breaker (Rule of Two)**: If any test, build, lint, or run fails **twice** with the same or related error, **STOP IMMEDIATELY**. Do not guess or attempt a 3rd speculative fix. Report the failure and ask for user clarification.
- **Tool Burst Cap**: Never exceed 8 continuous tool operations without reporting progress and verifying intent.
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
│   ├── database.py          # SQLAlchemy engine, session maker, freeze-safe path resolution
│   ├── build_standalone.py  # PyInstaller packaging automation
│   ├── pos_backend.spec     # PyInstaller spec file (onefile & onedir)
│   ├── models.py            # SQLite ORM models (Sale, Item, Preset, Config, etc.)
│   ├── routers/             # REST endpoints (sales, inventory, printer, payments, config, etc.)
│   ├── services/            # Business logic (eet, escpos, email_payment_listener, etc.)
│   └── tests/               # Python unittest suite
├── src/
│   ├── App.jsx              # Main POS register shell (code-split views)
│   ├── api/                 # REST API client wrapper (posApi.js)
│   ├── components/          # UI components and modals
│   ├── hooks/               # Custom React hooks (useCart, useRegisterKeypad, useTauri, etc.)
│   ├── i18n/                # Localization dictionary (translations.js)
│   ├── utils/               # Tax, currency, audio, and formatting utilities
│   └── index.css            # Design tokens and styles
├── src-tauri/               # Tauri v2 native desktop application wrapper
│   ├── src/lib.rs           # Sidecar lifecycle, tray menu, window management
│   ├── capabilities/        # Desktop capabilities (shell, process permissions)
│   └── tauri.conf.json      # Window settings, bundle config, externalBin
├── scripts/
│   └── prepare_sidecar.py   # Stages pos-backend-<target-triple> for Tauri
├── build_standalone.sh      # Linux standalone bundle packaging
├── build_standalone.bat     # Windows standalone bundle packaging
├── build_windows_release.bat # 1-Click native Windows release installer script
├── start_pos.sh             # Unified Linux production launcher
├── start_pos.bat            # Unified Windows production launcher
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
