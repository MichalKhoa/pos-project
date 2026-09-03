@echo off
setlocal enabledelayedexpansion
title Himmel POS - 1-Click Complete Setup
echo ========================================================
echo   Himmel POS Automated 1-Click Setup & Installer
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Verify / Auto-Install Python
echo [1/6] Checking Python 3...
where python >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0backend\venv\Scripts\python.exe" (
        echo [OK] Existing virtual environment found in backend\venv.
    ) else (
        echo [INFO] Installing Python 3.11 via Winget...
        winget install --id Python.Python.3.11 --exact --accept-package-agreements --accept-source-agreements
        if !errorlevel! neq 0 (
            echo [WARNING] Automatic Python install failed. Please install Python 3.10+ manually.
        )
    )
) else (
    echo [OK] Python is installed.
)

REM 2. Verify / Auto-Install Node.js
echo.
echo [2/6] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Node.js LTS via Winget...
    winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo [WARNING] Automatic Node.js install failed. Please install Node.js LTS manually.
    )
) else (
    echo [OK] Node.js is installed.
)

REM 3. Setup Python Virtual Environment and Backend Dependencies
echo.
echo [3/6] Setting up Python virtual environment and dependencies...
if not exist "%~dp0backend\venv" (
    python -m venv "%~dp0backend\venv" 2>nul || py -m venv "%~dp0backend\venv" 2>nul
)

set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

if exist "%~dp0backend\requirements.txt" (
    "%PYTHON_EXE%" -m pip install --upgrade pip --quiet
    "%PYTHON_EXE%" -m pip install -r "%~dp0backend\requirements.txt" --quiet
    echo [OK] Backend Python packages installed.
    echo [INFO] Initializing database schema & applying migrations...
    "%PYTHON_EXE%" "%~dp0backend\migrations.py"
)

REM 4. Ensure backend/.env Configuration
echo.
echo [4/6] Creating backend environment configuration (.env)...
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
    echo [OK] Created backend\.env with LAN binding (HOST=0.0.0.0).
) else (
    echo [OK] backend\.env already exists.
)

REM 5. Install Node modules and Compile React UI
echo.
echo [5/6] Installing frontend packages and compiling production UI bundle...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm install --no-audit --no-fund
    call npm run build
    echo [OK] Frontend UI compiled to dist/.
) else (
    echo [WARNING] npm command not available.
)

REM 6. Configure Windows Firewall for LAN & Phone Display (if Administrator)
echo.
echo [6/6] Configuring Windows Defender Firewall for LAN & Mobile Display...
net session >nul 2>&1
if %errorlevel% equ 0 (
    netsh advfirewall firewall delete rule name="Himmel POS Backend (Port 8000)" >nul 2>&1
    netsh advfirewall firewall add rule name="Himmel POS Backend (Port 8000)" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1
    echo [OK] Firewall rule for port 8000 configured.
) else (
    echo [INFO] Running without administrator privileges (Firewall rules skipped).
)

echo.
echo ========================================================
echo   INSTALLATION COMPLETED SUCCESSFULLY!
echo.
echo   To start the POS:         Run Himmel_POS.bat
echo   To enable auto-boot:      Run Himmel_POS_Service_Install.bat
echo   To develop / debug:       Run Himmel_POS_Debug.bat
echo ========================================================
echo.
pause
