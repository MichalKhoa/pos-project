@echo off
title Himmel POS — Cashier & Customer Display Mode
echo ========================================================
echo   Starting Himmel POS (Cashier & Customer Display)...
echo ========================================================
echo.

:: 1. Navigate to script root
cd /d "%~dp0"

:: 2. Ensure backend\.env exists with LAN configuration (0.0.0.0)
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

:: 3. Build UI bundle for fresh startup
echo Building UI bundle for startup...
call npm run build

:: 4. Stop any existing background POS processes to avoid port conflicts
echo Checking for previous instances...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1

:: 5. Start Python FastAPI backend in minimized window
echo Starting Backend Service (LAN & Customer Display Ready)...
start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && set ENV=production && python main.py"

:: 6. Start Litestream if present
if exist "%~dp0backend\litestream.exe" (
    echo Starting Database Replication...
    start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
)

:: 7. Wait for backend startup
echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

:: 8. Display Local Network IP & Phone Customer Screen URLs
echo.
echo ========================================================
echo   📱 PHONE CUSTOMER DISPLAY URL (Open on your phone):
echo ========================================================
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | Select-Object -ExpandProperty IPAddress | ForEach-Object { Write-Host '   👉 Phone Customer Screen: http://' $_ ':8000/#/customer-display' -ForegroundColor Green }"
echo ========================================================
echo.

:: 9. Launch Cashier Display in Edge App Mode
echo Opening Cashier Application...
start "Himmel POS App" msedge --app=http://localhost:8000 --start-maximized

echo.
echo ========================================================
echo   Himmel POS is running!
echo   To stop all services, run: Himmel_POS_Stop.bat
echo ========================================================
timeout /t 5 >nul

