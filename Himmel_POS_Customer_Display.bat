@echo off
setlocal enabledelayedexpansion
title Himmel POS - Customer Display Launcher
echo ========================================================
echo   Starting Himmel POS - Dedicated Customer Display Screen
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
    echo Press 'B' to bypass or any other key to launch installer...
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

REM 2. Build production UI bundle before startup
echo [NPM] Ensuring frontend UI bundle is up to date (npm run build)...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm run build
)

REM 3. Check if backend is already running; if not, launch it
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Python Backend Service...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    timeout /t 3 /nobreak >nul 2>&1
)

REM 4. Launch Edge directly into Customer Display route in full app mode
echo Opening Customer Display Screen...

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
    start "Himmel POS Customer Display" "!EDGE_EXE!" --app=http://localhost:8000/#/customer-display --start-maximized
) else (
    start http://localhost:8000/#/customer-display
)

echo.
echo ========================================================
echo   Customer Display screen active at http://localhost:8000/#/customer-display
echo ========================================================
timeout /t 3 /nobreak >nul 2>&1

