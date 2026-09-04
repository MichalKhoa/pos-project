#!/usr/bin/env python3
"""
Himmel POS - Standalone Backend Packager
Builds a zero-dependency standalone backend bundle using PyInstaller.
"""
import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DIST_UI_DIR = os.path.join(ROOT_DIR, "dist")
SPEC_FILE = os.path.join(BASE_DIR, "pos_backend.spec")
DIST_STANDALONE = os.path.join(BASE_DIR, "dist_standalone")
BUILD_DIR = os.path.join(BASE_DIR, "build")


def ensure_frontend_built():
    """Ensure React frontend is freshly built into dist/ before bundling."""
    print("[BUILD] Compiling fresh React frontend bundle...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    subprocess.run([npm_cmd, "run", "build"], cwd=ROOT_DIR, check=True)


def run_pyinstaller():
    """Execute PyInstaller to freeze backend."""
    # Preflight: ensure PyInstaller is installed in current Python environment
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print(
            "\n[ERROR] PyInstaller is not installed in the active Python environment.\n"
            f"Please run: {sys.executable} -m pip install pyinstaller\n",
            file=sys.stderr,
        )
        sys.exit(1)

    print("[BUILD] Freezing backend with PyInstaller...")
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "-y",
        SPEC_FILE,
        f"--distpath={DIST_STANDALONE}",
        f"--workpath={BUILD_DIR}",
    ]
    subprocess.run(cmd, cwd=BASE_DIR, check=True)


def verify_output():
    """Verify built binary exists and is executable."""
    exe_name = "pos-backend.exe" if sys.platform == "win32" else "pos-backend"
    standalone_name = "pos-backend-standalone.exe" if sys.platform == "win32" else "pos-backend-standalone"
    onedir_bin = os.path.join(DIST_STANDALONE, "pos-backend", exe_name)
    onefile_bin = os.path.join(DIST_STANDALONE, standalone_name)

    if os.path.exists(onefile_bin):
        target_bin = onefile_bin
        bundle_info = "Single-file executable"
    elif os.path.exists(onedir_bin):
        target_bin = onedir_bin
        bundle_info = os.path.join(DIST_STANDALONE, "pos-backend")
    else:
        raise FileNotFoundError(f"Expected standalone binary not found at: {onefile_bin} or {onedir_bin}")

    size_mb = os.path.getsize(target_bin) / (1024 * 1024)
    print(f"\n========================================================")
    print(f" SUCCESS: Standalone backend built successfully!")
    print(f" Binary location: {target_bin} ({size_mb:.2f} MB)")
    print(f" Bundle target:   {bundle_info}")
    print(f"========================================================\n")
    return target_bin


def main():
    try:
        ensure_frontend_built()
        run_pyinstaller()
        verify_output()
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Build process failed with code {e.returncode}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"\n[ERROR] Build failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
