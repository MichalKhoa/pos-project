@echo off
setlocal enabledelayedexpansion
title Himmel POS - Customer Display Launcher
echo ========================================================
echo   Starting Himmel POS - Dedicated Customer Display Screen
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Resolve Python Executable
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Ensure backend is running
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Python Backend Service...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"
    timeout /t 2 /nobreak >nul 2>&1
)

REM 3. Launch Edge directly into Customer Display route in full app mode
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
    start "" "!EDGE_EXE!" --app=http://localhost:8000/#/customer-display --start-maximized
) else (
    start http://localhost:8000/#/customer-display
)

echo.
echo ========================================================
echo   Customer Display screen active at http://localhost:8000/#/customer-display
echo ========================================================
timeout /t 2 /nobreak >nul 2>&1
