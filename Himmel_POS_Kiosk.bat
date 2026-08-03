@echo off
title Himmel POS Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS in Dedicated Touch Kiosk Mode...
echo ========================================================

:: 1. Check if production build exists; if not, build it
if not exist "%~dp0dist\index.html" (
    echo Building production UI bundle...
    call npm run build >nul 2>&1
)

:: 2. Launch Python FastAPI Backend silently in background (with venv)
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && set ENV=production && python main.py"

:: 3. Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: 4. Open MS Edge in Full-Screen Kiosk Mode
start "Himmel POS App" msedge --kiosk http://localhost:8000 --edge-kiosk-type=fullscreen
