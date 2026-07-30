# ⚙️ Himmel POS — Windows Service & Auto-Start Setup Guide

This guide explains how to set up the **Himmel POS Python FastAPI Backend** to run as a native **Windows Service (Microservice)** that starts automatically when the Windows device boots up—**before any user logs in**—and auto-restarts if it crashes.

---

## 🎯 Overview of Approaches

| Method | Starts at Boot (No Login) | Auto-Restart on Crash | Installation Complexity | Recommended Use Case |
|---|:---:|:---:|:---:|---|
| **Option 1: NSSM Windows Service** | ✅ Yes | ✅ Yes | 🟢 Low (2 min) | **Production POS Kiosks** |
| **Option 2: Windows Task Scheduler** | ✅ Yes | ⚠️ Partial | 🟡 Medium | Built-in Windows Native |
| **Option 3: Startup Folder (`shell:startup`)** | ❌ Requires Login | ❌ No | 🟢 Very Low | Simple Desktop Kiosk |

---

## 🚀 Option 1: NSSM Windows Service (Recommended for Production)

[NSSM (Non-Sucking Service Manager)](https://nssm.cc/) converts any Python script into a true, native Windows Service managed by `services.msc`.

### Step 1: Download NSSM
1. Download NSSM from [nssm.cc/download](https://nssm.cc/download).
2. Extract `nssm.exe` (from `win64/` directory) into `C:\Windows\System32\` or your project root directory.

### Step 2: Install the Service
1. Open **Command Prompt as Administrator**.
2. Run the NSSM installer GUI:
   ```cmd
   nssm install HimmelPOSBackend
   ```
3. In the NSSM configuration window, set:
   - **Path:** `C:\path\to\pos-eet-himmel\backend\venv\Scripts\python.exe` *(or system `python.exe`)*
   - **Startup directory:** `C:\path\to\pos-eet-himmel\backend`
   - **Arguments:** `main.py`
   - **Details → Display name:** `Himmel POS FastAPI Backend`
   - **Details → Description:** `Provides SQLite database, EET fiscalization, and hardware printing for Himmel POS.`
   - **Details → Startup type:** `Automatic`
4. Click **Install service**.

### Step 3: Start and Verify
```cmd
net start HimmelPOSBackend
```
Verify the service status:
```cmd
sc query HimmelPOSBackend
```
Or open Windows Services via `Win + R` → `services.msc` and locate **Himmel POS FastAPI Backend**.

### Service Management Commands
- **Start service:** `net start HimmelPOSBackend`
- **Stop service:** `net stop HimmelPOSBackend`
- **Restart service:** `nssm restart HimmelPOSBackend`
- **Remove service:** `nssm remove HimmelPOSBackend confirm`

---

## ⏱️ Option 2: Windows Task Scheduler (Native Windows Setup)

If third-party binaries like NSSM are prohibited:

1. Press `Win + R`, type `taskschd.msc`, and press **Enter**.
2. Click **Create Task...** in the right sidebar.
3. **General Tab:**
   - Name: `Himmel POS Backend Service`
   - Select: **Run whether user is logged on or not**
   - Check: **Run with highest privileges**
4. **Triggers Tab:**
   - Click **New...** → Select **At startup**.
5. **Actions Tab:**
   - Click **New...** → Action: **Start a program**.
   - Program/script: `C:\path\to\pos-eet-himmel\backend\venv\Scripts\python.exe`
   - Add arguments: `main.py`
   - Start in: `C:\path\to\pos-eet-himmel\backend`
6. Click **OK** and enter your Windows account password to confirm.

---

## 🖥️ Option 3: Shell Startup Folder (User Login Trigger)

If you want the full POS app (backend + frontend UI) to launch when the cashier user account logs in:

1. Press `Win + R`, type `shell:startup`, and press **Enter**.
2. Create a shortcut to `Himmel_POS.bat` inside this folder.
3. On Windows login, the POS will launch automatically.

---

## 🛠️ Combined Recommended Kiosk Architecture

For dedicated retail touchscreen kiosks:
1. **Backend (Python FastAPI):** Configured as an **NSSM Windows Service** (Option 1) → Starts on boot automatically in the background.
2. **Frontend (Vite / Edge Kiosk):** Added to **Shell Startup** (Option 3) → Launches fullscreen POS UI when the cashier logs in.
