# Linux Agent Setup Guide — Token Optimization & Context Shielding

This guide provides complete instructions to configure a **Linux device** with the identical token-saving agent architecture, hooks, system rules, MCP servers, and skills used on this desktop environment.

---

## Architecture Summary: What Saves Tokens

| Layer | Tool / Mechanism | Location | Token Savings Impact |
|---|---|---|---|
| **Orchestrator** | `tokless` CLI | `~/.local/bin/tokless` | Unifies RTK, Caveman, Ponytail, Codegraph, and Context-Mode across agents |
| **Output Interception** | `rtk` (PreToolUse) | `tokless rtk-hook agy` in `hooks.json` | 80–95% output reduction on test/lint/build terminal output |
| **Circuit Breakers** | Anti-Loop & Rule of Two | `~/.gemini/config/scripts/loop_detector.py` | Halts identical repeated tool calls (>=3) and repeated failed commands (>=2) |
| **Response Style** | Caveman Protocol | `~/.gemini/GEMINI.md` + `caveman_interceptor.py` | 60–65% reduction in assistant output tokens; intercepts `/caveman-stats` |
| **Build Discipline** | Ponytail Protocol | `~/.gemini/GEMINI.md` | Eliminates speculative code, boilerplate, and redundant libraries |
| **Code Index** | `codegraph` MCP | `codegraph serve --mcp` + `.codegraph/` | 1 AST lookup (`codegraph_explore`) replaces 10–15 grep/find/read cycles |
| **Large File Sandbox** | `context-mode` MCP | `context-mode` CLI | Files >200 lines executed in sandbox; raw bytes never enter chat context |
| **Subagent Tiering** | `subagent-investigate` | `.agents/skills/subagent-investigate` | Offloads research/grep loops to cheap `flash_lite` subagents |
| **Mechanical Offloading** | OpenRouter MCP bridge | `mcp_openrouter_server.py` | Offloads boilerplate/i18n/mocks to secondary quota (`gpt-oss-120b`) |

---

## Method 1: Turnkey Automated Setup (Recommended)

