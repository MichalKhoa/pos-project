# Token Optimization & Context Shielding Measures — Himmel POS

This document details all structural, automated, and behavioral measures implemented in the **Himmel POS** project to minimize LLM token consumption, eliminate context bloat, and prevent runaway API costs.

---

## 1. System Architecture Overview

Token optimization in this repository operates at four distinct layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. Automated Interception Layer (Hooks & CLI wrappers) │
│    - PreToolUse hook (tokless-enforcer, RTK rewriting)  │
│    - Git post-commit token tracker                      │
├────────────────────────────────────────────────────────┤
│ 2. Subagent & Model Tiering Layer (Skills)             │
│    - subagent-investigate (flash_lite isolation)        │
│    - cavecrew / caveman compression                     │
├────────────────────────────────────────────────────────┤
│ 3. Tool & Sandbox Discipline Layer                     │
│    - Codegraph AST exploration first                   │
│    - context-mode sandbox execution (>200 lines)        │
│    - Surgical sliced view_file & replace_file_content   │
├────────────────────────────────────────────────────────┤
│ 4. Behavioral & Prompting Governance (Rules)           │
│    - The 50% Rule & /clear lifecycle                   │
│    - Rule of Two (anti-looping circuit breaker)         │
│    - Serena domain memory caching                      │
│    - Phased multi-conversation task decomposition       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Automated Interception & Hooks Layer

### A. PreToolUse Hook: `tokless-enforcer`
- **Config**: [`.agents/hooks.json`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/.agents/hooks.json)
- **Script**: [`scripts/tools/pre_command_hook.py`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/scripts/tools/pre_command_hook.py)
- **Mechanism**: Intercepts all `run_command` tool calls before execution in the shell.
- **Actions**:
  1. **Enforces `| tokless`**: Detects heavy build/test/lint commands (`npm test`, `npm run lint`, `npm run build`, `python -m unittest`, `pytest`, `cargo test/build`, `oxlint`, `eslint`, `vitest`) and forcibly appends `| tokless`. This truncates voluminous test/build outputs, compressing terminal feedback by 80–95%.
  2. **Rewrites Git Output to RTK**: Automatically rewrites `git diff` and `git log` commands to `rtk git diff` / `rtk git log`. This uses the Rust Token Killer (RTK) CLI to strip decorative diff banners and metadata, returning only compact changed lines.

### B. Post-Commit Hook: Token Tracking System
- **Guide**: [`docs/TOKEN_TRACKING.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/docs/TOKEN_TRACKING.md)
- **Scripts**: [`scripts/token_tracker.py`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/scripts/token_tracker.py) & [`scripts/token_tracker_win.py`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/scripts/token_tracker_win.py)
- **Mechanism**: Attaches exact token spend metadata directly to Git commits using **Git Notes** (`refs/notes/tokens`), avoiding dirty working tree changes while enabling cross-machine cost auditing and prompt caching ratio analysis.

---

## 3. Agent Skills & Model Tiering

### A. `subagent-investigate` Skill
- **Path**: [`.agents/skills/subagent-investigate/SKILL.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/.agents/skills/subagent-investigate/SKILL.md)
- **Rule**: Whenever multi-file symbol tracing, error log analysis, or doc lookups are required, the agent **must not** run repeated searches in the main chat.
- **Execution**: Spawns an isolated `flash_lite` subagent (`TypeName: "research"`, `Model: "flash_lite"`). The subagent does all the messy reading and grep operations in an isolated context, then returns a compressed **3–5 line summary** with exact `file:line` locations back to the parent.
- **Context Saved**: Keeps thousands of tokens of diagnostic search noise completely out of the primary session.

### B. Caveman Compression Suite
- **Skills**: `caveman`, `cavecrew`, `caveman-commit`, `caveman-compress`
- **Output Compression**: Employs terse, high-density syntax ("caveman mode"). Eliminates conversational fluff, repeated qualifiers, polite filler, and Markdown decoration while retaining 100% of technical precision, symbols, paths, and code.
- **Subagent Ingestion**: `cavecrew` subagents return compressed findings that reduce tool-result tokens in parent memory by ~60%.
- **Memory Compression**: `caveman-compress` shrinks static markdown instructions and guidelines to reduce the base system prompt payload.

---

## 4. Tool & Sandbox Discipline Layer

### A. Code Index First (`codegraph_explore`)
- **Index**: `.codegraph/` prebuilt AST graph.
- **Rule**: Never run broad blanket `grep_search` or `find_by_name` across the entire repo. Call `codegraph_explore` first.
- **Impact**: In a single tool call, returns the symbol definition, callers, callees, and architectural blast radius. Replaces 10–15 round-trip search and view commands.
- **No-Repeat Guarantee**: Explicit instruction prevents agents from re-reading or re-grepping what Codegraph already parsed.

