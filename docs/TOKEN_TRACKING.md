# Token Usage & Cloud Cost Tracking Guide

This guide documents the token tracking system for **Himmel POS**, including instructions for syncing across multiple devices or instructing an agent on another machine. For active measures preventing token bloat during development, see [Token Optimization & Context Shielding Measures](TOKEN_SAVING_MEASURES.md).

---

## 1. Quick Architecture Overview

- **Source of Data**: Antigravity agent transcripts stored locally in:
  - **Linux / macOS**: `~/.gemini/antigravity-cli/brain/`
  - **Windows**: `%USERPROFILE%\.gemini\antigravity\brain\` (and `conversations\*.db`)
- **Scripts**:
  - **Linux / macOS**: `python3 scripts/token_tracker.py <command>`
  - **Windows**: `python scripts/token_tracker_win.py <command>` (or `scripts\token_tracker_win.bat <command>`)
- **Commit Storage**: Attached to Git commit hashes via **Git Notes** (`refs/notes/tokens`).
  - Does *not* change commit hashes or dirty the git working tree.
  - Can be pushed/fetched across devices via git remote.
- **Hook**: `.git/hooks/post-commit` automatically records token metadata on every commit.

---

## 2. Instructions for AI Agent on the Other Device

If you are an agent on a new or secondary machine working on this repository, run the following setup:

### Step 1: Install Post-Commit Hook
For cross-platform compatibility (Linux, macOS, and Windows Git Bash):
```bash
cat << 'HOOK_EOF' > .git/hooks/post-commit
#!/bin/sh
if [ -f "scripts/token_tracker_win.py" ]; then
    python scripts/token_tracker_win.py commit HEAD
elif [ -f "scripts/token_tracker.py" ]; then
    python3 scripts/token_tracker.py commit HEAD 2>/dev/null || python scripts/token_tracker.py commit HEAD
fi
HOOK_EOF
chmod +x .git/hooks/post-commit
```

### Step 2: Fetch Existing Token Notes from Remote
Pull all token usage recorded by other devices:
```bash
python3 scripts/token_tracker.py sync pull
# Or: git fetch origin refs/notes/tokens:refs/notes/tokens
```

### Step 3: Backfill Any Untracked Local Commits
If this device produced commits that weren't tagged yet:
```bash
python3 scripts/token_tracker.py backfill all
```

### Step 4: Push Notes Back to Remote
```bash
python3 scripts/token_tracker.py sync push
# Or: git push origin refs/notes/tokens
```

---

## 3. Merging Logs Between Devices (Offline / Manual)

If you want the **lifetime** report to include uncommitted chat sessions or old sessions created on a different computer:

1. **Locate Antigravity Logs on Source Machine**:
   - **Linux / macOS**: `~/.gemini/antigravity-cli/brain/`
   - **Windows**: `C:\Users\<username>\.gemini\antigravity-cli\brain\`

2. **Copy to Target Machine**:
   Copy the `brain/` folder (or session UUID folders) into the repository root:
   ```
   pos-eet-himmel/.agent_logs/
   ```
   *(This directory is ignored by `.gitignore` and won't pollute git history).*

3. **Run Backfill or Lifetime Summary**:
   The script automatically indexes `.agent_logs/`:
   ```bash
   # Lifetime stats across both machines
   python3 scripts/token_tracker.py lifetime

   # Update commit notes with merged logs
   python3 scripts/token_tracker.py backfill all
   ```

---

## 4. Everyday Commands Reference

### View Full Project Lifetime Total
Shows complete tokens, model calls, and estimated cloud costs from day 1:
```bash
python3 scripts/token_tracker.py lifetime
python3 scripts/token_tracker.py lifetime --json
```

### Export & Update Summary Files
Regenerate lifetime JSON, commit summary JSON, and commit summary CSV in `docs/token_summaries/`:
```bash
# Windows (or double-click scripts\token_tracker_win.bat)
scripts\token_tracker_win.bat update

# Cross-platform Python
python scripts/token_tracker_win.py update
# Or on Linux/macOS:
python3 scripts/token_tracker.py update
```

Outputs are stored in `docs/token_summaries/`:
- `docs/token_summaries/token_usage_lifetime.json`
- `docs/token_summaries/token_usage_summary.json`
- `docs/token_summaries/token_usage_summary.csv`

### View Commits Breakdown
```bash
# View last 10 commits
python3 scripts/token_tracker.py summary -n 10

# View all commits with pagination
python3 scripts/token_tracker.py summary | less -S

# Export table to CSV directly to stdout
python3 scripts/token_tracker.py summary --csv > docs/token_summaries/token_usage_summary.csv
```

### Inspect Single Commit
```bash
python3 scripts/token_tracker.py show <commit_hash>
# Or latest commit:
python3 scripts/token_tracker.py show HEAD
```

### Push / Pull Notes with Remote
```bash
# Push newly recorded notes to GitHub / origin
python3 scripts/token_tracker.py sync push

# Pull notes from GitHub / origin
python3 scripts/token_tracker.py sync pull
```

---

## 5. Pricing Models Used

| Model | Cached Prompt (per 1M) | Uncached Prompt (per 1M) | Completion (per 1M) |
|---|---|---|---|
| **Gemini 3.5 / 3.8 Flash** | $0.07500 | $0.750 | $3.75 |
| **Claude 3.5 Sonnet** | $0.30000 | $3.000 | $15.00 |

*Note: In agentic loops, prompt caching hits ~85% of turns due to repetitive system prompt, tool schemas, and cumulative turn context.*
