@echo off
title Himmel POS Launcher
echo ========================================================
echo   Starting Himmel POS for Windows Touchscreen Monitor...
echo ========================================================

:: 1. Launch Python FastAPI Backend silently in background
echo Starting Hardware Backend...
start "Himmel POS Backend" /min cmd /c "cd /d %~dp0backend && python main.py"

:: 2. Launch Litestream Real-time Replication (if installed)
if exist "%~dp0backend\litestream.exe" (
    echo Starting Litestream Cloud Replication...
    start "Himmel POS Litestream" /min cmd /c "cd /d %~dp0backend && litestream.exe replicate -config litestream.yml"
)

:: 3. Launch Vite Web App Server silently in background
echo Starting Cashier Web Server...
start "Himmel POS Web" /min cmd /c "cd /d %~dp0 && npm run dev"

:: 3. Wait 3 seconds for servers to initialize
timeout /t 3 /nobreak >nul

:: 4. Open Cashier App in Full-Screen Desktop Window Mode
echo Opening Cashier Application on Touchscreen Monitor...
start "Himmel POS App" msedge --app=http://localhost:5173 --start-maximized

echo Done! Himmel POS is now running.