### B. `context-mode` Sandbox Execution (>200 lines)
- **Tools**: `ctx_execute_file`, `ctx_execute`, `ctx_batch_execute`, `ctx_index`, `ctx_search`
- **Rule**: Any file exceeding ~200 lines must be inspected in-sandbox.
- **Mechanism**: Executes Python/Node scripts inside an isolated execution container to extract specifically targeted values, counts, or matching lines. Only the computed standard output enters the LLM context, keeping multi-KB raw file bytes out of chat history.

### C. Surgical Slicing & Line-Bounded Edits
- **`view_file`**: Always requires `StartLine` and `EndLine` to read only the targeted function or block. Full-file reads on multi-hundred line files are banned.
- **`replace_file_content`**: Edits are bounded strictly to the contiguous modified chunk. Rewriting entire files for small logic tweaks is prohibited.

---

## 5. Behavioral & Workflow Governance (Rules)

Defined in [`AGENTS.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/AGENTS.md), [`.agents/rules/token_discipline.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/.agents/rules/token_discipline.md), and [`.agents/rules/planning.md`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/.agents/rules/planning.md):

### A. The 50% Rule & Session Clearing
- When conversation history grows long or nears context capacity, the agent must pause, summarize active work and state handoff into `.serena/memories/`, and instruct the user to run `/clear`.
- Prevents the "context snowball effect" where every turn re-processes an enormous backlog of historical conversation turns.

### B. Multi-Phase Decomposition & Fresh Chat Prompts
- Any feature touching >2 files or crossing stack boundaries (Frontend React + Backend FastAPI) must be broken into sequential phases.
- **Strict Planning Chat Boundary**: The planning conversation strictly outputs `implementation_plan.md` and records handoff state. The agent does not execute code in that session; instead, it provides a standalone, copy-pasteable prompt for the user to launch Phase 1 in a brand-new conversation with zero prior turn bloat.

### C. Anti-Looping Circuit Breaker (Rule of Two)
- If any build, lint, test, or run fails **twice** with the same or related error, the agent must **STOP IMMEDIATELY**.
- Eliminates the common failure mode where an agent makes 5–10 speculative, token-expensive guess edits in a loop.

### D. Tool Burst Cap
- Hard cap of **8 continuous tool operations** per turn. The agent must pause, report state, and verify user intent before making more tool calls.

### E. Persistent Domain Memories (`.serena/memories/`)
- Persistent knowledge base storing architectural facts, database models, EET signing specifications, hardware interfaces, and audit records.
- Agents update and read `.serena/memories/` directly, preventing repeated re-exploration of established architecture across sessions.

### F. Ponytail Build Discipline ("Reuse First")
- Prioritizes existing helpers (`src/utils/`, `src/hooks/`, `backend/services/`), standard library utilities, and native platform features over importing or writing new abstractions.
- Eliminates speculative code, single-use abstractions, and unneeded dependencies.

---

## 6. Summary Matrix

| Category | Measure | Implementation / Tool | Impact |
|---|---|---|---|
| **Terminal / CLI** | Output truncation | `tokless-enforcer` hook (`pre_command_hook.py`) | 80–95% reduction in build/test output tokens |
| **Terminal / CLI** | Compact Git diffs | RTK rewriting in `pre_command_hook.py` | Eliminates raw diff boilerplate |
| **Model Routing** | Subagent tiering | `subagent-investigate` with `flash_lite` | Moves exploration noise to low-cost ephemeral context |
| **Output Style** | Caveman compression | `caveman`, `cavecrew`, `caveman-commit` | ~60–65% reduction in assistant output tokens |
| **Code Search** | Prebuilt AST indexing | `codegraph_explore` | 1 tool call replaces 10+ grep/find operations |
| **File Reading** | Sandbox data extraction | `context-mode` (`ctx_execute_file`) | Raw multi-KB files never enter chat context |
| **File Reading** | Line slicing | `view_file` (`StartLine`/`EndLine`) | Prevents full file dumps |
| **Workflow** | Context cap | 50% Rule + `/clear` prompt | Stops cumulative token snowballing |
| **Workflow** | Anti-looping | Rule of Two | Caps failed debug loops at 2 iterations |
| **Workflow** | Conversation partitioning | `implementation_plan.md` fresh chat prompts | Keeps execution sessions short and token-lean |
| **Knowledge Base** | Architecture caching | `.serena/memories/` | Eliminates repeat codebase scanning |
