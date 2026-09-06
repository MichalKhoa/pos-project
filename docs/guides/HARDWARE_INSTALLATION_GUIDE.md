# VoltFlow POS — Hardware Installation & Deployment Guide

This guide provides comprehensive, step-by-step instructions for installing and configuring VoltFlow POS on **completely new hardware** (touchscreen POS terminals, mini PCs, Windows IoT Enterprise, or standard Windows/Linux retail PCs).

---

## 1. Hardware & System Prerequisites

### Minimum Hardware Requirements
| Component | Minimum Specification | Recommended Specification |
|-----------|-----------------------|---------------------------|
| **Processor** | Intel Celeron / Core i3 (x64) | Intel Core i3/i5 (64-bit) |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 10 GB free SSD | 20 GB+ NVMe SSD |
| **Display** | 1024×768 Touchscreen | 1280×800 or 1920×1080 Capacitive Touchscreen |
| **Ports** | 2× USB-A, 1× Ethernet (RJ45) / Wi-Fi | 4× USB-A, 1× RJ45 Gigabit Ethernet, HDMI out |

### Supported Operating Systems
- **Windows**: Windows 11, Windows 10 (64-bit), Windows 10 IoT Enterprise LTSC.
- **Linux**: Ubuntu 22.04 LTS+, Debian 12+, Raspberry Pi OS 64-bit.

---

## 2. Pre-Installation OS Preparation (Windows)

Before running the POS installation on a fresh machine, apply the following Windows settings:

1. **Disable Sleep & Display Turn-Off**:
   - Open **Settings** > **System** > **Power & battery** > **Screen and sleep**.
   - Set *When plugged in, turn off my screen after* -> **Never**.
   - Set *When plugged in, put my device to sleep after* -> **Never**.
2. **Prevent Windows Update Restarts During Store Hours**:
   - Open **Settings** > **Windows Update** > **Advanced options** > **Active hours**.
   - Set active hours covering your business opening hours (e.g., 07:00 to 22:00).
3. **Disable Microsoft Store Python Aliases** (if installing from source):
   - Open **Settings** > **Apps** > **Advanced app settings** > **App execution aliases**.
   - Toggle **App Installer (python.exe)** and **App Installer (python3.exe)** to **OFF**.
4. **Install Microsoft Visual C++ Redistributable**:
   - Download and install the [Microsoft Visual C++ 2015–2022 Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe).
