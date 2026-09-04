#!/usr/bin/env python
"""
Windows Token Usage & Cost Tracker for Agent Workflows.
Standalone Windows implementation tailored for Antigravity on Windows:
- Reads SQLite trajectory metadata & Protobuf summaries to correlate conversations
- Parses transcript logs from %USERPROFILE%\\.gemini\\antigravity\\brain\\
- Attaches token usage metadata to Git commits via Git Notes (refs/notes/tokens)
- Synchronizes notes with git remote across devices
"""

import sys
import os
import glob
import json
import shutil
import sqlite3
import re
import urllib.parse
import subprocess
from datetime import datetime

BASE_SYSTEM_TOKENS = 6000  # Avg system prompt + schema overhead per call

# Pricing models (per 1,000,000 tokens)
# Gemini 2.0 / 1.5 Flash: Cache Read: $0.01875, Uncached In: $0.075, Out: $0.30
FLASH_IN_UNCACHED = 0.075 / 1_000_000
FLASH_IN_CACHED   = 0.01875 / 1_000_000
FLASH_OUT         = 0.30 / 1_000_000

# Claude 3.5 Sonnet: Cache Read: $0.30, Uncached In: $3.00, Out: $15.00
SONNET_IN_UNCACHED = 3.00 / 1_000_000
SONNET_IN_CACHED   = 0.30 / 1_000_000
SONNET_OUT         = 15.00 / 1_000_000


def get_repo_path():
    try:
        raw = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], stderr=subprocess.DEVNULL
        ).decode().strip()
        return os.path.normpath(raw)
    except Exception:
        return os.path.normpath(os.getcwd())


def get_antigravity_base_dirs(custom_logs_dir=None):
    candidates = []
    if custom_logs_dir and os.path.exists(custom_logs_dir):
        candidates.append(os.path.normpath(custom_logs_dir))

    user_home = os.path.expanduser("~")
    user_prof = os.environ.get("USERPROFILE", user_home)

    search_roots = [user_prof, user_home]
    sub_names = ["antigravity", "antigravity-cli", "antigravity-ide"]

    for root in search_roots:
        for sub in sub_names:
            p = os.path.join(root, ".gemini", sub)
            if os.path.exists(p) and p not in candidates:
                candidates.append(os.path.normpath(p))

    repo_agent_logs = os.path.join(get_repo_path(), ".agent_logs")
    if os.path.exists(repo_agent_logs) and repo_agent_logs not in candidates:
        candidates.append(os.path.normpath(repo_agent_logs))

    return candidates


def get_repo_needles(repo_path):
    needles = set()
    norm = repo_path.replace("\\", "/").rstrip("/").lower()
    needles.add(norm)
    base_name = os.path.basename(norm)
    if base_name:
        needles.add(base_name)

    try:
        remote = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"], stderr=subprocess.DEVNULL
        ).decode().strip().lower()
        if remote:
            needles.add(remote)
            cleaned = remote.replace(".git", "").rstrip("/")
            parts = cleaned.split("/")
            if len(parts) >= 2:
                needles.add(f"{parts[-2]}/{parts[-1]}")
    except Exception:
        pass

    return needles


