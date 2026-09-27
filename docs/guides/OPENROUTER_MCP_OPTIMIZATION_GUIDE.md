# OpenRouter MCP Optimization & Laptop Replication Guide

This guide details the tiered OpenRouter model setup and step-by-step instructions to replicate it across other devices (such as a laptop).

---

## 1. Model Tiering Summary

| Tier | Model ID | Cost (Prompt / Completion per 1M) | Context Limit | Target Workload |
|---|---|---|---|---|
| **Tier 1: Mechanical Workhorse** | `deepseek/deepseek-v4.1-flash` | **$0.035 / $0.29** | 1,048,576 | Boilerplate DTOs, i18n dictionaries, mock test fixtures, routine refactoring, happy-path/smoke tests |
| **Tier 2: Frontier Reasoning Oracle** | `openai/gpt-5.6-luna-pro` | **$0.20 / $1.20** | 1,050,000 | Negative & boundary test vector synthesis, `openrouter_accuracy_oracle` (invariant & race audits) |
| **Tier 3: Critical Gatekeeper** | `anthropic/claude-sonnet-4.6` | **$2.00 / $10.00** | 1,000,000 | Final Phase 4 branch diff audit exclusively on cryptographic, schema migration, or legal financial math |

---

## 2. Server Improvements in `mcp_openrouter_server.py`

1. **Reasoning Extraction Fix**: Captures `message.reasoning` / `message.reasoning_content` and falls back to reasoning if `content` is null. Ensures DeepSeek R1 and reasoning models function properly without returning null.
2. **Provider Failover**: Requests include `"provider": {"allow_fallbacks": True, "data_collection": "deny"}` to prevent single-host outages.
3. **Deterministic Temperature**: Default temperature set to `0.2` (or `0.0` for oracle).
4. **Dynamic Model Resolution**: Server checks `~/.gemini/config/mcp_config.json` dynamically for `OPENROUTER_MODEL`.
5. **Specialized Tools Added**:
   - `openrouter_accuracy_oracle`: Adversarial code auditor pinned to `openai/gpt-5.6-luna-pro` (0.0 temp) to cross-check Antigravity/Gemini decisions against domain invariants.
   - `openrouter_synthesize_tests`: Boundary/negative test generator with dynamic routing (`deepseek-v4.1-flash` for routine, `gpt-5.6-luna-pro` for boundaries).
   - `openrouter_code_refactor`: Defaults to `deepseek/deepseek-v4.1-flash` ($0.035/M) for 80% cost savings on routine code changes.

---

## 3. Laptop Device Setup Steps

### Step 1: Pull Git Updates
On your laptop, git pull the latest changes in `pos-project-himmel`:
```powershell
cd path\to\pos-project-himmel
git pull
```

### Step 2: Install Python MCP Dependencies
```powershell
pip install httpx pydantic mcp
```

### Step 3: Configure `~/.gemini/config/mcp_config.json`
Add or update the `openrouter` entry in `C:\Users\<user>\.gemini\config\mcp_config.json`:
```json
{
  "mcpServers": {
    "openrouter": {
      "command": "python",
      "args": [
        "C:\\path\\to\\pos-project-himmel\\mcp_openrouter_server.py"
      ],
      "env": {
        "OPENROUTER_MODEL": "openai/gpt-5.6-luna-pro",
        "OPENROUTER_API_KEY": "sk-or-v1-YOUR_KEY_HERE"
      },
      "trust": true
    }
  }
}
```

### Step 4: Export Antigravity MCP Tool Schemas
Run this one-liner from the directory containing `mcp_openrouter_server.py`:
```powershell
python -c "import sys, json, pathlib; from mcp_openrouter_server import mcp; import asyncio; tools = asyncio.run(mcp.list_tools()); dirs = [pathlib.Path.home() / '.gemini' / 'antigravity' / 'mcp' / 'openrouter', pathlib.Path.home() / '.gemini' / 'antigravity-ide' / 'mcp' / 'openrouter']; [d.mkdir(parents=True, exist_ok=True) for d in dirs]; [(d / f'{t.name}.json').write_text(json.dumps({'name': t.name, 'description': t.description, 'parameters': t.inputSchema}, indent=2), encoding='utf-8') for t in tools for d in dirs]; print('Exported', len(tools), 'tool schemas')"
```

### Step 5: Update Skills & Global Instructions
1. **`~/.gemini/config/skills/phase-auto/SKILL.md` & `phase-plan/SKILL.md`**:
   - Tier 1 Boilerplate: `deepseek/deepseek-v4.1-flash`.
   - Tier 2 Boundaries / Oracle: `openai/gpt-5.6-luna-pro`.
2. **`~/.gemini/GEMINI.md`**:
   - Ensure the `Phased Subagent Execution` section instructs offloading boilerplate to `deepseek/deepseek-v4.1-flash` and reserving `openai/gpt-5.6-luna-pro` for boundary synthesis and `openrouter_accuracy_oracle`.
