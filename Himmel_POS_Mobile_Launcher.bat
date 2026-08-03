@echo off
title Himmel POS — Mobile & LAN Launcher
echo ========================================================
echo   Himmel POS — Starting for Phone / LAN Access
echo ========================================================
echo.

:: 1. Ensure backend\.env exists with LAN configuration
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

:: 2. Launch Python FastAPI Backend
echo Starting Python Backend Service...
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && python main.py"

:: 3. Launch Vite Dev Server on 0.0.0.0
echo Starting Vite Frontend Server...
start "Himmel POS Frontend" /min cmd /c "cd /d "%~dp0" && npm run dev -- --host 0.0.0.0"

:: 4. Wait for services to bind
timeout /t 3 /nobreak >nul

:: 5. Detect and display local network IP addresses
echo.
echo ========================================================
echo   📱 OPEN THIS URL ON YOUR PHONE (CHROME):
echo ========================================================
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | Select-Object -ExpandProperty IPAddress | ForEach-Object { Write-Host '   👉 Single-Process URL: http://' $_ ':8000' -ForegroundColor Green; Write-Host '   👉 Dev Server URL:      http://' $_ ':5173' -ForegroundColor Yellow }"
echo ========================================================
echo.
echo Notes:
echo  1. Ensure your phone is connected to the SAME Wi-Fi network.
echo  2. Keep this window open while using the app on your phone.
echo.
pause
