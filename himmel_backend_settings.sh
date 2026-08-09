#!/usr/bin/env bash
# Himmel POS — Backend Settings GUI Launcher (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PYTHON_BIN="python3"
if [ -x "$SCRIPT_DIR/backend/venv/bin/python" ]; then
    PYTHON_BIN="$SCRIPT_DIR/backend/venv/bin/python"
fi

echo "Launching Himmel POS Settings GUI..."
"$PYTHON_BIN" "$SCRIPT_DIR/backend/settings_gui.py" &
