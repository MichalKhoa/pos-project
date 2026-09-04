#!/usr/bin/env python3
"""
VoltFlow POS - Hardware & Environment Pre-Flight Diagnostic Tool
Audits POS terminal hardware, operating system, runtimes, peripheral interfaces
(printers, COM ports, scanners), port 8000 availability, and storage permissions
prior to production deployment on new hardware.
"""
import os
import sys
import platform
import socket
import shutil
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

class TerminalColors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def colorize(status: str, text: str) -> str:
    # Check if ANSI supported or on Windows
    if sys.platform == "win32" and not os.environ.get("WT_SESSION"):
        # Basic Windows console fallback
        return f"[{status}] {text}"
    if status == "PASS":
        return f"{TerminalColors.OKGREEN}[PASS]{TerminalColors.ENDC} {text}"
    elif status == "WARN":
        return f"{TerminalColors.WARNING}[WARN]{TerminalColors.ENDC} {text}"
    elif status == "FAIL":
        return f"{TerminalColors.FAIL}[FAIL]{TerminalColors.ENDC} {text}"
    return f"[{status}] {text}"

def check_os():
    arch = platform.machine()
    is_64bit = sys.maxsize > 2**32
    system = platform.system()
    release = platform.release()
    version = platform.version()

    print("\n--- 1. Operating System & Architecture ---")
    print(f"OS:           {system} {release} (Build {version})")
    print(f"Architecture: {arch} ({'64-bit' if is_64bit else '32-bit'})")

    if not is_64bit:
        print(colorize("FAIL", "32-bit architecture detected. VoltFlow POS requires a 64-bit operating system."))
        return False
    else:
        print(colorize("PASS", "64-bit architecture verified."))

    if system == "Windows":
        try:
            import ctypes
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
            if is_admin:
                print(colorize("PASS", "Running with Administrator privileges (recommended for service install/drivers)."))
            else:
                print(colorize("WARN", "Not running as Administrator. Standard POS operation works, but driver installation or service setup requires admin elevation."))
        except Exception:
            pass
    return True

def check_runtimes():
    print("\n--- 2. Runtimes & Dependencies ---")
    all_ok = True

    # Python Version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if sys.version_info >= (3, 10):
        print(colorize("PASS", f"Python version {py_ver} (>= 3.10 required)"))
    else:
        print(colorize("FAIL", f"Python version {py_ver} is too old. Python 3.10+ required."))
        all_ok = False

    # Node.js
    try:
        node_out = subprocess.check_output(["node", "--version"], text=True, stderr=subprocess.DEVNULL).strip()
        print(colorize("PASS", f"Node.js installed: {node_out}"))
    except Exception:
        print(colorize("WARN", "Node.js not detected in PATH. (Only required if running from source or compiling frontend)."))

    # PyInstaller
    try:
        import PyInstaller
        print(colorize("PASS", f"PyInstaller available (v{PyInstaller.__version__}) for standalone builds."))
    except ImportError:
        print(colorize("WARN", "PyInstaller is not installed in the active Python environment. (Required for build_standalone.bat)."))

    # PyWin32 (Windows print spooler)
    if sys.platform == "win32":
        try:
            import win32print
            print(colorize("PASS", "pywin32 / win32print available (Windows ESC/POS Spooler printing enabled)."))
        except ImportError:
            print(colorize("WARN", "pywin32 / win32print not detected. Direct Windows print spooler mode will be unavailable."))

    # Microsoft Edge WebView2
    if sys.platform == "win32":
        try:
            import winreg
            wv2_installed = False
            for root_key in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
                for subkey in [
                    r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-F553-41E6-9021-49480E51820C}",
                    r"Software\Microsoft\EdgeUpdate\Clients\{F3017226-F553-41E6-9021-49480E51820C}",
                ]:
                    try:
                        with winreg.OpenKey(root_key, subkey) as key:
                            ver, _ = winreg.QueryValueEx(key, "pv")
                            if ver:
                                wv2_installed = True
                                print(colorize("PASS", f"Microsoft Edge WebView2 Runtime detected (v{ver})."))
                                break
                    except OSError:
                        pass
                if wv2_installed:
                    break
            if not wv2_installed:
                print(colorize("WARN", "WebView2 Runtime not found in registry. Native desktop client may require the WebView2 Evergreen Bootstrapper."))
        except Exception as e:
            print(colorize("WARN", f"Could not inspect WebView2 registry: {e}"))

    return all_ok

