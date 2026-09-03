@echo off
setlocal enabledelayedexpansion
title Himmel POS Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS in Dedicated Touch Kiosk Mode...
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Resolve Python Executable
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Ensure dist/ exists
if not exist "%~dp0dist\index.html" (
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        call npm run build
    )
)

REM 3. Check if backend is already running on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Checking database migrations & schema changes...
    "%PYTHON_EXE%" "%~dp0backend\migrations.py"
    echo Starting Himmel POS Backend Service...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    timeout /t 2 /nobreak >nul 2>&1
)

REM 4. Open MS Edge in Full-Screen Kiosk Mode
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
