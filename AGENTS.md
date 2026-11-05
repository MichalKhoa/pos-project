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
- **Serena Memory & Codegraph**: Update `.serena/memories/` and sync `.codegraph/` (`codegraph sync`) when models, hooks, utilities, or API contracts change.

## 3. Delegation & Quota Shield

### Mechanical Tasks (Delegate to Shield Primary Quota)
Offload mechanical, low-reasoning drafting to OpenRouter or `flash_lite` subagents:

| Task Category | Mandatory Tool / Delegation |
|---|---|
| **Task Tiering, Guardrails & Triage** | `openrouter_jev_route`, `openrouter_jev_guardrail`, `openrouter_jev_triage_request` (`typesafe/jev-router`) |
| **Error Compaction & Loop Detection** | `openrouter_jev_compact_context`, `openrouter_jev_classify_failure`, `openrouter_jev_detect_loop` (`typesafe/jev-router`) |
| **i18n Dictionary & Boilerplate Drafting** | `openrouter_query` or `openrouter_code_refactor` (`deepseek/deepseek-v4.1-flash`) |
| **Phase 0 Fuzzing & Standard Diff Audit** | `openrouter_query` (`~deepseek/deepseek-pro-latest`) |
| **Boundary / Negative Test Vector Synthesis** | `openrouter_synthesize_tests` (`openai/gpt-5.6-luna-pro`) |
| **Fiscal / Crypto Invariant Audit** | `openrouter_accuracy_oracle` (`openai/gpt-5.6-luna-pro`) |
| **High-Stakes Final Gatekeeper Audit** | `openrouter_query` (`anthropic/claude-sonnet-5.5`) |
| **Multi-File Search / Code Exploration** | `invoke_subagent` (Role: `research`, Model: `flash_lite`) or `subagent-investigate` |
| **Log Digging & Large File Inspection (>200 lines)** | `ctx_execute_file` (in-sandbox) or `flash_lite` subagent |

### Core Engineering (Keep Strictly in Main Context)
DO NOT delegate high-reasoning tasks. The primary Antigravity context owns:
- **Bug fixing & root-cause debugging** (test failures, state bugs, DOM selector clashes)
- **Financial & VAT calculations**
- **Surgical code edits** (`edit_file` / `replace_file_content`)
- **Synthesis & verification gates**

## 4. Verification Gates (Run Before Done)
- Frontend Tests: `npm run test | tokless`
- Frontend Lint: `npm run lint | tokless`
- Frontend Build: `npm run build | tokless`
- Backend Tests: `python -m unittest discover -s backend/tests -p "test_*.py" | tokless`
- Git Operations: Stage surgical files, Conventional Commit, push to branch.
