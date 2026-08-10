@echo off
setlocal enabledelayedexpansion
title Himmel POS Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS in Dedicated Touch Kiosk Mode...
echo ========================================================
echo.

cd /d "%~dp0"

REM Resolve Python executable (prefer backend\venv Python if available)
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 1. Verify Prerequisites (Python and Node.js with Bypass option)
where python >nul 2>&1
if %errorlevel% neq 0 if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo [WARNING] Python missing in PATH and backend\venv.
    echo Press 'B' to bypass or any other key to launch installer
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

where node >nul 2>&1
if %errorlevel% neq 0 if not exist "%~dp0dist\index.html" (
    echo [WARNING] Node.js missing and dist\index.html build not found.
    echo Press 'B' to bypass or any other key to launch installer
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

REM 2. Ensure backend\.env exists with LAN configuration (0.0.0.0)
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

REM 3. Build production UI bundle before startup
echo [NPM] Building production UI bundle
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm run build
) else (
    if not exist "%~dp0dist\index.html" (
        echo [WARNING] npm command not found and dist\index.html missing!
    )
)

REM 4. Check if backend is already running on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is already active on port 8000.
) else (
    echo Starting Himmel POS Backend Service...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    echo Waiting for backend server...
    timeout /t 3 /nobreak >nul 2>&1
)

REM 5. Open MS Edge in Full-Screen Kiosk Mode
echo Launching Full-Screen Touch Kiosk Mode...

set "EDGE_EXE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
) else (
    where msedge >nul 2>&1
    if %errorlevel% equ 0 set "EDGE_EXE=msedge"
)

if not "!EDGE_EXE!"=="" (
    start "" "!EDGE_EXE!" --kiosk http://localhost:8000 --edge-kiosk-type=fullscreen
) else (
    start http://localhost:8000
)

