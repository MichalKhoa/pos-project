@echo off
title Himmel POS — Debug Mode (Open Terminals & Logs)
echo ========================================================
echo   Starting Himmel POS (DEBUG MODE - Visible Terminals)
echo ========================================================
echo.

:: 1. Launch Python FastAPI Backend in visible terminal window
echo [1/3] Launching Python FastAPI Backend terminal...
start "Himmel POS Backend (Debug)" cmd /k "cd /d %~dp0backend && python main.py"

:: 2. Launch Litestream Replication in visible terminal window (if present)
if exist "%~dp0backend\litestream.exe" (
    echo [2/3] Launching Litestream Replication terminal...
    start "Himmel POS Litestream (Debug)" cmd /k "cd /d %~dp0backend && litestream.exe replicate -config litestream.yml"
)

:: 3. Launch Vite Web App Server in visible terminal window
echo [3/3] Launching Vite Web Server terminal...
start "Himmel POS Web Dev (Debug)" cmd /k "cd /d %~dp0 && npm run dev"

:: 4. Wait 3 seconds for servers to initialize
echo.
echo Waiting for backend & frontend servers to initialize...
timeout /t 3 /nobreak >nul

:: 5. Open Edge browser with DevTools enabled
echo Opening browser at http://localhost:5173 ...
start "Himmel POS App (Debug)" msedge --app=http://localhost:5173 --auto-open-devtools-for-tabs --start-maximized

echo.
echo Debug mode active. Check individual terminal windows for live logs.
echo ========================================================
