import os
import sys
import glob
import subprocess
import logging

logger = logging.getLogger("pos-printer-discovery")


def detect_connected_printers():
    """
    Scans host system for connected thermal printer hardware devices:
    - Windows Spooler Printers (win32print)
    - USB Direct Nodes (/dev/usb/lp*, /dev/usblp*)
    - Serial/TTY Nodes (/dev/ttyUSB*, /dev/ttyACM*)
    - CUPS System Printers
    - Network / Browser Print
    """
    devices = []

    # 0. Check Windows installed printers via win32print when running on Windows
    if os.name == 'nt':
        try:
            import win32print
            printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            for idx, p in enumerate(printers):
                pname = p[2]
                port = p[1]
                is_pos = any(kw in pname.upper() for kw in ["EPSON", "RECEIPT", "POS", "THERMAL", "TICKETING", "TM-T", "TSP", "STAR"])
                devices.append({
                    "id": pname,
                    "name": f"Windows Tiskárna ({pname} • {port})",
                    "interface": "WIN32",
                    "address": pname,
                    "status": "CONNECTED",
                    "is_default": is_pos or (idx == 0)
                })
        except Exception as win_err:
            logger.warning(f"Failed to scan Windows printers via win32print: {win_err}")

    # 1. Check USB Thermal Printer character devices (/dev/usb/lp0, lp1, etc.)
    usb_paths = sorted(glob.glob("/dev/usb/lp*") + glob.glob("/dev/usblp*"))
    for idx, path in enumerate(usb_paths):
        devices.append({
            "id": path,
            "name": f"USB Tiskárna účtenek ({path})",
            "interface": "USB",
            "address": path,
            "status": "CONNECTED",
            "is_default": (not devices) and (idx == 0)
        })

    # 2. Check Serial/TTY POS Printer ports (/dev/ttyUSB*, /dev/ttyACM*)
    tty_paths = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
    for path in tty_paths:
        devices.append({
            "id": path,
            "name": f"Sériová TTY Tiskárna ({path})",
            "interface": "SERIAL",
            "address": path,
            "status": "CONNECTED",
            "is_default": False
        })

    # 3. Check CUPS System Printers via lpstat if available (Unix/Linux/macOS only)
    if os.name != 'nt' and sys.platform != 'win32':
        try:
            res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    if "printer" in line:
                        parts = line.split()
                        if len(parts) >= 2:
                            pname = parts[1]
                            devices.append({
                                "id": f"cups-{pname}",
                                "name": f"Systémová tiskárna CUPS ({pname})",
                                "interface": "CUPS",
                                "address": pname,
                                "status": "CONNECTED",
                                "is_default": False
                            })
        except Exception:
            pass

    # 4. Fallback Default USB device if no physical hardware detected
    if not devices:
        devices.append({
            "id": "/dev/usb/lp0",
            "name": "USB Tiskárna účtenek (/dev/usb/lp0)",
            "interface": "USB",
            "address": "/dev/usb/lp0",
            "status": "DEFAULT",
            "is_default": True
        })

    # 5. Network Printer & Web Browser Print Option
    devices.append({
        "id": "network-custom",
        "name": "Síťová tiskárna (Ethernet / Wi-Fi IP)",
        "interface": "NETWORK",
        "address": "192.168.1.100",
        "status": "CUSTOM",
        "is_default": False
    })
    devices.append({
        "id": "browser-print",
        "name": "Webový systémový tisk (Pop-up window)",
        "interface": "BROWSER",
        "address": "window.print()",
        "status": "VIRTUAL",
        "is_default": False
    })

    return devices
