@echo off
setlocal enabledelayedexpansion
title Himmel POS - Cashier and Customer Display Mode
echo ========================================================
echo   Starting Himmel POS - Cashier and Customer Display
echo ========================================================
echo.

cd /d "%~dp0"

REM Resolve Python executable (prefer backend\venv Python if available)
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 1. Verify Prerequisites (Python and Node.js with Bypass option)
where python >nul 2>&1
if %errorlevel% neq 0 if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo [WARNING] Python missing in PATH and backend\venv.
    echo Press 'B' to bypass or any other key to launch installer
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

where node >nul 2>&1
if %errorlevel% neq 0 if not exist "%~dp0dist\index.html" (
    echo [WARNING] Node.js missing and frontend build dist not found.
    echo Press 'B' to bypass or any other key to launch installer
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

REM 2. Ensure backend\.env exists with LAN configuration (0.0.0.0)
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

REM 3. Ensure UI bundle (dist\index.html) is built
if not exist "%~dp0dist\index.html" (
    echo [NPM] Building UI bundle
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        call npm run build
    ) else (
        echo [WARNING] npm command not found and dist\index.html missing!
    )
)

REM 4. Check if backend is already running on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is already running on port 8000.
) else (
    echo [INFO] Starting Backend Service - LAN and Customer Display Ready...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    echo Waiting for backend server initialization...
    timeout /t 3 /nobreak >nul
)

REM 5. Start Litestream if present and not running
if exist "%~dp0backend\litestream.exe" (
    tasklist /FI "IMAGENAME eq litestream.exe" 2>nul | findstr /i "litestream.exe" >nul 2>&1
    if %errorlevel% neq 0 (
        echo Starting Database Replication...
        start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
    )
)

REM 6. Display Local Network IP and Phone Customer Screen URLs
echo.
echo ========================================================
echo   PHONE CUSTOMER DISPLAY URL - Open on your phone:
echo ========================================================
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | ForEach-Object { Write-Host ('   Phone Customer Screen: http://' + $_.IPAddress + ':8000/#/customer-display') -ForegroundColor Green }"
echo ========================================================
echo.

REM 7. Launch Cashier Display in Edge App Mode or Default Browser
echo Opening Cashier Application at http://localhost:8000 ...

set "EDGE_EXE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
) else (
    where msedge >nul 2>&1
    if %errorlevel% equ 0 set "EDGE_EXE=msedge"
)

if not "!EDGE_EXE!"=="" (
    start "" "!EDGE_EXE!" --app=http://localhost:8000 --start-maximized
) else (
    start http://localhost:8000
)

echo.
echo ========================================================
echo   Himmel POS is running!
echo   To stop all services, run: Himmel_POS_Stop.bat
echo ========================================================
timeout /t 5 /nobreak >nul 2>&1