def check_network():
    print("\n--- 3. Network & Ports ---")
    # Resolve LAN IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        print(f"Local LAN IP:  {local_ip}")
        print(f"Customer URL:  http://{local_ip}:8000/#/customer-display")
    except Exception:
        local_ip = "127.0.0.1"
        print(f"Local LAN IP:  {local_ip} (Offline / Loopback only)")

    # Test Port 8000
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    try:
        sock.bind(("0.0.0.0", 8000))
        sock.close()
        print(colorize("PASS", "Port 8000 is free and available for VoltFlow POS backend."))
    except OSError:
        print(colorize("WARN", "Port 8000 is currently occupied by another process!"))
        print("       Check if VoltFlow POS is already running, or if another web server/IIS is bound to :8000.")

def check_peripherals():
    print("\n--- 4. Peripherals (Printers, COM Ports, Scanners) ---")
    # Enumerate Serial Ports
    try:
        from serial.tools import list_ports
        ports = list(list_ports.comports())
        if ports:
            print(f"Found {len(ports)} serial/COM port(s):")
            for p in ports:
                print(f"  - {p.device}: {p.description} [{p.hwid}]")
            print(colorize("PASS", "Serial COM ports enumerated successfully."))
        else:
            print(colorize("INFO", "No active serial/COM ports detected (Virtual COM or USB-to-Serial unplugged)."))
    except ImportError:
        print(colorize("WARN", "pyserial not available in current environment to probe COM ports."))

    # Enumerate Windows Printers
    if sys.platform == "win32":
        try:
            import win32print
            flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            printers = win32print.EnumPrinters(flags)
            if printers:
                print(f"Found {len(printers)} installed Windows printer(s):")
                for prn in printers:
                    name = prn[2]
                    print(f"  - {name}")
                print(colorize("PASS", "Windows Print Spooler probed successfully."))
            else:
                print(colorize("WARN", "No Windows printers installed. Please install your thermal printer driver."))
        except Exception as e:
            print(colorize("WARN", f"Could not enumerate Windows printers: {e}"))

def check_storage():
    print("\n--- 5. Storage & Database Permissions ---")
    # Check disk space
    total, used, free = shutil.disk_usage(ROOT_DIR)
    free_mb = free / (1024 * 1024)
    print(f"Storage Free: {free_mb:.0f} MB")
    if free_mb < 500:
        print(colorize("WARN", f"Low disk space ({free_mb:.0f} MB). At least 1 GB recommended."))
    else:
        print(colorize("PASS", f"Sufficient storage available ({free_mb:.0f} MB)."))

    # Test file write in backend
    test_file = BACKEND_DIR / ".preflight_write_test"
    try:
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink()
        print(colorize("PASS", f"Write permissions verified in: {BACKEND_DIR}"))
    except Exception as e:
        print(colorize("FAIL", f"Cannot write to backend directory: {e}"))

def main():
    print("========================================================")
    print("  VoltFlow POS — Hardware & System Pre-Flight Audit")
    print("========================================================")

    check_os()
    check_runtimes()
    check_network()
    check_peripherals()
    check_storage()

    print("\n========================================================")
    print("  Pre-Flight Audit Complete!")
    print("  If any [FAIL] items are shown, resolve them before")
    print("  launching VoltFlow POS in production.")
    print("========================================================\n")

if __name__ == "__main__":
    main()
