#!/usr/bin/env python3
"""
Token Usage & Cost Tracker for Agent Workflows.
Reads Antigravity agent transcripts, associates token usage with git commits,
and stores usage metadata in Git Notes (refs/notes/tokens).
Supports cross-device sync and multi-device log directories.
"""

import sys
import os
import glob
import json
import shutil
import subprocess
from datetime import datetime

BASE_SYSTEM_TOKENS = 6000  # Avg system prompt + schema overhead per call

# Pricing models (per 1,000,000 tokens)
# Gemini 3.5 / 3.8 Flash: Cache Read: $0.075, Uncached In: $0.75, Out: $3.75
FLASH_IN_UNCACHED = 0.75 / 1_000_000
FLASH_IN_CACHED   = 0.075 / 1_000_000
FLASH_OUT         = 3.75 / 1_000_000

# Claude 3.5 Sonnet: Cache Read: $0.30, Uncached In: $3.00, Out: $15.00
SONNET_IN_UNCACHED = 3.00 / 1_000_000
SONNET_IN_CACHED   = 0.30 / 1_000_000
SONNET_OUT         = 15.00 / 1_000_000


def get_repo_path():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return os.getcwd()


def get_matching_conversation_ids(repo_path, custom_logs_dir=None):
    """Finds conversation IDs that belong to the current repo workspace."""
    matched = set()
    repo_name = os.path.basename(repo_path)

    # 1. history.jsonl
    hist_candidates = [
        os.path.expanduser("~/.gemini/antigravity-cli/history.jsonl"),
    ]
    if custom_logs_dir:
        hist_candidates.append(os.path.join(custom_logs_dir, "history.jsonl"))

    for hist_path in hist_candidates:
        if os.path.exists(hist_path):
            with open(hist_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    try:
                        d = json.loads(line)
                        ws = str(d.get("workspace", ""))
                        cid = d.get("conversationId")
                        if cid and (repo_path in ws or ws in repo_path or repo_name in ws):
                            matched.add(cid)
                    except Exception:
                        pass

    # 2. conversation_summaries.db
    db_candidates = [
        os.path.expanduser("~/.gemini/antigravity-cli/conversation_summaries.db"),
    ]
    if custom_logs_dir:
        db_candidates.append(os.path.join(custom_logs_dir, "conversation_summaries.db"))

    for db_path in db_candidates:
        if os.path.exists(db_path):
            try:
                import sqlite3
                con = sqlite3.connect(db_path)
                rows = con.execute("SELECT conversation_id, workspace_uris FROM conversation_summaries").fetchall()
                for cid, uris in rows:
                    if cid and (repo_path in uris or repo_name in uris):
                        matched.add(cid)
                con.close()
            except Exception:
                pass

    return matched


def find_transcript_paths(conv_ids, custom_logs_dir=None):
    """Finds transcript_full.jsonl files across local and custom directories."""
    paths = []
    search_dirs = [
        os.path.expanduser("~/.gemini/antigravity-cli/brain"),
        os.path.join(get_repo_path(), ".agent_logs"),
    ]
    if custom_logs_dir:
        search_dirs.append(custom_logs_dir)
        search_dirs.append(os.path.join(custom_logs_dir, "brain"))

    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for cid in conv_ids:
            p = os.path.join(sdir, cid, ".system_generated", "logs", "transcript_full.jsonl")
            if os.path.exists(p) and p not in paths:
                paths.append(p)
        # Also include any transcript_full.jsonl directly placed in explicit custom directories
        if sdir != os.path.expanduser("~/.gemini/antigravity-cli/brain"):
            for p in glob.glob(os.path.join(sdir, "**", "transcript_full.jsonl"), recursive=True):
                if p not in paths:
                    paths.append(p)

    return paths


def load_all_conversation_turns(conv_ids, custom_logs_dir=None):
    turns = []
    paths = find_transcript_paths(conv_ids, custom_logs_dir)

    for tpath in paths:
        cum_chars = 0
        with open(tpath, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    d = json.loads(line)
                    created = d.get("created_at")
                    if not created:
                        continue
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    ts = int(dt.timestamp())

                    src = d.get("source")
                    stype = d.get("type")

                    content_len = len(json.dumps(d.get("content", "")))
                    calls_len = len(json.dumps(d.get("tool_calls", "")))
                    think_len = len(json.dumps(d.get("thinking", "")))
                    step_chars = content_len + calls_len + think_len

                    # Only genuine model generations (PLANNER_RESPONSE) are LLM API invocations.
                    # Tool results (VIEW_FILE, RUN_COMMAND, GENERIC, etc.) are tool outputs, NOT model calls.
                    if src == "MODEL" and stype == "PLANNER_RESPONSE":
                        turn_in = BASE_SYSTEM_TOKENS + (cum_chars // 4)
                        out_chars = calls_len + think_len + (content_len if d.get("content") else 0)
                        turn_out = out_chars // 4
                        turns.append((ts, turn_in, turn_out))

                    cum_chars += step_chars
                except Exception:
                    pass

    turns.sort(key=lambda x: x[0])
    return turns


def compute_turn_stats(turns_in_window):
    total_prompt = sum(t[1] for t in turns_in_window)
    total_output = sum(t[2] for t in turns_in_window)
    model_calls = len(turns_in_window)

    cached_prompt = int(total_prompt * 0.85)
    uncached_prompt = total_prompt - cached_prompt

    cost_flash = (cached_prompt * FLASH_IN_CACHED) + (uncached_prompt * FLASH_IN_UNCACHED) + (total_output * FLASH_OUT)
    cost_sonnet = (cached_prompt * SONNET_IN_CACHED) + (uncached_prompt * SONNET_IN_UNCACHED) + (total_output * SONNET_OUT)

    return {
        "model_calls": model_calls,
        "prompt_tokens": total_prompt,
        "output_tokens": total_output,
        "total_tokens": total_prompt + total_output,
        "est_flash_usd": round(cost_flash, 4),
        "est_sonnet_usd": round(cost_sonnet, 4),
    }


def record_commit(commit_ref="HEAD", custom_logs_dir=None):
    repo_path = get_repo_path()
    try:
        commit_hash = subprocess.check_output(
            ["git", "rev-parse", commit_ref], stderr=subprocess.DEVNULL
        ).decode().strip()
        commit_ts = int(subprocess.check_output(
            ["git", "log", "-1", "--format=%ct", commit_hash], stderr=subprocess.DEVNULL
        ).decode().strip())
    except Exception as e:
        print(f"Failed to resolve commit {commit_ref}: {e}")
        return

    try:
        prev_ts = int(subprocess.check_output(
            ["git", "log", "-1", "--format=%ct", f"{commit_hash}^"], stderr=subprocess.DEVNULL
        ).decode().strip())
    except Exception:
        prev_ts = commit_ts - 86400

    conv_ids = get_matching_conversation_ids(repo_path, custom_logs_dir)
    all_turns = load_all_conversation_turns(conv_ids, custom_logs_dir)
    turns_in_window = [t for t in all_turns if prev_ts < t[0] <= commit_ts]
    stats = compute_turn_stats(turns_in_window)

    note_data = {
        "commit": commit_hash,
        "timestamp": commit_ts,
        **stats
    }

    subprocess.run(
        ["git", "notes", "--ref=tokens", "add", "-f", "-m", json.dumps(note_data), commit_hash],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    print(
        f"Token Note [{commit_hash[:7]}]: "
        f"Calls: {stats['model_calls']} | "
        f"Prompt: {stats['prompt_tokens']:,} | "
        f"Out: {stats['output_tokens']:,} | "
        f"Flash: ${stats['est_flash_usd']:.4f} | "
        f"Sonnet: ${stats['est_sonnet_usd']:.4f}"
    )


def backfill_all(limit=None, custom_logs_dir=None):
    repo_path = get_repo_path()
    print("Loading agent logs and git history...")
    conv_ids = get_matching_conversation_ids(repo_path, custom_logs_dir)
    all_turns = load_all_conversation_turns(conv_ids, custom_logs_dir)

    cmd = ["git", "log", "--reverse", "--format=%H %ct"]
    raw_commits = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip().splitlines()
    commits = []
    for line in raw_commits:
        parts = line.split()
        if len(parts) == 2:
            commits.append((parts[0], int(parts[1])))

    if limit and limit < len(commits):
        commits = commits[-limit:]

    updated_count = 0
    total_calls_all = 0

    for i, (commit_hash, commit_ts) in enumerate(commits):
        prev_ts = commits[i - 1][1] if i > 0 else (commit_ts - 86400)
        turns_in_window = [t for t in all_turns if prev_ts < t[0] <= commit_ts]

        if not turns_in_window and i > 0:
            continue

        stats = compute_turn_stats(turns_in_window)
        if stats["model_calls"] == 0:
            continue

        note_data = {
            "commit": commit_hash,
            "timestamp": commit_ts,
            **stats
        }

        subprocess.run(
            ["git", "notes", "--ref=tokens", "add", "-f", "-m", json.dumps(note_data), commit_hash],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        updated_count += 1
        total_calls_all += stats["model_calls"]

    print(f"Backfill complete: recorded token notes on {updated_count} commits ({total_calls_all:,} total model calls).")


def get_all_note_entries():
    try:
        out = subprocess.check_output(
            ["git", "notes", "--ref=tokens", "list"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return []

    if not out:
        return []

    lines = out.splitlines()
    entries = []
    for line in lines:
        parts = line.split()
        if len(parts) < 2:
            continue
        commit_sha = parts[1]
        try:
            raw = subprocess.check_output(
                ["git", "notes", "--ref=tokens", "show", commit_sha], stderr=subprocess.DEVNULL
            ).decode().strip()
            data = json.loads(raw)
            subj = subprocess.check_output(
                ["git", "log", "-1", "--format=%s", commit_sha], stderr=subprocess.DEVNULL
            ).decode().strip()
            data["subject"] = subj
            data["sha"] = commit_sha[:7]
            entries.append(data)
        except Exception:
            pass

    entries.sort(key=lambda x: x.get("timestamp", 0))
    return entries


def show_summary(last_n=None, as_csv=False, as_json=False):
    entries = get_all_note_entries()

    if not entries:
        print("No token notes found. Run: python3 scripts/token_tracker.py backfill")
        return

    if last_n and last_n > 0:
        entries = entries[-last_n:]

    if as_json:
        print(json.dumps(entries, indent=2))
        return

    if as_csv:
        import csv
        writer = csv.writer(sys.stdout)
        writer.writerow(["sha", "date", "calls", "prompt_tokens", "output_tokens", "total_tokens", "flash_usd", "sonnet_usd", "subject"])
        for e in entries:
            ts = e.get("timestamp", 0)
            dt_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else "-"
            writer.writerow([
                e['sha'], dt_str, e.get("model_calls", 0),
                e.get("prompt_tokens", 0), e.get("output_tokens", 0), e.get("total_tokens", 0),
                e.get("est_flash_usd", 0.0), e.get("est_sonnet_usd", 0.0),
                e.get("subject", "")
            ])
        return

    term_cols = shutil.get_terminal_size((120, 24)).columns
    fixed_cols = 8 + 17 + 6 + 13 + 10 + 11 + 12 + 7
    subj_width = max(35, term_cols - fixed_cols)

    sep_len = fixed_cols + subj_width
    print("=" * sep_len)
    print(
        f"{'Commit':<8} {'Date':<17} {'Calls':<6} {'Prompt Tok':<13} {'Out Tok':<10} "
        f"{'Flash ($)':<11} {'Sonnet ($)':<12} {'Subject':<{subj_width}}"
    )
    print("-" * sep_len)

    total_calls = 0
    total_prompt = 0
    total_output = 0
    total_flash = 0.0
    total_sonnet = 0.0

    for e in entries:
        ts = e.get("timestamp", 0)
        dt_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else "-"
        calls = e.get("model_calls", 0)
        p_tok = e.get("prompt_tokens", 0)
        o_tok = e.get("output_tokens", 0)
        f_cost = e.get("est_flash_usd", 0.0)
        s_cost = e.get("est_sonnet_usd", 0.0)
        subj = e.get("subject", "")

        total_calls += calls
        total_prompt += p_tok
        total_output += o_tok
        total_flash += f_cost
        total_sonnet += s_cost

        print(
            f"{e['sha']:<8} {dt_str:<17} {calls:<6} {p_tok:<13,} {o_tok:<10,} "
            f"${f_cost:<10.4f} ${s_cost:<11.4f} {subj}"
        )

    print("=" * sep_len)
    print(
        f"{'TOTAL':<8} {len(entries)} commits        "
        f"{total_calls:<6,} {total_prompt:<13,} {total_output:<10,} "
        f"${total_flash:<10.4f} ${total_sonnet:<11.4f}"
    )
    print("=" * sep_len)


def show_lifetime(custom_logs_dir=None, as_json=False):
    repo_path = get_repo_path()
    conv_ids = get_matching_conversation_ids(repo_path, custom_logs_dir)
    all_turns = load_all_conversation_turns(conv_ids, custom_logs_dir)

    if not all_turns:
        print("No agent activity found for this repository.")
        return

    earliest_ts = all_turns[0][0]
    latest_ts = all_turns[-1][0]
    stats = compute_turn_stats(all_turns)

    commit_entries = get_all_note_entries()
    commit_calls = sum(e.get("model_calls", 0) for e in commit_entries)
    commit_prompt = sum(e.get("prompt_tokens", 0) for e in commit_entries)
    commit_out = sum(e.get("output_tokens", 0) for e in commit_entries)
    commit_flash = sum(e.get("est_flash_usd", 0.0) for e in commit_entries)

    uncommitted_calls = stats["model_calls"] - commit_calls
    uncommitted_prompt = stats["prompt_tokens"] - commit_prompt
    uncommitted_out = stats["output_tokens"] - commit_out
    uncommitted_flash = stats["est_flash_usd"] - commit_flash

    data = {
        "workspace": repo_path,
        "first_activity": datetime.fromtimestamp(earliest_ts).strftime("%Y-%m-%d %H:%M:%S"),
        "last_activity": datetime.fromtimestamp(latest_ts).strftime("%Y-%m-%d %H:%M:%S"),
        "conversations": len(conv_ids),
        "total_model_calls": stats["model_calls"],
        "total_prompt_tokens": stats["prompt_tokens"],
        "total_output_tokens": stats["output_tokens"],
        "total_tokens": stats["total_tokens"],
        "est_flash_usd": stats["est_flash_usd"],
        "est_sonnet_usd": stats["est_sonnet_usd"],
        "committed_calls": commit_calls,
        "uncommitted_calls": max(0, uncommitted_calls),
    }

    if as_json:
        print(json.dumps(data, indent=2))
        return

    print("\n" + "=" * 65)
    print("        HIMMEL POS — PROJECT LIFETIME TOKEN REPORT        ")
    print("=" * 65)
    print(f"Workspace:             {repo_path}")
    print(f"First Agent Action:    {data['first_activity']}")
    print(f"Latest Agent Action:   {data['last_activity']}")
    print(f"Total Agent Sessions:  {data['conversations']:,} conversations")
    print(f"Total Model Calls:     {data['total_model_calls']:,} LLM invocations")
    print("-" * 65)
    print(f"Cumulative Context In: {data['total_prompt_tokens']:,} tokens")
    print(f"Generated Output:      {data['total_output_tokens']:,} tokens")
    print(f"Total Tokens:          {data['total_tokens']:,} tokens")
    print("-" * 65)
    print("ESTIMATED CLOUD API COSTS (85% Prefix Prompt Caching):")
    print(f"  • Gemini 3.5 / 3.8 Flash:  ${data['est_flash_usd']:.2f} USD")
    print(f"  • Claude 3.5 Sonnet:       ${data['est_sonnet_usd']:.2f} USD")
    print("-" * 65)
    print("ATTRIBUTION BREAKDOWN:")
    print(f"  • Committed (in {len(commit_entries)} commits): {commit_calls:,} calls ({commit_flash:.2f} USD Flash)")
    print(f"  • Uncommitted (chat/debug/live): {max(0, uncommitted_calls):,} calls ({max(0.0, uncommitted_flash):.2f} USD Flash)")
    print("=" * 65 + "\n")


def show_single_commit(commit_ref="HEAD"):
    try:
        commit_sha = subprocess.check_output(
            ["git", "rev-parse", commit_ref], stderr=subprocess.DEVNULL
        ).decode().strip()
        raw = subprocess.check_output(
            ["git", "notes", "--ref=tokens", "show", commit_sha], stderr=subprocess.DEVNULL
        ).decode().strip()
        data = json.loads(raw)
        log_out = subprocess.check_output(
            ["git", "log", "-1", "--format=%ci%n%an%n%s%n%b", commit_sha], stderr=subprocess.DEVNULL
        ).decode().strip().splitlines()
        
        print("\n" + "=" * 60)
        print(f"Commit:        {commit_sha}")
        if log_out:
            print(f"Date:          {log_out[0]}")
            if len(log_out) > 1: print(f"Author:        {log_out[1]}")
            if len(log_out) > 2: print(f"Subject:       {log_out[2]}")
            if len(log_out) > 3 and log_out[3]: print(f"Body:\n{'\n'.join(log_out[3:])}")
        print("-" * 60)
        print(f"Model Calls:   {data.get('model_calls', 0):,}")
        print(f"Prompt Tokens: {data.get('prompt_tokens', 0):,}")
        print(f"Output Tokens: {data.get('output_tokens', 0):,}")
        print(f"Total Tokens:  {data.get('total_tokens', 0):,}")
        print(f"Est. Flash:    ${data.get('est_flash_usd', 0.0):.4f}")
        print(f"Est. Sonnet:   ${data.get('est_sonnet_usd', 0.0):.4f}")
        print("=" * 60 + "\n")
    except Exception as e:
        print(f"No token notes found for {commit_ref}: {e}")


def sync_notes(direction="pull"):
    if direction == "push":
        cmd = ["git", "push", "origin", "refs/notes/tokens"]
        print(f"Pushing token notes to origin...")
    else:
        cmd = ["git", "fetch", "origin", "refs/notes/tokens:refs/notes/tokens"]
        print(f"Fetching token notes from origin...")
    try:
        subprocess.run(cmd, check=True)
        print("Sync complete.")
    except Exception as e:
        print(f"Sync failed: {e}")


if __name__ == "__main__":
    args = sys.argv[1:]
    cmd = args[0] if args else "summary"

    custom_logs_dir = None
    for i, a in enumerate(args):
        if a == "--logs-dir" and i + 1 < len(args):
            custom_logs_dir = os.path.expanduser(args[i + 1])

    if cmd == "commit":
        target = args[1] if len(args) > 1 and not args[1].startswith("--") else "HEAD"
        record_commit(target, custom_logs_dir=custom_logs_dir)
    elif cmd in ("summary", "list"):
        last_n = None
        as_csv = "--csv" in args
        as_json = "--json" in args
        for i, a in enumerate(args):
            if a in ("-n", "--last") and i + 1 < len(args):
                last_n = int(args[i + 1])
        show_summary(last_n=last_n, as_csv=as_csv, as_json=as_json)
    elif cmd in ("lifetime", "full", "total"):
        as_json = "--json" in args
        show_lifetime(custom_logs_dir=custom_logs_dir, as_json=as_json)
    elif cmd in ("show", "inspect", "info"):
        target = args[1] if len(args) > 1 and not args[1].startswith("--") else "HEAD"
        show_single_commit(target)
    elif cmd == "backfill":
        limit = None
        for a in args[1:]:
            if a.isdigit():
                limit = int(a)
        backfill_all(limit=limit, custom_logs_dir=custom_logs_dir)
    elif cmd == "sync":
        direction = args[1] if len(args) > 1 and args[1] in ("push", "pull") else "pull"
        sync_notes(direction)
    else:
        print("Usage:")
        print("  python3 scripts/token_tracker.py lifetime [--logs-dir /path/to/brain]")
        print("  python3 scripts/token_tracker.py summary [-n 10] [--csv] [--json]")
        print("  python3 scripts/token_tracker.py show [commit_sha|HEAD]")
        print("  python3 scripts/token_tracker.py backfill [all|<count>] [--logs-dir /path]")
        print("  python3 scripts/token_tracker.py sync [push|pull]")
