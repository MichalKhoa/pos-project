@echo off
setlocal enabledelayedexpansion
title Himmel POS
echo ========================================================
echo   Starting Himmel POS
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Resolve Python Executable
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Ensure frontend UI is built; only compile if dist/ is missing
if not exist "%~dp0dist\index.html" (
    echo [NPM] Compiling frontend UI bundle (first run)...
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        call npm run build
    )
)

REM 3. Ensure backend is running on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is active on port 8000.
) else (
    echo [INFO] Starting Backend Server...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    timeout /t 2 /nobreak >nul 2>&1
)

REM 4. Start Litestream Database Backup if present and not running
if exist "%~dp0backend\litestream.exe" (
    tasklist /FI "IMAGENAME eq litestream.exe" 2>nul | findstr /i "litestream.exe" >nul 2>&1
    if %errorlevel% neq 0 (
        start "Himmel POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
    )
)

REM 5. Display Local Network IP and Phone Customer Display Screen URL
echo.
echo ========================================================
echo   PHONE CUSTOMER DISPLAY - Open on phone / tablet:
echo ========================================================
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | ForEach-Object { Write-Host ('   Customer Display: http://' + $_.IPAddress + ':8000/#/customer-display') -ForegroundColor Green }"
echo ========================================================
echo.

REM 6. Launch POS Register UI in Microsoft Edge App Mode
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
timeout /t 3 /nobreak >nul 2>&1
