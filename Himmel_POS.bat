@echo off
title Himmel POS — Silent Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS (Production Silent Mode)...
echo ========================================================

:: 0. Load environment variables from .env if present
if exist "%~dp0backend\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0backend\.env") do set "%%a=%%b"
) else if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0.env") do set "%%a=%%b"
)

:: 1. Check if production build exists; if not, build it or launch Vite dev server
set TARGET_URL=http://localhost:8000
if not exist "%~dp0dist\index.html" (
    echo Building production UI bundle...
    call npm run build >nul 2>&1
)

:: 2. Launch Python FastAPI Backend silently in virtualenv
echo Starting Python Backend Service (Silent)...
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && set ENV=production && python main.py"

:: 3. Launch Litestream Replication silently if present
if exist "%~dp0backend\litestream.exe" (
    echo Starting Database Replication (Silent)...
    start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
)

:: 4. Wait for initialization
timeout /t 3 /nobreak >nul

:: 5. Open Edge in Kiosk Window Mode
echo Opening Cashier Display at %TARGET_URL%...
start "Himmel POS App" msedge --app=%TARGET_URL% --start-maximized

echo Himmel POS is running in silent single-process mode.
