# Token Discipline & Cost Control Rules — Himmel POS

> [!CAUTION]
> ## 🚨 ZERO-TOLERANCE RULES
> 1. **MANDATORY `tokless` / `rtk pipe` PIPING**: Never run test, lint, build, or large command output without `| tokless`.
> 2. **LOW-COST SUBAGENTS FIRST**: Multi-file exploration, documentation lookup, log parsing, or diagnostic tests MUST be delegated to `invoke_subagent` with `Model: "flash_lite"`. The main thread only receives a 2–3 line summary.
> 3. **NO FULL FILE DUMPS**: Inspecting files >200 lines requires `context-mode` or sliced `read_file` / `view_file`.

These rules are mandatory for all AI agents working on this codebase to prevent runaway token spend and context bloat.

---

## 1. Discovery & Search: Codegraph First

- **Zero Grep Spam**: Never fire repetitive `grep_search` or `find_by_name` sweeps across the repository.
- **Mandatory `codegraph_explore`**: If `.codegraph/` exists, call `codegraph_explore` FIRST for:
  - Function/component definitions and implementations.
  - Callers, callees, and dependencies.
  - Architecture, flows, and blast radius.
- **Trust Results**: Do not re-grep or re-read what `codegraph_explore` returns.

---

## 2. Context Shielding & Sandbox Execution

- **Large File Handling (>200 lines)**: Use `context-mode` tools (`ctx_execute_file`, `ctx_execute`) to process files in the sandbox. Print ONLY the target lines or extracted values. Never dump raw multi-KB file bytes into conversation context.
- **Surgical View Slices**: When reading files, ALWAYS specify `StartLine` and `EndLine`. Never view entire 500+ line files when inspecting a single function.
- **Surgical Edits**: Use `edit_file` / `replace_file_content` with narrow line ranges. Never rewrite an entire file to change 5 lines.

---

## 3. Subagent Isolation for High-Entropy Tasks

- **Isolate Clutter**: When a task requires reading multiple diagnostic logs, evaluating documentation, or running multi-file exploratory scans, delegate to a read-only subagent (`invoke_subagent` with role `research` and `Model: "flash_lite"`).
- **Concise Return**: The subagent must return a terse 3–5 line finding. The raw diagnostic clutter stays inside the subagent workspace and never bloats main session context.

---

## 4. Model Offloading & Allowance (OpenRouter, Jev Suite & Ollama MCP)

- **Jev Intelligence Suite (`typesafe/jev-router`, $0/M)**:
  - `openrouter_jev_route`: Deterministically map phase objective to execution tier (`tier1_mechanical_flash`, `tier2_frontier_reasoning`, `subagent_flash`, `subagent_inherit`).
  - `openrouter_jev_guardrail`: Pre-screen risky commands (migrations, deletions, git mutations). Abort on `BLOCK`.
  - `openrouter_jev_compact_context` & `openrouter_jev_classify_failure`: Compress raw stack traces / test logs and classify failure root causes.
  - `openrouter_jev_detect_loop`: Detect repetitive 2-step error loops (`is_stuck: true`).
  - `openrouter_jev_oracle_bypass`: Gate whether a branch diff requires frontier adversarial audit.
  - `openrouter_jev_triage_request`, `openrouter_jev_filter_relevance`, `openrouter_jev_commit_triage`, `openrouter_jev_classify`: Fast zero-cost request triage, file relevance filtering, and commit sizing.
- **Tier 1 Mechanical Workhorse (`deepseek/deepseek-v4.1-flash`, ~$0.045/M prompt)**:
  - Use `openrouter_query` or `openrouter_code_refactor` for:
    - Drafting multi-language i18n translation dictionaries (`cs`, `vi`, `en`).
    - Generating mock test fixtures, schemas, and repetitive data boilerplate.
- **Phase 0 Fuzzing & Standard Diff Audit (`~deepseek/deepseek-pro-latest`, ~$0.093/M prompt)**:
  - Edge-case fuzzing before planning and standard UI/business logic diff audits.
- **Tier 2 Frontier Reasoning & Oracle (`openai/gpt-5.6-luna-pro`, ~$0.20/M prompt)**:
  - Use `openrouter_synthesize_tests` for boundary/negative test vectors.
  - Use `openrouter_accuracy_oracle` (`0.0` temp) to audit EET 2.0 cryptographic, SOAP XML, and financial math invariants.
- **Tier 3 Critical Gatekeeper (`anthropic/claude-sonnet-5.5`, ~$2.00/M prompt)**:
  - Final branch diff escalation exclusively when touching `backend/services/eet*`, VAT math, SQLite migrations, or refund logic.
- **Local Model Ingestion (Ollama / qwen3:8b)**:
  - Use `ollama_quick_query` (or `ollama_chat_with_tools`) for zero-cost local structured JSON extraction from unstructured text/logs without cloud roundtrips.

---

## 5. Anti-Looping & Intent Verification (Rule of Two)

- **Stop at 2**: If any build, test, lint, or command fails **twice** with the same or related error, **STOP IMMEDIATELY**.
- **No Guess-and-Check**: Never make a 3rd speculative edit hoping it compiles. Print the exact blocker, state hypothesis, and ask the user to verify intent.
- **Burst Cap**: Max 8 continuous tool operations per turn before pausing to report status and verify user direction.

---

## 6. Session Hygiene & Clear Signal

- **Context Snowball Prevention**: At the end of every completed feature, commit, or milestone, actively remind the user to run `/clear` or `/compact` before starting the next unrelated task.
- **Terse Communication**: Apply caveman compression to responses. Eliminate filler, decorations, and redundant apologies. Every token generated by the model is paid for.
