#!/usr/bin/env python3
"""
Himmel POS - Tauri Sidecar Preparation Script
Builds standalone backend executable and stages it with proper target-triple
naming for Tauri v2 bundling.
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
BINARIES_DIR = ROOT_DIR / "src-tauri" / "binaries"


def get_target_triple() -> str:
    """Retrieve host target triple from rustc, falling back to OS heuristics."""
    try:
        output = subprocess.check_output(["rustc", "-vV"], text=True)
        for line in output.splitlines():
            if line.startswith("host:"):
                return line.split(":", 1)[1].strip()
    except Exception:
        pass

    system = platform.system().lower()
    machine = platform.machine().lower()
    if machine in ["amd64", "x86_64"]:
        arch = "x86_64"
    elif machine in ["arm64", "aarch64"]:
        arch = "aarch64"
    else:
        arch = machine

    if system == "windows":
        return f"{arch}-pc-windows-msvc"
    elif system == "darwin":
        return f"{arch}-apple-darwin"
    else:
        return f"{arch}-unknown-linux-gnu"


def main():
    print("=== Himmel POS: Preparing Tauri Sidecar ===")
    BINARIES_DIR.mkdir(parents=True, exist_ok=True)

    target_triple = get_target_triple()
    is_windows = sys.platform == "win32"
    bin_ext = ".exe" if is_windows else ""

    # Locate python executable (prefer venv)
    venv_python_posix = BACKEND_DIR / "venv" / "bin" / "python"
    venv_python_win = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    if venv_python_win.exists():
        py_exec = str(venv_python_win)
    elif venv_python_posix.exists():
        py_exec = str(venv_python_posix)
    else:
        py_exec = sys.executable

    onefile_bin = BACKEND_DIR / "dist_standalone" / f"pos-backend-standalone{bin_ext}"
    dest_binary = BINARIES_DIR / f"pos-backend-{target_triple}{bin_ext}"

    # Build backend if missing
    if not onefile_bin.is_file():
        print(f"Standalone onefile binary not found at {onefile_bin}. Invoking backend build script using {py_exec}...")
        build_script = BACKEND_DIR / "build_standalone.py"
        if not build_script.exists():
            print(f"Error: {build_script} not found!", file=sys.stderr)
            sys.exit(1)
        env = os.environ.copy()
        env["PYINSTALLER_ONEFILE"] = "1"
        res = subprocess.run([py_exec, str(build_script)], cwd=str(ROOT_DIR), env=env)
        if res.returncode != 0:
            print("Error: PyInstaller build failed!", file=sys.stderr)
            sys.exit(res.returncode)

    src_binary = onefile_bin
    if not src_binary.is_file():
        print(f"Error: Expected binary at {src_binary} was not created!", file=sys.stderr)
        sys.exit(1)

    print(f"Copying {src_binary} -> {dest_binary}...")
    shutil.copy2(src_binary, dest_binary)
    if not is_windows:
        dest_binary.chmod(0o755)

    print(f"Sidecar prepared successfully: {dest_binary.name}")


if __name__ == "__main__":
    main()