def get_matching_conversation_ids(repo_path, custom_logs_dir=None):
    """Finds conversation IDs that belong to the current repo workspace on Windows."""
    matched = set()
    needles = get_repo_needles(repo_path)
    base_dirs = get_antigravity_base_dirs(custom_logs_dir)

    # 1. Inspect conversations/*.db (SQLite trajectory metadata)
    for b in base_dirs:
        conv_dir = os.path.join(b, "conversations")
        if not os.path.exists(conv_dir):
            continue
        for db_file in glob.glob(os.path.join(conv_dir, "*.db")):
            cid = os.path.splitext(os.path.basename(db_file))[0]
            if cid in matched:
                continue
            try:
                con = sqlite3.connect(db_file)
                rows = con.execute("SELECT data FROM trajectory_metadata_blob").fetchall()
                con.close()
                for (blob,) in rows:
                    if not blob:
                        continue
                    blob_lower = blob.lower()
                    if any(n.encode() in blob_lower for n in needles):
                        matched.add(cid)
                        break
            except Exception:
                pass

    # 2. Inspect agyhub_summaries_proto.pb (Protobuf summary index)
    uuid_re = re.compile(rb"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
    for b in base_dirs:
        pb_path = os.path.join(b, "agyhub_summaries_proto.pb")
        if not os.path.exists(pb_path):
            continue
        try:
            with open(pb_path, "rb") as f:
                data = f.read().lower()
            for n in needles:
                nb = n.encode()
                pos = 0
                while True:
                    idx = data.find(nb, pos)
                    if idx == -1:
                        break
                    sub = data[max(0, idx - 300):idx]
                    found = uuid_re.findall(sub)
                    if found:
                        matched.add(found[-1].decode("ascii"))
                    pos = idx + len(nb)
        except Exception:
            pass

    # 3. Direct head scan of transcripts in brain/
    for b in base_dirs:
        brain_dir = os.path.join(b, "brain") if not b.endswith("brain") else b
        if not os.path.exists(brain_dir):
            continue
        for session_dir in glob.glob(os.path.join(brain_dir, "*")):
            cid = os.path.basename(session_dir)
            if cid in matched:
                continue
            for fname in ["transcript.jsonl", "transcript_full.jsonl"]:
                log_file = os.path.join(session_dir, ".system_generated", "logs", fname)
                if os.path.exists(log_file):
                    try:
                        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                            for _ in range(15):
                                line = f.readline().lower()
                                if not line:
                                    break
                                if any(n in line for n in needles):
                                    matched.add(cid)
                                    break
                    except Exception:
                        pass
                    if cid in matched:
                        break

    # 4. Fallback: check legacy history.jsonl & conversation_summaries.db if present
    for b in base_dirs:
        hist = os.path.join(b, "history.jsonl")
        if os.path.exists(hist):
            try:
                with open(hist, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        d = json.loads(line)
                        ws = str(d.get("workspace", "")).lower()
                        cid = d.get("conversationId")
                        if cid and any(n in ws for n in needles):
                            matched.add(cid)
            except Exception:
                pass

        sum_db = os.path.join(b, "conversation_summaries.db")
        if os.path.exists(sum_db):
            try:
                con = sqlite3.connect(sum_db)
                rows = con.execute("SELECT conversation_id, workspace_uris FROM conversation_summaries").fetchall()
                con.close()
                for cid, uris in rows:
                    if cid and any(n in str(uris).lower() for n in needles):
                        matched.add(cid)
            except Exception:
                pass

    return matched


def find_transcript_paths(conv_ids, custom_logs_dir=None):
    """Finds transcript log files for matched conversation IDs on Windows."""
    paths = []
    base_dirs = get_antigravity_base_dirs(custom_logs_dir)
    brain_dirs = []

    for b in base_dirs:
        b_dir = os.path.join(b, "brain") if not b.endswith("brain") else b
        if os.path.exists(b_dir) and b_dir not in brain_dirs:
            brain_dirs.append(b_dir)

    for b_dir in brain_dirs:
        for cid in conv_ids:
            p_full = os.path.join(b_dir, cid, ".system_generated", "logs", "transcript_full.jsonl")
            p_norm = os.path.join(b_dir, cid, ".system_generated", "logs", "transcript.jsonl")
            p_chunk = os.path.join(b_dir, cid, ".system_generated", "logs", "chunks", "transcript_full", "00000000.jsonl")

            chosen = None
            if os.path.exists(p_full) and os.path.getsize(p_full) > 0:
                chosen = p_full
            elif os.path.exists(p_norm) and os.path.getsize(p_norm) > 0:
                chosen = p_norm
            elif os.path.exists(p_chunk) and os.path.getsize(p_chunk) > 0:
                chosen = p_chunk

            if chosen and chosen not in paths:
                paths.append(chosen)

        # Include any transcripts placed directly or in subfolders
        for p in glob.glob(os.path.join(b_dir, "**", "transcript_full.jsonl"), recursive=True):
            if p not in paths and os.path.getsize(p) > 0:
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

                    content_len = len(json.dumps(d.get("content", "")))
                    calls_len = len(json.dumps(d.get("tool_calls", "")))
                    think_len = len(json.dumps(d.get("thinking", "")))
                    step_chars = content_len + calls_len + think_len

                    is_model = (d.get("source") == "MODEL" and (calls_len > 4 or think_len > 4 or content_len > 4))

                    if is_model:
                        turn_in = BASE_SYSTEM_TOKENS + (cum_chars // 4)
                        turn_out = step_chars // 4
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
    print("Loading agent logs and git history (Windows)...")
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
        print("No token notes found. Run: python scripts/token_tracker_win.py backfill")
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
        print("No agent activity found for this repository on Windows.")
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
    print("        HIMMEL POS - PROJECT LIFETIME TOKEN REPORT (WIN)        ")
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
    print(f"  * Gemini 2.0 / 1.5 Flash:  ${data['est_flash_usd']:.2f} USD")
    print(f"  * Claude 3.5 Sonnet:       ${data['est_sonnet_usd']:.2f} USD")
    print("-" * 65)
    print("ATTRIBUTION BREAKDOWN:")
    print(f"  * Committed (in {len(commit_entries)} commits): {commit_calls:,} calls ({commit_flash:.2f} USD Flash)")
    print(f"  * Uncommitted (chat/debug/live): {max(0, uncommitted_calls):,} calls ({max(0.0, uncommitted_flash):.2f} USD Flash)")
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
            if len(log_out) > 1:
                print(f"Author:        {log_out[1]}")
            if len(log_out) > 2:
                print(f"Subject:       {log_out[2]}")
            if len(log_out) > 3 and log_out[3]:
                print(f"Body:\n{'\n'.join(log_out[3:])}")
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
        print("Pushing token notes to origin...")
    else:
        cmd = ["git", "fetch", "origin", "refs/notes/tokens:refs/notes/tokens"]
        print("Fetching token notes from origin...")
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
        print("  python scripts/token_tracker_win.py lifetime [--logs-dir /path/to/brain]")
        print("  python scripts/token_tracker_win.py summary [-n 10] [--csv] [--json]")
        print("  python scripts/token_tracker_win.py show [commit_sha|HEAD]")
        print("  python scripts/token_tracker_win.py backfill [all|<count>] [--logs-dir /path]")
        print("  python scripts/token_tracker_win.py sync [push|pull]")
