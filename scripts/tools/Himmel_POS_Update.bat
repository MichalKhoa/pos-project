@echo off
setlocal enabledelayedexpansion
title Himmel POS - Automated App Updater
echo ========================================================
echo   Updating Himmel POS to Latest Version from GitHub
echo ========================================================
echo.

cd /d "%~dp0"

REM 0. If running on client installation without git, delegate to client NSIS updater
if not exist "%~dp0..\..\.git" (
    call "%~dp0update_client.bat" %*
    exit /b !errorlevel!
)

REM 1. Safely stop running POS backend services and browser windows
echo [1/5] Stopping active POS services and app instances...
call "%~dp0Himmel_POS_Service_Stop.bat" >nul 2>&1
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq Himmel POS App*" >nul 2>&1

REM 2. Pull latest release changes from GitHub repository
echo.
echo [2/5] Fetching latest release from GitHub (git pull origin master)...
where git >nul 2>&1
if %errorlevel% equ 0 (
    git pull origin master
    if !errorlevel! neq 0 (
        echo [WARNING] Git pull failed or offline. Proceeding with local build...
    )
) else (
    echo [WARNING] Git not found. Proceeding with local build...
)

REM 3. Update Python virtual environment and database schema
echo.
echo [3/5] Updating Python packages and auto-migrating database...
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" (
    call .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
    call .\venv\Scripts\python.exe migrations.py
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        python -m pip install -r requirements.txt --quiet
        python migrations.py
    ) else (
        echo [WARNING] Python environment not found. Skipping python update step.
    )
)

REM 4. Install npm packages and compile React frontend UI bundle
echo.
echo [4/5] Building latest React touchscreen UI bundle (npm run build)...
cd /d "%~dp0"
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm install --no-audit --no-fund
    call npm run build
) else (
    echo [WARNING] npm not found. Skipping npm build step.
)

REM 5. Restart Background Service / Register Application
echo.
echo [5/5] Restarting Himmel POS Service...
sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting Himmel POS Windows Service...
    net start HimmelPOSBackend >nul 2>&1
) else (
    schtasks /query /tn "HimmelPOSBackend" >nul 2>&1
    if !errorlevel! equ 0 (
        echo Starting Scheduled Task Service...
        schtasks /run /tn "HimmelPOSBackend" >nul 2>&1
    ) else (
        echo Launching Register Desktop App...
        start "" "%~dp0Himmel_POS.bat"
    )
)

echo.
echo ========================================================
echo   HIMMEL POS UPDATE COMPLETED SUCCESSFULLY!
echo ========================================================
timeout /t 3 /nobreak >nul 2>&1
exit