5. **Install Microsoft Edge WebView2 Runtime** (for native desktop app):
   - Included natively on Windows 11 and recent Windows 10. If missing (e.g. on LTSC), install the [Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## 3. Peripheral Hardware Wiring & Configuration

### A. ESC/POS Thermal Receipt Printer (80mm / 58mm)
VoltFlow POS supports direct Windows Print Spooler (`win32print`), USB raw printing, and Network/Ethernet (TCP port 9100).
1. Connect the printer to the terminal via USB or Ethernet.
2. Power on the printer and load thermal paper (coated side facing printhead).
3. Install the manufacturer printer driver (e.g., EPSON TM-T20, Xprinter, Rongta, POS58/POS80).
4. Perform a Windows test print to ensure the spooler is functional.
5. In VoltFlow POS Settings (**Settings > Hardware > Receipt Printer**):
   - Choose **Windows Spooler** and select the installed printer name, OR
   - Choose **Network** and enter the printer's static IP (port `9100`).

### B. RJ11 Cash Drawer
1. Connect the RJ11 cable from the bottom of the cash drawer to the **DK (Drawer Kick) / RJ11 port** on the back of your thermal receipt printer.
2. The cash drawer opens automatically when a receipt prints or when the manual "Open Drawer" button is tapped in the POS UI.

### C. USB Barcode Scanner
1. Plug the barcode scanner into any USB port.
2. By default, scanners operate in **USB HID Keyboard Emulation Mode**.
3. Scan the manufacturer's configuration barcode to enable **Carriage Return (CR / Enter)** suffix after every scan.
4. Test by opening Notepad and scanning a product barcode: the code should type out and automatically drop to a new line.

### D. Dual-Screen Customer Display
VoltFlow POS provides a real-time WebSocket customer display (`/api/v1/ws/customer-display`).
- **Option 1: HDMI/VGA Secondary Monitor**:
  - Connect secondary screen and set Windows Display to **Extend these displays**.
  - In VoltFlow POS Desktop app, click **Open Customer Display** from the tray menu or Settings. The customer screen window can be dragged to the secondary monitor and maximized.
- **Option 2: Tablet / Phone / Android Screen**:
  - Connect the tablet to the same local Wi-Fi.
  - Open a browser on the tablet and navigate to `http://<POS-TERMINAL-IP>:8000/#/customer-display`.

---

## 4. Installation Methods

### Method 1: Native Windows Desktop Installer (Recommended for Cashiers)
*Zero developer dependencies required on client hardware.*

1. Copy `VoltFlow-POS-Setup.exe` (generated via `scripts\build\build_windows_release.bat`) to the target machine.
2. Run `VoltFlow-POS-Setup.exe` and follow the on-screen installer prompts.
3. Launch **VoltFlow POS** from the desktop or Start Menu shortcut.
4. The application automatically starts the backend sidecar and opens the touch-optimized register.

---

### Method 2: Standalone Zero-Dependency Bundle
*No Python or Node.js required on client hardware.*

1. Run `scripts\build\build_standalone.bat` on your build machine to generate the standalone bundle.
2. Copy the project folder containing `backend\dist_standalone\` to the POS terminal.
3. Run `start.bat`.
4. The script verifies port availability, starts the pre-compiled backend executable, and opens the POS UI in Microsoft Edge App Mode.

---

### Method 3: Source Installation (Development & POS Server)
*Requires Python 3.10+ and Node.js 18+.*

1. Install **Python 3.10+ (64-bit)**. Check **Add python.exe to PATH** and click **Disable path length limit**.
2. Install **Node.js LTS (18+)**.
3. Clone or copy the repository onto the terminal:
   ```cmd
   git clone https://github.com/MichalKhoa/pos-project-himmel.git
   cd pos-project-himmel
   ```
4. Run the installer script:
   ```cmd
   install.bat
   ```
5. The installer validates dependencies, sets up the virtual environment, configures `pywin32`, runs database migrations, installs npm packages, and builds the production UI bundle.

---

## 5. Hardware Pre-Flight Verification Tool

To verify that your new hardware terminal is fully operational before opening the store, run the built-in diagnostic tool:

```cmd
scripts\tools\hardware_preflight.bat
```
*(Or via Python: `python scripts\tools\hardware_preflight.py`)*

The tool automatically audits and outputs:
- **Operating System & Architecture** (64-bit check, admin elevation).
- **Runtimes & Runtimes Status** (Python, Node.js, PyInstaller, pywin32, WebView2).
- **Network & Ports** (LAN IP, Customer Display URL, Port 8000 availability).
- **Peripherals** (USB/Serial COM ports, Windows Print Spooler thermal printers).
- **Storage & Database Permissions** (Free disk space, SQLite directory write permissions).

---

## 6. Windows Firewall: Allowing Port 8000 on Local LAN

To allow customer-facing screens, mobile waiter tablets, or kitchen displays to reach the POS server:

1. Open **PowerShell as Administrator**.
2. Run the following command:
   ```powershell
   New-NetFirewallRule -DisplayName "VoltFlow POS Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```
3. Your POS customer display and API will now be accessible across the local network at `http://<POS-TERMINAL-IP>:8000`.

---

## 7. Auto-Start on System Boot & Kiosk Mode

### Option A: Windows Autostart Shortcut
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut to `start.bat` (or the desktop executable) in this folder.
3. Enable Windows automatic user login via `netplwiz` so the terminal boots directly into the POS register without a password prompt.

### Option B: Windows Background Service (NSSM)
To run the POS backend silently in the background as a resilient Windows service:
1. Open an elevated Administrator command prompt.
2. Run:
   ```cmd
   scripts\tools\Himmel_POS_Service_Install.bat
   ```
3. The service will restart automatically if the terminal loses power or reboots.

---

## 8. Troubleshooting Common Hardware Issues

| Issue | Root Cause | Solution |
|-------|------------|----------|
| **Receipt printer does not print** | Incorrect printer name or Windows spooler offline | Run `scripts\tools\hardware_preflight.bat` to list exact printer names. In POS settings, select the matching name. Check paper roll direction. |
| **Port 8000 already in use** | IIS, Skype, or existing backend process running | Run `netstat -ano \| findstr :8000` to find conflicting PID. Stop conflicting service or change `PORT=8001` in `backend\.env`. |
| **Cash drawer does not open** | Drawer cable plugged into wrong port | Ensure RJ11 cable is plugged into printer DK port (not phone/Ethernet socket). Verify printer driver has "Cash Drawer Kick" enabled in device settings. |
| **Customer screen shows "Offline"** | Firewalls blocking Port 8000 or IP changed | Run firewall command in Section 6. Assign a static IP or DHCP reservation to POS terminal on your router. |
| **Touchscreen swipes trigger Windows gestures** | Windows edge gestures enabled | Disable edge swipe in Windows Settings or enable Kiosk mode via `Himmel_POS_Kiosk.bat`. |
