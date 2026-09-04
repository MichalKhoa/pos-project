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

### Context & Token Optimization
- **Complexity Profiling**: Before executing any multi-file feature request, run `codegraph_explore` to map the blast radius. If the task spans multiple backend routers and frontend components, you must generate a phased `implementation_plan.md`, log the state handoff into `.serena/memories/`, and explicitly instruct the user to open a fresh conversation for Phase 1.
- **The 50% Rule (Context Cap)**: Monitor the conversation length. If the chat history or context window feels heavily loaded, you must pause immediately, summarize the active state into a Serena memory, and prompt the user to execute `/clear` before continuing.
- **Subagent Tiering & Model Routing**: Delegate isolated side-tasks via `invoke_subagent` to conserve main chat context and token spend:
  - `Model: "flash_lite"`: Mechanical tasks, running verification scripts, quick config/doc lookups, log filtering. Zero thinking overhead.
  - `Model: "flash"`: Targeted code exploration, locating references across 1–2 folders, drafting isolated unit tests.
  - `Model: "pro"` or `inherit`: Architecture planning, multi-module refactoring, tough debugging.
  - Subagent results MUST return caveman-compressed summaries to prevent parent context bloat.
- **Ban Unscoped Searches**: Never run blanket grep or file searches across the entire repository. If a symbol is missing from `codegraph_explore`, restrict any subsequent terminal searches strictly to the relevant subdirectory (e.g., `backend/services/` or `src/components/`).
- **MCP Server Pruning**: Keep only the Serena and Codegraph MCP servers active by default. Ensure no unnecessary tool schemas are bloating the system prompt during routine edits.

### Implementation Planning Discipline & Anti-Looping
- **Mandatory Plan & Intent Verification**: Create `implementation_plan.md` before multi-file/feature changes. Always stop and obtain explicit user plan approval to verify user intent before making code edits.
- **Complex Task Decomposition (>2 files or cross-stack)**: Whenever a request touches >2 files or crosses both frontend and backend boundaries, the agent MUST decompose the work into small, self-contained sequential phases (Phase 1, Phase 2, etc.).
- **Standalone Conversation Kickoff Prompts**: For each phase in `implementation_plan.md`, provide an explicit, copy-pasteable prompt so the user can implement that phase in a brand-new conversation to minimize token overhead. Record active state handoff into `.serena/memories/`.
- **Strict Planning Chat Boundary**: In the initial planning conversation, STOP immediately after generating `implementation_plan.md` and logging handoff state into Serena memory. Do NOT execute or write feature code in the planning conversation; instruct the user to start a fresh chat for Phase 1.
- **Phase Completion & Handoff**: At the end of each implementation phase, update the plan progress, record handoff context in Serena memory, and provide the prompt for the next phase in a fresh conversation.
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
│   ├── build/               # Standalone and release build scripts (Linux & Windows)
│   ├── tools/               # Auxiliary scripts (kiosk, update, LAN setup, stop, nssm)
│   └── prepare_sidecar.py   # Stages pos-backend-<target-triple> for Tauri
├── install.sh / install.bat # One-click project setup (venv, pip, DB migrations, npm, build)
├── start.sh / start.bat     # Unified production launcher (:8000)
├── debug.sh / debug.bat     # Hot-reload debug launcher (Vite :5173 + FastAPI :8000)
├── backend_settings.sh / .bat # Backend settings GUI (.env, DB, EET certs, hardware)
├── .agents/rules/           # Antigravity rule definitions
└── .serena/memories/        # Serena domain memory index
```

---

## 4. Verification & Quality Gates

Run before completing any task:

1. **Mandatory tokless Piping**: All terminal commands that generate heavy output—including `npm run test`, `npm run lint`, `python -m unittest`, and build scripts—MUST be piped through the `tokless` utility. Never dump raw, uncompressed tracebacks or full terminal logs directly into the chat history.
2. **Frontend Tests**: `npm run test | tokless` (all pass).
3. **Frontend Lint**: `npm run lint | tokless` (0 errors, 0 warnings).
4. **Frontend Build**: `npm run build | tokless` (builds cleanly to `dist/`).
5. **Backend Tests**: `python -m unittest discover -s backend/tests -p "test_*.py" | tokless` (all pass).
6. **Serena Memory Sync**: domain memories match codebase.
7. **Git Hygiene & Autonomous Operations**:
   - Hygiene: no foreign/temp files staged.
   - Autonomous Commit & Push: when prompted to commit/push, stage surgical files (`git add`), write Conventional Commit, `git commit`, and `git push origin <branch>` without extra confirmation.
