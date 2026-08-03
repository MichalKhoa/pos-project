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

:: 1. Launch Python FastAPI Backend silently in virtualenv
echo Starting Python Backend Service (Silent)...
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && python main.py"

:: 2. Launch Litestream Replication silently if present
if exist "%~dp0backend\litestream.exe" (
    echo Starting Database Replication (Silent)...
    start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
)

:: 3. Launch Vite Web App Server silently
echo Starting Cashier Interface (Silent)...
start "Himmel POS Web" /min cmd /c "cd /d "%~dp0" && npm run dev"

:: 4. Wait for initialization
timeout /t 3 /nobreak >nul

:: 5. Open Edge in Kiosk Window Mode
echo Opening Cashier Display...
start "Himmel POS App" msedge --app=http://localhost:5173 --start-maximized

echo Himmel POS is running in silent mode.
