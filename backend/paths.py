"""
Centralized path resolution for Himmel POS backend.
Supports standard Python development and PyInstaller frozen executable.
"""
import os
import sys

IS_FROZEN = getattr(sys, "frozen", False)

if IS_FROZEN:
    # PyInstaller executable directory
    APP_DIR = os.path.dirname(os.path.abspath(sys.executable))
    # Ephemeral extracted directory in onefile mode or same as APP_DIR in onedir mode
    BUNDLE_DIR = getattr(sys, "_MEIPASS", APP_DIR)
    ROOT_DIR = APP_DIR
else:
    # Development directory: backend/
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
    BUNDLE_DIR = APP_DIR
    ROOT_DIR = os.path.dirname(APP_DIR)

BASE_DIR = APP_DIR

def _resolve_data_dir() -> str:
    env_dir = os.getenv("POS_DATA_DIR")
    if env_dir:
        return env_dir

    if not IS_FROZEN:
        return os.path.join(APP_DIR, "data")

    # In frozen mode: check if portable adjacent data dir is explicitly present and writable
    portable_data = os.path.join(APP_DIR, "data")
    if os.path.exists(portable_data) and os.access(portable_data, os.W_OK):
        return portable_data

    # Standard per-user application data directory
    if sys.platform == "win32":
        base_user_data = os.getenv("APPDATA") or os.getenv("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base_user_data, "VoltFlow POS", "data")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/VoltFlow POS/data")
    else:
        xdg_data = os.getenv("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
        return os.path.join(xdg_data, "voltflow-pos", "data")


# Data directory: MUST be persistent on disk (never in ephemeral _MEIPASS)
DATA_DIR = _resolve_data_dir()
os.makedirs(DATA_DIR, exist_ok=True)

# Database file path
DB_PATH = os.path.join(DATA_DIR, "pos_store.db")

# Logs directory: persistent on disk
def _resolve_logs_dir() -> str:
    env_dir = os.getenv("POS_LOGS_DIR")
    if env_dir:
        return env_dir
    if not IS_FROZEN:
        return os.path.join(APP_DIR, "logs")
    return os.path.join(os.path.dirname(DATA_DIR), "logs")


LOGS_DIR = _resolve_logs_dir()
os.makedirs(LOGS_DIR, exist_ok=True)

# Certs directory for EET certificates: persistent
CERTS_DIR = os.getenv("POS_CERTS_DIR") or os.path.join(DATA_DIR, "certs")
os.makedirs(CERTS_DIR, exist_ok=True)

# Secret key file: persistent in data directory
SECRET_KEY_FILE = os.path.join(DATA_DIR, ".secret_key")


def get_dist_dir() -> str:
    """Find compiled React frontend dist directory across dev and frozen environments."""
    candidates = [
        os.path.join(ROOT_DIR, "dist"),
        os.path.abspath(os.path.join(APP_DIR, "..", "..", "dist")),
        os.path.join(APP_DIR, "dist"),
        os.path.join(BUNDLE_DIR, "dist")
    ]
    valid = [c for c in candidates if os.path.isdir(c) and os.path.isfile(os.path.join(c, "index.html"))]
    if valid:
        return max(valid, key=lambda c: os.path.getmtime(os.path.join(c, "index.html")))
    return os.path.join(BUNDLE_DIR, "dist")
