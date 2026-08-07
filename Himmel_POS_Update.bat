@echo off
title Himmel POS — Automated App Updater
echo ========================================================
echo   Updating Himmel POS to Latest Version from GitHub
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Safely stop running POS backend services and browser windows
echo [1/5] Stopping active POS services and app instances...
call "%~dp0Himmel_POS_Service_Stop.bat" >nul 2>&1
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq Himmel POS App*" >nul 2>&1

:: 2. Pull latest release changes from GitHub repository
echo.
echo [2/5] Fetching latest release from GitHub (git pull origin master)...
git pull origin master
if %errorlevel% neq 0 (
    echo [WARNING] Git pull failed or offline. Proceeding with local build...
)

:: 3. Update Python virtual environment & database schema
echo.
echo [3/5] Updating Python packages & auto-migrating database...
cd /d "%~dp0backend"
call .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
call .\venv\Scripts\python.exe -c "from database import engine, Base; Base.metadata.create_all(bind=engine); print('Database schema OK')"

:: 4. Install npm packages & compile React frontend
echo.
echo [4/5] Building latest React touchscreen UI bundle...
cd /d "%~dp0"
call npm install --no-audit --no-fund
call npm run build

:: 5. Restart Background Service / Register Application
echo.
echo [5/5] Restarting Himmel POS...
schtasks /query /tn "HimmelPOSBackend" >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting Background Service...
    schtasks /run /tn "HimmelPOSBackend" >nul 2>&1
) else (
    echo Launching Register Desktop App...
    start "" "%~dp0Himmel_POS.bat"
)

echo.
echo ========================================================
echo   ✅ HIMMEL POS UPDATE COMPLETED SUCCESSFULLY!
echo ========================================================
timeout /t 3 /nobreak >nul
exit
