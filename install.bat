@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Installation
echo ========================================================
echo   VoltFlow POS - Project Installation (Windows)
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Verify Prerequisites
echo [0/4] Checking system prerequisites...

REM Check Python presence
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python was not found on your system PATH.
    echo.
    echo Please install Python 3.10+ (64-bit) from https://www.python.org/downloads/
    echo CRITICAL: Ensure you check "Add python.exe to PATH" during installation.
    echo.
    pause
    exit /b 1
)

REM Detect Windows Store stub vs real Python
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python 3.10 or higher is required.
    echo Your current Python version or Microsoft Store alias is invalid.
    echo.
    echo 1. Disable Windows App Execution Aliases: Settings ^> Apps ^> Advanced app settings ^> App execution aliases ^> Disable 'python'
    echo 2. Download and install Python 3.10, 3.11, 3.12, or 3.14 from https://www.python.org/
    echo 3. Check "Add python.exe to PATH"
    echo.
    pause
    exit /b 1
)

REM Check Node.js and npm
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js LTS (18+) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] npm is not found. Please install Node.js LTS from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check for Port 8000 conflict
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8000 is currently in use by another process.
    echo You may need to stop conflicting services (e.g., IIS or dev servers)
    echo or configure PORT in backend\.env after installation.
    echo.
)

REM 2. Create Python virtual environment
echo.
echo [1/4] Setting up Python virtual environment...
if not exist "%~dp0backend\venv\Scripts\python.exe" (
    python -m venv "%~dp0backend\venv"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create Python virtual environment.
        pause
        exit /b !errorlevel!
    )
)
set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"

echo Upgrading pip and installing backend dependencies...
"%PYTHON_EXE%" -m pip install --upgrade pip >nul 2>&1
"%PYTHON_EXE%" -m pip install -r "%~dp0backend\requirements.txt"
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install Python dependencies from backend\requirements.txt.
    pause
    exit /b !errorlevel!
)

REM Run pywin32 post-install configuration if present
if exist "%~dp0backend\venv\Scripts\pywin32_postinstall.py" (
    "%PYTHON_EXE%" "%~dp0backend\venv\Scripts\pywin32_postinstall.py" -install -silent >nul 2>&1
)

REM 3. Database migrations
echo.
echo [2/4] Applying database schema migrations...
"%PYTHON_EXE%" "%~dp0backend\migrations.py"
if !errorlevel! neq 0 (
    echo [ERROR] Database migration failed!
    pause
    exit /b !errorlevel!
)

REM 4. Setup .env
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
    echo [INFO] Created backend\.env configuration.
)

REM 5. Install frontend dependencies and build bundle
echo.
echo [3/4] Installing Node.js frontend dependencies...
call npm install
if !errorlevel! neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b !errorlevel!
)

echo.
echo [4/4] Building production UI bundle...
call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Frontend bundle build failed!
    pause
    exit /b !errorlevel!
)

REM Optional WebView2 detection
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-F553-41E6-9021-49480E51820C}" >nul 2>&1
if !errorlevel! neq 0 (
    reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-F553-41E6-9021-49480E51820C}" >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo [NOTICE] Microsoft Edge WebView2 runtime was not found in registry.
        echo If running native desktop shell, please download Evergreen Bootstrapper:
        echo https://developer.microsoft.com/en-us/microsoft-edge/webview2/
    )
)

echo.
echo ========================================================
echo   SUCCESS: VoltFlow POS Installation Complete!
echo ========================================================
echo.
echo   Quick Start:
echo     start_pos.bat       -^> Launch POS in kiosk/app mode
echo     debug.bat           -^> Launch POS in hot-reload dev mode
echo     start.bat           -^> Launch POS backend server (:8000)
echo.
echo   Hardware Checks:
echo     scripts\tools\hardware_preflight.bat  -^> Audit POS hardware
echo ========================================================
echo.
pause
