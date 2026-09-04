---
name: subagent-investigate
description: >-
  Use this skill whenever you need to explore multi-file references, search error traces,
  inspect logs, or evaluate libraries. Enforces delegating the exploratory workload to a
  low-cost flash_lite subagent to shield parent context.
---

# Subagent Investigation Runbook

When finding symbols across multiple files, reading diagnostic logs, or reviewing documentation:

## Step 1: Delegate via `invoke_subagent`
Spawn a low-cost subagent instead of firing multiple grep or view operations directly in the main thread:

```json
{
  "Subagents": [
    {
      "TypeName": "research",
      "Role": "Codebase Investigator",
      "Model": "flash_lite",
      "Prompt": "Investigate where <SYMBOL/BUG> is handled in <DIR>. Return ONLY a 3-5 line caveman summary with exact file:line references. Do not return long prose."
    }
  ]
}
```

## Step 2: Receive Compressed Output
The subagent executes the exploration in its isolated workspace and returns a concise, token-efficient summary.

## Step 3: Act Surgically
Read or edit ONLY the 1-2 files identified by the subagent using line-sliced `view_file` or `replace_file_content`.