An automated setup script is included in this repository at [`scripts/tools/setup_linux_token_saving.sh`](file:///scripts/tools/setup_linux_token_saving.sh).

On your Linux device:

```bash
# 1. Install base prerequisites (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y curl git python3 python3-pip python3-venv nodejs npm ripgrep

# 2. Make script executable and run it
chmod +x scripts/tools/setup_linux_token_saving.sh
./scripts/tools/setup_linux_token_saving.sh /path/to/pos-project-himmel
```

The script automatically:
1. Installs `@colbymchenry/codegraph` and `context-mode` globally via `npm`.
2. Downloads and runs the official `tokless` installer (`curl -fsSL https://raw.githubusercontent.com/HoangP8/tokless/main/scripts/install.sh | bash`).
3. Runs `tokless --agents antigravity,claude,opencode`.
4. Creates `~/.gemini/` directories and writes `GEMINI.md`, `hooks.json`, `mcp_config.json`, `antigravity/mcp.json`.
5. Creates and permissions `loop_detector.py` and `caveman_interceptor.py`.
6. Installs skills `phase-auto` and `phase-plan`.
7. Runs `tokless doctor` to verify health.

---

## Method 2: Manual Step-by-Step Setup

### Step 1: System Packages

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y curl git python3 python3-pip python3-venv nodejs npm ripgrep

# Fedora / RHEL
sudo dnf install -y curl git python3 python3-pip nodejs npm ripgrep

# Arch Linux
sudo pacman -S curl git python python-pip nodejs npm ripgrep
```

Ensure Node.js is v18+ and Python is 3.10+.

---

### Step 2: Global CLI Tools (`codegraph`, `context-mode`)

```bash
# Optional: Configure user-level npm prefix if you don't want sudo npm
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"

# Install Codegraph (AST indexer) and Context-Mode (Sandbox executor)
npm install -g @colbymchenry/codegraph context-mode
```

---

### Step 3: Install `tokless` and Wire Agents

```bash
# Install tokless CLI
curl -fsSL https://raw.githubusercontent.com/HoangP8/tokless/main/scripts/install.sh | bash

# Add ~/.local/bin to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Wire all installed agents
tokless --agents antigravity,claude,opencode
```

---

### Step 4: Python Dependencies for MCP Servers

For the OpenRouter and Serena bridges:

```bash
pip3 install --user httpx pydantic mcp
# Or inside a project virtualenv:
# pip install httpx pydantic mcp serena
```

---

### Step 5: Configure Antigravity Global Settings

Create the required folder structure:

```bash
mkdir -p ~/.gemini/antigravity
mkdir -p ~/.gemini/config/scripts
mkdir -p ~/.gemini/config/skills/phase-auto
mkdir -p ~/.gemini/config/skills/phase-plan
mkdir -p ~/.gemini/config/skills/cavecrew
```

#### A. `~/.gemini/GEMINI.md` (System Instructions)

Create `~/.gemini/GEMINI.md` with:

```markdown
# Agent Instructions

Apply on every coding task:

- **Principles** — think, simplify, edit surgically, verify.
- **Grill-Me Protocol** — interview and challenge assumptions before non-trivial work.
- **Response Style (caveman)** — terse prose, full technical accuracy.
- **Build Discipline (ponytail)** — reuse first, write only what must exist.
- **Code Index (codegraph)** — one call for structure, flows, dependencies.
- **Context Tools (context-mode)** — keep raw bytes out, derive answers in-sandbox.
- **Phased Subagents (orchestration)** — auto-partition multi-step work into isolated subagent contexts.


## Principles

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Grill-Me Protocol

Conduct interactive interview before designing or modifying code for non-trivial tasks:

- **Trigger**: Multi-file changes, architectural decisions, new features, or underspecified requirements (>2 files or cross-stack).
- **Action**: Stop before planning or touching code. Ask 2–3 sharp, direct clarifying questions focusing on edge cases, data flows, tradeoffs, and failure modes.
- **Challenge assumptions**: Push back on vague requirements or over-engineered designs.
- **Bypass for trivial**: Skip interview for typos, obvious 1-file fixes, small surgical edits, or explicit user override.

## Response Style (caveman)

Respond terse like smart caveman. All technical substance stay. Only fluff die.

- Drop articles (a/an/the), filler (just/really/basically), pleasantries, hedging, repeated qualifiers, decorative tables/emoji, tool-call narration.
- Keep fragments OK, short synonyms, standard acronyms, user's language. Technical terms exact. Code, commands, paths, API names, commit keywords, exact error strings — verbatim. Never invent unclear abbreviations.
- Normal prose for security warnings, irreversible actions, ambiguous step order, user clarification. Resume terse after.

Pattern: `[thing] [action]. [reason]. [next step].`
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

## Build Discipline (ponytail)

Lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Stop at the first rung that holds, after you understand the problem and trace real flow:

1. Does this need to exist at all? Speculative need = skip it. (YAGNI)
2. Already in this codebase? Reuse the helper, util, type, or pattern. Look before writing.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it: CSS over JS, DB constraint over app code.
5. Already-installed dependency solves it? Use it. Never add one for what a few lines can do.
6. Can it be one line? One line.
7. Only then: minimum code that works.

Bug fix = root cause, not symptom. Check callers of the function you touch; fix the shared path once.

Rules:
- No unrequested abstractions, boilerplate, scaffolding, or avoidable dependencies.
- Deletion over addition. Boring over clever. Fewest files possible, but only after choosing the right place.
- Complex request? Ship the lazy version and question the bigger one in the same response. Never stall.
- Same-size stdlib options? Pick the one correct on edge cases.
- Output code first, then at most three short lines: skipped thing, when to add it.
- Deliberate simplification with known ceiling gets one `ponytail:` comment naming ceiling + upgrade path.

## Code Index (codegraph)

Prebuilt code index. `codegraph_explore` gives source, call path, and blast radius in one call.

```
.codegraph/ index exists?
├─ YES → codegraph_explore FIRST. Always. Source + blast radius + call path
│        in ONE call.
│        ├─ Use for: how does X work, flow A→B, architecture, who calls Y,
│        │   blast radius, subsystem structure, where is X, reading a file.
│        ├─ grep/search/read ONLY for non-code codegraph doesn't index
│        │   (configs, docs, .env) — AFTER codegraph narrows it down,
│        │   never as the first move.
│        └─ Trust results — full AST parse, safe to edit from. NO re-grep,
│           NO re-search, NO re-read of what codegraph returned. Spilled?
│           grep the spill for the symbol you NEED — do NOT Read/View whole.
│           ONE call beats dozens of grep+search+Read.
└─ NO  → work normal (read / grep / ast_grep). Don't call codegraph.
```

## Context Tools (context-mode)

Sandbox-first tools. Derive answers. Keep raw bytes out, print only needed results.

```
Use ctx?
├─ YES → source >~200 lines/KB, multi-source, or worth re-querying → prioritize ctx tools
└─ NO  → small file, single section, or verbatim-read for editing → Read directly
```

| Tool | Role | Replaces |
|------|------|----------|
| `ctx_execute` | Run code in sandbox. Only stdout enters context. | Bash for analysis tasks |
| `ctx_execute_file` | Process file in sandbox. Raw bytes never leave. | Read on large files (>200 lines) |
| `ctx_batch_execute` | Run N commands + auto-index output. Search in same call. Concurrency 1-8. | Multiple Bash + grep |
| `ctx_index` | Chunk markdown/text into FTS5. Queryable via `ctx_search`. | Manual grep over pasted content |
| `ctx_search` | Multi-strategy search across indexed content + session memory. Typo correction. | Re-asking user, re-deriving |
| `ctx_fetch_and_index` | Fetch URL → markdown → index. Cache 24h (override `ttl`). Batch with `requests`+`concurrency`. | WebFetch + re-read |

## Phased Subagent Execution (orchestration)

For non-trivial multi-phase tasks:
- **Auto-Phasing**: Partition tasks into sequential phases. Never output manual prompt blocks for user to run.
- **Context Isolation**: Run each phase in its own clean context via `invoke_subagent` (`TypeName: "self"`, `Workspace: "inherit"`).
- **OpenRouter Delegation**: Offload mechanical boilerplate, mock fixtures, i18n dictionaries, and simple refactors to OpenRouter MCP (`openrouter_query` / `openrouter_code_refactor`) when available.
- **Sequential Gate**: Verify phase outputs before invoking next phase subagent. Report final summary when complete.
```

---

#### B. `~/.gemini/config/hooks.json`

Create `~/.gemini/config/hooks.json`:

```json
{
  "rtk": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "tokless rtk-hook agy",
            "timeout": 10
          }
        ]
      }
    ]
  },
  "loop-detector": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.gemini/config/scripts/loop_detector.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "tokless-codegraph-index": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "tokless agy-hook codegraph-index",
            "timeout": 120
          }
        ]
      }
    ],
    "PreInvocation": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "tokless agy-hook codegraph-index",
            "timeout": 120
          }
        ]
      }
    ]
  },
  "caveman-interceptor": {
    "PreInvocation": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.gemini/config/scripts/caveman_interceptor.py",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

#### C. `~/.gemini/config/scripts/loop_detector.py`

Create `~/.gemini/config/scripts/loop_detector.py` and run `chmod +x ~/.gemini/config/scripts/loop_detector.py`:

```python
#!/usr/bin/env python3
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

def fail_open():
    print(json.dumps({"decision": "allow"}))
    sys.exit(0)

def block(reason: str):
    print(json.dumps({
        "decision": "deny",
        "reason": reason
    }))
    sys.exit(0)

def normalize_command(cmd: str) -> str:
    if not isinstance(cmd, str):
        return ""
    s = cmd.strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    return s

def check_consecutive_command_failures(transcript_path: str, command_line: str) -> int:
    if not transcript_path or not os.path.exists(transcript_path):
        return 0
    norm_target = normalize_command(command_line)
    if not norm_target:
        return 0

    try:
        with open(transcript_path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            seek_pos = max(0, size - 65536)
            f.seek(seek_pos)
            lines = f.read().decode("utf-8", errors="ignore").splitlines()

        steps = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                steps.append(json.loads(line))
            except Exception:
                continue

        consecutive_failures = 0
        for i in range(len(steps) - 1, -1, -1):
            step = steps[i]
            if step.get("type") == "GENERIC" or "content" in step:
                content = step.get("content") or ""
                if i > 0:
                    prev_step = steps[i - 1]
                    for tc in prev_step.get("tool_calls") or []:
                        if tc.get("name") == "run_command":
                            cmd_arg = tc.get("args", {}).get("CommandLine", "")
                            if normalize_command(cmd_arg) == norm_target:
                                is_failure = step.get("status") == "ERROR" or ("The command exited with code " in content and "The command exited with code 0" not in content)
                                if is_failure:
                                    consecutive_failures += 1
                                else:
                                    return consecutive_failures
                                if consecutive_failures >= 2:
                                    return consecutive_failures
        return consecutive_failures
    except Exception:
        return 0

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            fail_open()

        data = json.loads(raw_input)
        tool_call = data.get("toolCall") or {}
        tool_name = tool_call.get("name") or ""
        args = tool_call.get("args") or {}
        conversation_id = data.get("conversationId") or "global"
        transcript_path = data.get("transcriptPath")

        if not tool_name:
            fail_open()

        cache_dir = Path(tempfile.gettempdir()) / "antigravity_loop_detector"
        cache_dir.mkdir(parents=True, exist_ok=True)
        state_file = cache_dir / f"{conversation_id}.json"

        state = {}
        if state_file.exists():
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state = json.load(f)
            except Exception:
                state = {}

        args_str = json.dumps(args, sort_keys=True)
        current_hash = hashlib.sha256(args_str.encode("utf-8")).hexdigest()

        last_tool = state.get("last_tool")
        last_hash = state.get("last_hash")
        identical_count = state.get("identical_count", 0)

        if tool_name == last_tool and current_hash == last_hash:
            identical_count += 1
        else:
            identical_count = 1

        command_line = ""
        command_failures = 0
        if tool_name == "run_command":
            command_line = args.get("CommandLine", "")
            if transcript_path:
                command_failures = check_consecutive_command_failures(transcript_path, command_line)

        state["last_tool"] = tool_name
        state["last_hash"] = current_hash
        state["identical_count"] = identical_count
        try:
            with open(state_file, "w", encoding="utf-8") as fe:
                json.dump(state, fe)
        except Exception:
            pass

        if tool_name == "run_command" and command_failures >= 2:
            clean_cmd = normalize_command(command_line)
            block(
                f"Rule of Two circuit breaker: Command '{clean_cmd}' failed {command_failures} times consecutively. Stop speculative retries and ask user for clarification or change approach."
            )

        if identical_count >= 3:
            block(
                f"Loop detected: Tool '{tool_name}' invoked {identical_count} times consecutively with identical arguments. Anti-loop circuit breaker tripped. Stop repetitive tool calls and report to user."
            )

        fail_open()

    except Exception:
        fail_open()

if __name__ == "__main__":
    main()
```

---

#### D. `~/.gemini/config/scripts/caveman_interceptor.py`

Create `~/.gemini/config/scripts/caveman_interceptor.py` and run `chmod +x ~/.gemini/config/scripts/caveman_interceptor.py`:

```python
#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

CONFIG_DIR = Path(os.path.expanduser("~")) / ".gemini" / "config"
FLAG_FILE = CONFIG_DIR / ".caveman-active"

SAVINGS_RATIOS = {
    "lite": 0.40,
    "full": 0.65,
    "ultra": 0.72,
    "wenyan-lite": 0.50,
    "wenyan": 0.80,
    "wenyan-full": 0.80,
    "wenyan-ultra": 0.85,
}

def get_active_mode() -> str:
    try:
        if FLAG_FILE.exists():
            mode = FLAG_FILE.read_text(encoding="utf-8").strip().lower()
            if mode:
                return mode
    except Exception:
        pass
    return "full"

def set_active_mode(mode: str) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        FLAG_FILE.write_text(mode, encoding="utf-8")
    except Exception:
        pass

def parse_transcript(transcript_path: str):
    turns = 0
    model_output_chars = 0
    last_user_prompt = ""

    if not transcript_path or not os.path.exists(transcript_path):
        return turns, model_output_chars, last_user_prompt

    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    continue

                step_type = entry.get("type")
                if step_type == "USER_INPUT":
                    turns += 1
                    content = entry.get("content", "")
                    m = re.search(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", content, re.DOTALL)
                    if m:
                        last_user_prompt = m.group(1).strip()
                    else:
                        last_user_prompt = content.strip()
                elif step_type == "PLANNER_RESPONSE":
                    content = entry.get("content", "")
                    model_output_chars += len(content)
    except Exception:
        pass

    return turns, model_output_chars, last_user_prompt

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({"injectSteps": []}))
            return

        payload = json.loads(raw_input)
        transcript_path = payload.get("transcriptPath", "")
        conversation_id = payload.get("conversationId", "current-session")

        turns, model_chars, last_user_prompt = parse_transcript(transcript_path)
        prompt_lower = last_user_prompt.lower()

        if "/caveman-stats" in prompt_lower or prompt_lower.startswith("caveman stats"):
            mode = get_active_mode()
            ratio = SAVINGS_RATIOS.get(mode, 0.65)
            est_output_tokens = max(1, model_chars // 4)
            est_uncompressed_tokens = int(est_output_tokens / (1.0 - ratio))
            est_tokens_saved = est_uncompressed_tokens - est_output_tokens

            stats_msg = (
                "[CAVEMAN-STATS AUTO-INTERCEPT]\n"
                "User requested /caveman-stats. Deliver these exact pre-calculated session stats:\n\n"
                "----------------------------------\n"
                "Caveman Session Stats (Antigravity)\n"
                "----------------------------------\n"
                f"Session:               {conversation_id[:12]}...\n"
                f"User Turns:            {turns}\n"
                f"Active Mode:           {mode}\n"
                "----------------------------------\n"
                f"Est. Output Tokens:    ~{est_output_tokens:,}\n"
                f"Est. Without Caveman:  ~{est_uncompressed_tokens:,}\n"
                f"Est. Tokens Saved:     ~{est_tokens_saved:,} (~{int(ratio * 100)}% output reduction)\n"
                "----------------------------------\n"
                "Tip: Run /clear between tasks to wipe accumulated context history.\n"
            )

            print(json.dumps({
                "injectSteps": [
                    {
                        "ephemeralMessage": stats_msg
                    }
                ]
            }, ensure_ascii=True))
            return

        m = re.search(r"^/caveman(?:\s+([a-zA-Z\-]+))?", prompt_lower)
        if m:
            arg = m.group(1)
            new_mode = arg.strip() if arg else "full"
            if new_mode in ["stop", "normal", "exit"]:
                new_mode = "off"

            set_active_mode(new_mode)
            notice = f"[CAVEMAN INTERCEPTOR]: Mode set to '{new_mode}'. Follow {new_mode} guidelines strictly."
            print(json.dumps({
                "injectSteps": [
                    {
                        "ephemeralMessage": notice
                    }
                ]
            }))
            return

        print(json.dumps({"injectSteps": []}))

    except Exception:
        print(json.dumps({"injectSteps": []}))

if __name__ == "__main__":
    main()
```

---

#### E. `~/.gemini/config/mcp_config.json` (MCP Configuration)

Create `~/.gemini/config/mcp_config.json` (replace `/path/to/pos-project-himmel` with your actual repo location):

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--project",
        "/path/to/pos-project-himmel"
      ],
      "trust": true
    },
    "codegraph": {
      "command": "codegraph",
      "args": [
        "serve",
        "--mcp"
      ],
      "trust": true
    },
    "context-mode": {
      "command": "context-mode",
      "args": [],
      "trust": true
    },
    "ollama": {
      "command": "python3",
      "args": [
        "/path/to/pos-project-himmel/mcp_ollama_server.py"
      ],
      "env": {
        "OLLAMA_HOST": "http://127.0.0.1:11434",
        "OLLAMA_MODEL": "qwen3:8b"
      },
      "trust": true
    },
    "openrouter": {
      "command": "python3",
      "args": [
        "/path/to/pos-project-himmel/mcp_openrouter_server.py"
      ],
      "env": {
        "OPENROUTER_MODEL": "openai/gpt-oss-120b",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}"
      },
      "trust": true
    }
  }
}
```

---

#### F. `~/.gemini/antigravity/mcp.json` (Antigravity Root MCP)

```json
{
  "mcpServers": {
    "serena": {
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--project",
        "/path/to/pos-project-himmel"
      ],
      "env": {}
    },
    "tokless": {
      "command": "npx",
      "args": [
        "-y",
        "tokless",
        "mcp"
      ],
      "env": {}
    },
    "openrouter": {
      "command": "python3",
      "args": [
        "/path/to/pos-project-himmel/mcp_openrouter_server.py"
      ],
      "env": {
        "OPENROUTER_MODEL": "openai/gpt-oss-120b",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}"
      }
    }
  }
}
```

---

## Repository Initialization on Linux

When cloning the repository on Linux:

```bash
cd pos-project-himmel

# 1. Build initial Codegraph AST index (crucial for zero-grep token efficiency)
tokless index
# or: codegraph init

# 2. Check and verify pre-command hook permissions
chmod +x scripts/tools/pre_command_hook.py
chmod +x scripts/token_tracker.py

# 3. Export OpenRouter API key in ~/.bashrc or .env
export OPENROUTER_API_KEY="your-sk-or-key"
```

---

## Verification & Health Check

Run the following checks on the Linux device:

```bash
# Check tokless wiring across agents
tokless doctor

# Verify output:
# +- Agents
# |   v Claude Code   all tools wired
# |   v OpenCode      all tools wired
# |   v Antigravity   all tools wired
# +- Tools
# |   v rtk           v0.48.0
# |   v caveman       vbin-v1.1.6
# |   v codegraph     v1.6.0
# |   v context-mode  v1.0.169
# |   v ponytail      v4.9.0

# Verify Codegraph MCP
codegraph --version

# Test PreToolUse hook
python3 ~/.gemini/config/scripts/loop_detector.py << 'EOF'
{"toolCall": {"name": "run_command", "args": {"CommandLine": "git status"}}, "conversationId": "test"}
EOF
# Expected output: {"decision": "allow"}
```
