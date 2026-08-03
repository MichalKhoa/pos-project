@echo off
title Himmel POS Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS in Dedicated Touch Kiosk Mode...
echo ========================================================

:: 1. Launch Python FastAPI Backend silently in background (with venv)
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && python main.py"

:: 2. Launch Vite Web App Server silently in background
start "Himmel POS Web" /min cmd /c "cd /d %~dp0 && npm run dev"

:: 3. Wait 3 seconds for servers to initialize
timeout /t 3 /nobreak >nul

:: 4. Open MS Edge in Full-Screen Kiosk Mode
start "Himmel POS App" msedge --kiosk http://localhost:5173 --edge-kiosk-type=fullscreen
