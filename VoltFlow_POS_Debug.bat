@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Developer Debug Mode
echo ========================================================
echo   Starting VoltFlow POS - DEBUG MODE (Hot Reloading)
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Resolve Python Executable
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Free Ports 5173 & 8000 if occupied
taskkill /T /F /FI "WINDOWTITLE eq VoltFlow POS Backend*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq VoltFlow POS Web Dev*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web Dev*" >nul 2>&1

REM 3. Launch Python Backend in visible terminal
echo [INFO] Checking database migrations and schema changes...
"%PYTHON_EXE%" "%~dp0backend\migrations.py"
echo [1/2] Launching Python FastAPI Backend terminal (port 8000)...
start "VoltFlow POS Backend (Debug)" /D "%~dp0backend" cmd /k "set ENV=development&& "%PYTHON_EXE%" main.py"

REM 4. Launch Vite Dev Server in visible terminal
echo [2/2] Launching Vite Frontend Dev Server (port 5173)...
start "VoltFlow POS Web Dev (Debug)" /D "%~dp0" cmd /k "npm run dev"

REM 5. Brief readiness wait
ping -n 3 127.0.0.1 >nul 2>&1

REM 6. Open Edge in App Mode at dev port 5173
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
    echo [LAUNCH] Opening Microsoft Edge in App Mode...
    start "" "!EDGE_EXE!" --app=http://localhost:5173 --auto-open-devtools-for-tabs
) else (
    echo [LAUNCH] Opening default browser...
    start http://localhost:5173
)

echo.
echo ========================================================
echo   VoltFlow POS Debug Environment Active!
echo ========================================================
echo.
