@echo off
setlocal enabledelayedexpansion
title Himmel POS - Mobile and LAN Launcher
echo ========================================================
echo   Himmel POS - Starting for Phone / LAN Access
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
    echo [WARNING] Node.js missing in PATH and dist\index.html missing.
    echo Press 'B' to bypass or any other key to launch installer
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

REM 2. Ensure backend\.env exists with LAN configuration
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

REM 3. Ensure UI bundle (dist\index.html) is built
if not exist "%~dp0dist\index.html" (
    echo [NPM] Building fresh UI bundle
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        call npm run build
    )
)

REM 4. Launch Python FastAPI Backend
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    sc query HimmelPOSBackend >nul 2>&1
    if !errorlevel! equ 0 (
        echo Starting Himmel POS NSSM Windows Service...
        net start HimmelPOSBackend >nul 2>&1
    ) else (
        echo Starting Python Backend Service...
        start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    )
)

REM 5. Launch Vite Dev Server on 0.0.0.0 (if npm available)
where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting Vite Frontend Server...
    start "Himmel POS Frontend" /min cmd /c "cd /d "%~dp0" && npm run dev -- --host 0.0.0.0"
)

REM 6. Wait for services to bind
timeout /t 3 /nobreak >nul 2>&1

REM 7. Detect and display local network IP addresses and Customer Display URLs
echo.
echo ========================================================
echo   📱 OPEN THESE URLS ON YOUR PHONE / TABLET:
echo ========================================================
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | ForEach-Object { Write-Host ('   Phone Customer Screen: http://' + $_.IPAddress + ':8000/#/customer-display') -ForegroundColor Green; Write-Host ('   Cashier Register URL:  http://' + $_.IPAddress + ':8000') -ForegroundColor Cyan; Write-Host ('   Customer Screen (Dev): http://' + $_.IPAddress + ':5173/#/customer-display') -ForegroundColor Yellow }"
echo ========================================================
echo.
echo Notes:
echo  1. Ensure your phone is connected to the SAME Wi-Fi network.
echo  2. Open the Phone Customer Screen URL on your secondary phone/tablet.
echo  3. Keep this window open while using Himmel POS.
echo.
pause

