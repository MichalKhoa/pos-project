#!/usr/bin/env bash
# Himmel POS — Build Standalone Backend Bundle (Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  Building Himmel POS Standalone Bundle (Linux)..."
echo "========================================================"
echo ""

# 1. Compile frontend
echo "[1/2] Building frontend UI bundle..."
npm run build

# 2. Run PyInstaller
echo "[2/2] Freezing Python backend..."
if [ -x "$SCRIPT_DIR/backend/venv/bin/python" ]; then
    "$SCRIPT_DIR/backend/venv/bin/python" "$SCRIPT_DIR/backend/build_standalone.py"
else
    python3 "$SCRIPT_DIR/backend/build_standalone.py"
fi

# 3. Stage Tauri Sidecar
echo "[3/3] Staging Tauri sidecar..."
if [ -x "$SCRIPT_DIR/backend/venv/bin/python" ]; then
    "$SCRIPT_DIR/backend/venv/bin/python" "$SCRIPT_DIR/scripts/prepare_sidecar.py"
else
    python3 "$SCRIPT_DIR/scripts/prepare_sidecar.py"
fi

echo "[SUCCESS] Standalone backend and Tauri sidecar ready!"
