@echo off
title Himmel POS — Debug Mode
echo ========================================================
echo   Starting Himmel POS (DEBUG MODE - All Terminals Visible)
echo ========================================================
echo.

:: 1. Navigate to script root
cd /d "%~dp0"

:: 2. Stop any existing instances to avoid port conflicts
echo Stopping existing processes...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web Dev*" >nul 2>&1

:: 3. Launch Python Backend in separate terminal window
echo [1/3] Launching Python FastAPI Backend terminal...
start "Himmel POS Backend (Debug)" cmd /k "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && python main.py"

:: 4. Launch Vite Web Dev server in separate terminal window
echo [2/3] Launching Vite Web Server terminal...
start "Himmel POS Web Dev (Debug)" cmd /k "cd /d "%~dp0" && npm run dev"

:: 5. Launch Litestream terminal if present
if exist "%~dp0backend\litestream.exe" (
    echo [3/3] Launching Litestream Replication terminal...
    start "Himmel POS Litestream (Debug)" cmd /k "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
)

:: 6. Wait for servers to spin up
echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

:: 7. Launch Browser
echo Opening browser at http://localhost:5173 ...
start "Himmel POS App (Debug)" msedge --app=http://localhost:5173 --start-maximized

echo.
echo ========================================================
echo   Debug mode active!
echo   - Backend live on http://localhost:8000
echo   - Frontend dev server on http://localhost:5173
echo   - All terminal windows are visible for live logging
echo ========================================================
