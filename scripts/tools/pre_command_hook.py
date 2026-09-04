import sys
import json
import re

"""
PreToolUse Hook for Antigravity:
1. Rewrites `git diff` and `git log` commands to `rtk git diff` / `rtk git log` for compact output.
2. Enforces `| tokless` on test/lint/build/heavy diagnostic commands.
"""

HEAVY_COMMAND_PATTERNS = [
    r"^(?:npm\s+run\s+(?:test|lint|build|check))",
    r"^(?:npm\s+(?:test|run-script\s+test))",
    r"^(?:python\s+-m\s+unittest)",
    r"^(?:pytest)",
    r"^(?:cargo\s+(?:test|build|check))",
    r"^(?:vitest)",
    r"^(?:oxlint)",
    r"^(?:eslint)"
]

def should_enforce_tokless(cmd: str) -> bool:
    cmd_clean = cmd.strip()
    if re.search(r"\|\s*tokless(?:\.exe)?(?:\s|$)", cmd_clean, re.IGNORECASE):
        return False
    for pat in HEAVY_COMMAND_PATTERNS:
        if re.search(pat, cmd_clean, re.IGNORECASE):
            return True
    return False

def rewrite_git_command(cmd: str) -> str | None:
    cmd_clean = cmd.strip()
    if cmd_clean.startswith("rtk "):
        return None
    pattern = r"(^|[;&|]\s*)git\s+(diff|log)\b"
    if re.search(pattern, cmd_clean, re.IGNORECASE):
        return re.sub(pattern, r"\g<1>rtk git \2", cmd_clean, flags=re.IGNORECASE)
    return None

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"decision": "allow"}))
            return

        payload = json.loads(raw_input)
        tool_call = payload.get("toolCall", {})
        tool_name = tool_call.get("name", "")
        args = tool_call.get("args", {})

        if tool_name == "run_command":
            cmd = args.get("CommandLine", "")
            if cmd:
                rewritten_git = rewrite_git_command(cmd)
                if rewritten_git:
                    output = {
                        "decision": "allow",
                        "overwrite": {
                            "CommandLine": rewritten_git
                        },
                        "reason": f"Rewrote git command to RTK to filter output: {rewritten_git}"
                    }
                    print(json.dumps(output))
                    return

                if should_enforce_tokless(cmd):
                    piped_cmd = f"{cmd.rstrip()} | tokless"
                    output = {
                        "decision": "allow",
                        "overwrite": {
                            "CommandLine": piped_cmd
                        },
                        "reason": f"Enforced tokless piping to prevent context bloat: {piped_cmd}"
                    }
                    print(json.dumps(output))
                    return

        print(json.dumps({"decision": "allow"}))
    except Exception as e:
        print(json.dumps({"decision": "allow", "reason": f"Hook error bypassed: {str(e)}"}))

if __name__ == "__main__":
    main()
