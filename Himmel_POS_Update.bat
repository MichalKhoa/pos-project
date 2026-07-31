@echo off
title Himmel POS Manual Updater
echo ========================================================
echo   Manual Update Launcher - Himmel POS
echo ========================================================

echo 1. Pulling latest release from GitHub...
cd /d %~dp0
git pull origin master

echo 2. Updating Database Schema & Dependencies...
cd /d %~dp0backend
call .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
call .\venv\Scripts\python.exe -c "from database import engine, Base; Base.metadata.create_all(bind=engine)"

echo 3. Rebuilding Frontend Application...
cd /d %~dp0
call npm install --no-audit --no-fund
call npm run build

echo ========================================================
echo   Update completed successfully! 
echo   Starting Himmel POS...
echo ========================================================
timeout /t 3 /nobreak >nul
start "" "%~dp0Himmel_POS.bat"
exit
