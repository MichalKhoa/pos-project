import subprocess
import os
import sys
import logging
from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/update", tags=["System Updater"])
logger = logging.getLogger("pos-updater")

REPO_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_git_command(args, cwd=REPO_DIR):
    """Utility to run git CLI command in repo root."""
    try:
        res = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15
        )
        return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
    except Exception as e:
        return False, "", str(e)


@router.get("/status")
def get_update_status():
    """Checks git repository for local vs origin/master commit status."""
    # 1. Fetch remote tracking refs silently
    fetch_ok, _, fetch_err = run_git_command(["fetch", "origin", "master"])
    
    # 2. Get local HEAD commit hash & info
    _, local_hash, _ = run_git_command(["rev-parse", "--short", "HEAD"])
    _, local_date, _ = run_git_command(["log", "-1", "--format=%cd", "--date=relative"])
    
    # 3. Get origin/master commit hash & latest commit message
    _, remote_hash, _ = run_git_command(["rev-parse", "--short", "origin/master"])
    _, remote_msg, _ = run_git_command(["log", "-1", "--format=%s", "origin/master"])
    _, remote_date, _ = run_git_command(["log", "-1", "--format=%cd", "--date=relative", "origin/master"])

    # 4. Check commit count difference
    _, rev_list, _ = run_git_command(["rev-list", "--left-right", "--count", "HEAD...origin/master"])
    behind_count = 0
    if rev_list:
        parts = rev_list.split()
        if len(parts) >= 2:
            behind_count = int(parts[1])

    is_update_available = (local_hash != remote_hash) and (behind_count > 0)

    return {
        "status": "SUCCESS",
        "fetch_success": fetch_ok,
        "is_update_available": is_update_available,
        "behind_commits_count": behind_count,
        "current_version": {
            "hash": local_hash or "UNKNOWN",
            "date": local_date or ""
        },
        "latest_version": {
            "hash": remote_hash or "UNKNOWN",
            "message": remote_msg or "Žádné nové změny",
            "date": remote_date or ""
        }
    }


@router.post("/apply")
def apply_system_update(request: Request):
    """Spawns detached update process and prepares POS services for restart."""
    # Security: Restrict remote Wi-Fi callers from terminating and updating POS processes
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aktualizace systému je zakázána přes vzdálenou síť Wi-Fi/LAN. Povoleno pouze z lokální pokladny."
        )

    logger.info("Cashier requested remote system update. Spawning detached updater...")

    try:
        if sys.platform == "win32":
            script_path = os.path.join(REPO_DIR, "backend", "update_process.bat")
            if not os.path.exists(script_path):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Update helper script (update_process.bat) missing."
                )
            subprocess.Popen(
                f'cmd /c start "" /min "{script_path}"',
                shell=True,
                cwd=REPO_DIR,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            candidates = [
                os.path.join(REPO_DIR, "scripts", "tools", "himmel_pos_update.sh"),
                os.path.join(REPO_DIR, "himmel_pos_update.sh"),
            ]
            script_path = next((p for p in candidates if os.path.exists(p)), None)
            if not script_path:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Update helper script (himmel_pos_update.sh) missing."
                )
            subprocess.Popen(["bash", script_path], cwd=REPO_DIR)
        
        return {
            "status": "UPDATE_INITIATED",
            "message": "Aktualizace byla zahájena. Pokladní systém se restartuje s nejnovější verzí."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to spawn update script: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chyba při spouštění aktualizace: {str(e)}"
        )
