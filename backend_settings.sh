#!/usr/bin/env bash
# VoltFlow POS — Backend & Store Settings GUI (Linux)
# Launches pywebview desktop configuration app for .env and database store_config.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN="python3"
if [ -x "$SCRIPT_DIR/backend/venv/bin/python" ]; then
    PYTHON_BIN="$SCRIPT_DIR/backend/venv/bin/python"
fi

# Ensure dependencies are installed if venv missing
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[INFO] Backend virtual environment not found. Setting up..."
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    "$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
    PYTHON_BIN="$SCRIPT_DIR/backend/venv/bin/python"
fi

echo "========================================================"
echo "  Launching VoltFlow POS Backend Settings GUI..."
echo "  (Configure .env variables, database, EET certs, hardware)"
echo "========================================================"
echo ""

"$PYTHON_BIN" "$SCRIPT_DIR/backend/settings_gui.py"
