@echo off
title Himmel POS — Cashier Mode
echo ========================================================
echo   Starting Himmel POS (Cashier Ready Mode)...
echo ========================================================
echo.

:: 1. Navigate to script root
cd /d "%~dp0"

:: 2. Check/Build UI bundle
if not exist "%~dp0dist\index.html" (
    echo Building UI bundle for first-time startup...
    call npm run build
)

:: 3. Stop any existing background POS processes to avoid port conflicts
echo Checking for previous instances...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1

:: 4. Start Python FastAPI backend in minimized window
echo Starting Backend Service...
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && set ENV=production && python main.py"

:: 5. Start Litestream if present
if exist "%~dp0backend\litestream.exe" (
    echo Starting Database Replication...
    start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
)

:: 6. Wait for backend startup
echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

:: 7. Launch Cashier Display in Edge App Mode
echo Opening Cashier Application...
start "Himmel POS App" msedge --app=http://localhost:8000 --start-maximized

echo.
echo ========================================================
echo   Himmel POS is running!
echo   To stop all services, run: Himmel_POS_Stop.bat
echo ========================================================
timeout /t 3 >nul
