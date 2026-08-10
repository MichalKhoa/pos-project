@echo off
setlocal enabledelayedexpansion
title Himmel POS — Cashier & Customer Display Mode
echo ========================================================
echo   Starting Himmel POS (Cashier & Customer Display)...
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Verify Prerequisites (Python & Node.js with Bypass option)
where python >nul 2>&1
if %errorlevel% neq 0 (
    if not exist "%~dp0backend\venv\Scripts\python.exe" (
        echo [WARNING] Python missing in PATH and backend\venv.
        echo Press 'B' to bypass or any other key to launch installer...
        set /p "CHOICE=Choice [B to bypass]: "
        if /i "!CHOICE!" neq "B" (
            call "%~dp0Himmel_POS_Install.bat"
        )
    )
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    if not exist "%~dp0dist\index.html" (
        echo [WARNING] Node.js missing and frontend build (dist) not found.
        echo Press 'B' to bypass or any other key to launch installer...
        set /p "CHOICE=Choice [B to bypass]: "
        if /i "!CHOICE!" neq "B" (
            call "%~dp0Himmel_POS_Install.bat"
        )
    )
)

:: 2. Ensure backend\.env exists with LAN configuration (0.0.0.0)
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

:: 3. Build UI bundle for fresh startup before frontend starts
echo [NPM] Building fresh UI bundle (npm run build)...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm run build
) else (
    if not exist "%~dp0dist\index.html" (
        echo [WARNING] npm command not found and dist\index.html missing!
    )
)

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
