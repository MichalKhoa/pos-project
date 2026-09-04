#!/usr/bin/env bash
# VoltFlow POS — Build Standalone Backend Bundle (Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================================"
echo "  Building VoltFlow POS Standalone Bundle (Linux)..."
echo "========================================================"
echo ""

# 1. Compile frontend
echo "[1/3] Building frontend UI bundle..."
npm run build

# 2. Run PyInstaller
echo "[2/3] Freezing Python backend..."
if [ -x "$REPO_ROOT/backend/venv/bin/python" ]; then
    "$REPO_ROOT/backend/venv/bin/python" "$REPO_ROOT/backend/build_standalone.py"
else
    python3 "$REPO_ROOT/backend/build_standalone.py"
fi

# 3. Stage Tauri Sidecar
echo "[3/3] Staging Tauri sidecar..."
if [ -x "$REPO_ROOT/backend/venv/bin/python" ]; then
    "$REPO_ROOT/backend/venv/bin/python" "$REPO_ROOT/scripts/prepare_sidecar.py"
else
    python3 "$REPO_ROOT/scripts/prepare_sidecar.py"
fi

echo "[SUCCESS] Standalone backend and Tauri sidecar ready!"
