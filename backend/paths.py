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

# Data directory: MUST be persistent on disk (never in ephemeral _MEIPASS)
DATA_DIR = os.getenv("POS_DATA_DIR") or os.path.join(APP_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Database file path
DB_PATH = os.path.join(DATA_DIR, "pos_store.db")

# Logs directory: persistent on disk
LOGS_DIR = os.getenv("POS_LOGS_DIR") or os.path.join(APP_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# Certs directory for EET certificates: persistent
CERTS_DIR = os.getenv("POS_CERTS_DIR") or os.path.join(DATA_DIR, "certs")
os.makedirs(CERTS_DIR, exist_ok=True)

# Secret key file: persistent in data directory
SECRET_KEY_FILE = os.path.join(DATA_DIR, ".secret_key")


def get_dist_dir() -> str:
    """Find compiled React frontend dist directory across dev and frozen environments."""
    # 1. Bundled in PyInstaller package
    bundled = os.path.join(BUNDLE_DIR, "dist")
    if os.path.exists(bundled) and os.path.isfile(os.path.join(bundled, "index.html")):
        return bundled
    # 2. Alongside executable
    adjacent = os.path.join(APP_DIR, "dist")
    if os.path.exists(adjacent) and os.path.isfile(os.path.join(adjacent, "index.html")):
        return adjacent
    # 3. Standard dev layout (pos-eet-himmel/dist)
    dev_dist = os.path.join(ROOT_DIR, "dist")
    if os.path.exists(dev_dist):
        return dev_dist
    return bundled
