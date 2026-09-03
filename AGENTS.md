# Himmel POS — Agent Instructions & Engineering Guidelines

## 1. Project Overview & Architecture
Himmel POS (`pos-eet-himmel`) is a production touchscreen Point of Sale system.
- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (No Tailwind). Default port `5173`.
- **Backend**: Python 3.10+ FastAPI, Uvicorn, SQLAlchemy 2.0+, SQLite (`backend/pos_store.db`). Default port `8000`.
- **Hardware Integrations**: ESC/POS USB/Serial/Network thermal printers (`python-escpos`), RJ11 cash drawer, WebSocket customer LCD display (`/api/v1/ws/customer-display`), ČSOB Ingenico Move 3500 terminal TCP API, IMAP bank email payment listener.
- **Fiscalization**: Czech EET 2.0 PKCS#12 signing, RSA-SHA256 PKP, SHA-1 BKP, SOAP dispatcher with offline queue fallback.

---

## 2. Core Principles & Engineering Standards

### Build Discipline & Simplicity
- **Reuse First**: Check existing helpers in `src/utils/`, `src/hooks/`, `backend/services/`, and `src/api/posApi.js` before writing new code.
- **Surgical Edits**: Touch only files required for the task. Preserve comments and docstrings.
- **Clean Up Orphans**: Remove unused imports, variables, and props introduced during changes.

### Financial Precision & Invariants
- **Monetary Calculations**: Never use unrounded binary floating point for currency. Use `roundCZK` (frontend) and `Decimal` (backend) with 2 decimal places.
- **VAT Invariants**: Czech multi-tier VAT (21%, 12%, 0%). Base + VAT must strictly equal total.
- **Immutability of Sales**: Completed sales records in SQLite are immutable. Corrections/returns require reverse refund transactions (`refund_status`, `refunded_amount`).

### Touch Ergonomics & UI Rules
- **Touch Targets**: Minimum **40px–44px** height for all interactive buttons, chips, and keypad keys.
- **No Text Wrapping**: All action buttons and chips must enforce `white-space: nowrap` and `flex-shrink: 0`.
- **Fluid Layout**: Viewport must fit `100dvh` without unwanted horizontal page scrolling (`max-width: 100vw; overflow-x: hidden`).
- **Sizing, Overlap & Overflow Prevention**:
  - Always verify component bounds, container sizing, and flex/grid shrink behavior (`min-width: 0` on flex items, `overflow: hidden`, or controlled scroll `overflow-y: auto`).
  - Prevent text/icon overlaps: enforce explicit spacing (`gap`), truncate long variable labels with `text-overflow: ellipsis`, and avoid unchecked absolute positioning.
  - Modals and popups MUST enforce bounded `max-height: 90dvh` with scrollable body (`overflow-y: auto`) and non-shrinking headers/footers (`flex-shrink: 0`) to prevent clipping on compact touch monitors (1024x768, 1280x800).
  - Multi-language length checks: Ensure longer strings in Czech or Vietnamese do not cause text overlaps or push buttons outside visible boundaries.

### Internationalization (i18n)
- All user-visible strings MUST use `useTranslation()` (`t('key.path')`).
- Every new string must be added across all 3 supported languages in `src/i18n/translations.js`:
  - `cs` (Czech)
  - `vi` (Vietnamese)
  - `en` (English)

### Implementation Planning Discipline
- **Always Start with an Implementation Plan**: Before modifying code or executing multi-file tasks, you MUST first create a structured, multi-step implementation plan (`implementation_plan.md`).
- **Phased Subtask Breakdown**: Complex tasks MUST be partitioned into sequential, numbered phases (Phase 1, Phase 2, Phase 3...) to ensure small, focused, and surgical subtasks.
- **User Approval First**: Obtain user review and explicit approval on the implementation plan before beginning code edits.
- **Exceptions (Autonomous Operations)**: Serena memory updates (`.serena/memories/`), Codegraph explorations/re-indexing, and autonomous git operations (`git add/commit/push` when prompted) NEVER require asking for permission, user confirmation, or separate planning approvals.
- **Proactive Follow-Ups & Next Plan Options**: At the conclusion of every response, task, or phase, you MUST always ask relevant follow-up questions and present clear, structured options for next plans or subsequent steps.

### Knowledge Base & Index Discipline (Serena & Codegraph)
- **Autonomous Access & Updates (No Permission Required)**: The agent has full, unconditional authority to access, query, read, edit, write, and update Serena memories (`.serena/memories/`) and Codegraph index (`.codegraph/`, `codegraph_explore`) autonomously at any time without asking for permission, user confirmation, or approval.
- **Always Update Serena Memories**: After completing architectural changes, adding new hooks/utilities, modifying database models, or updating API contracts, you MUST autonomously update the corresponding memory in `.serena/memories/` using Serena tools (`edit_memory` / `write_memory`). Never stall, ask for permission, or allow memories to drift or become obsolete.
- **Codegraph AST Index Sync**: Use `codegraph_explore` as the primary search and blast-radius tool before making code modifications. Ensure new files and symbols remain clean and discoverable within the AST index. Query and rebuild index autonomously without asking.

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

Run these verification commands before completing any task:

1. **Frontend Unit Tests**:
   ```bash
   npm run test
   ```
   *All financial and utility tests must pass.*

2. **Frontend Lint**:
   ```bash
   npm run lint
   ```
   *Must pass with 0 errors and 0 warnings.*

3. **Frontend Build**:
   ```bash
   npm run build
   ```
   *Must build cleanly to `dist/`.*

4. **Backend Unit Tests**:
   ```bash
   python -m unittest discover -s backend/tests -p "test_*.py"
   ```
   *All test cases must pass.*

5. **Serena & Memory Sync**:
   *Ensure domain memories in `.serena/memories/` match the latest state of the codebase.*

6. **Git Hygiene & Autonomous Operations**:
   - **Hygiene**: Ensure no unrelated, temporary, or foreign files are staged or committed.
   - **Autonomous Commit & Push**: When prompted or instructed by the user to commit, save, or push (e.g. "commit changes", "commit and push", "commit", "push", or "/commit"), the agent MUST autonomously stage modified files (`git add`), write a clear Conventional Commit message, execute `git commit`, and run `git push origin <branch>` directly without asking for extra confirmation or stalling.
