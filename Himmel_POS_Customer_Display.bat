@echo off
setlocal enabledelayedexpansion
title Himmel POS — Customer Display Launcher
echo ========================================================
echo   Starting Himmel POS (Dedicated Customer Display Screen)
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

:: 2. Build production UI bundle before startup
echo [NPM] Ensuring frontend UI bundle is up to date (npm run build)...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm run build
)

:: 3. Check if backend is already running; if not, launch it
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Python Backend Service...
    start "Himmel POS Backend" /min cmd /c "cd /d "%~dp0backend" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && set ENV=production && python main.py"
    timeout /t 3 /nobreak >nul
)

:: 4. Launch Edge directly into Customer Display route in full app mode
echo Opening Customer Display Screen...
start "Himmel POS Customer Display" msedge --app=http://localhost:8000/#/customer-display --start-maximized

echo.
echo ========================================================
echo   Customer Display screen active at http://localhost:8000/#/customer-display
echo ========================================================
timeout /t 3 >nul
