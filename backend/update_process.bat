@echo off
title Himmel POS Automated System Updater
echo ========================================================
echo   Updating Himmel POS to Latest Release from GitHub...
echo ========================================================

:: 1. Pause 2 seconds to allow caller HTTP response to complete cleanly
timeout /t 2 /nobreak >nul

:: 2. Pull latest code changes from origin/master
echo Fetching and pulling latest changes...
cd /d %~dp0..
git pull origin master

:: 3. Run database schema auto-migration & update python packages
echo Verifying dependencies and updating database schema...
cd /d %~dp0
call .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
call .\venv\Scripts\python.exe -c "from database import engine, Base; Base.metadata.create_all(bind=engine); print('Database schema OK')"

:: 4. Build Vite web bundle if node_modules present
echo Building latest frontend bundle...
cd /d %~dp0..
call npm install --no-audit --no-fund
call npm run build

:: 5. Restart Himmel POS Register Launcher
echo Restarting Himmel POS Register Application...
timeout /t 2 /nobreak >nul
start "" "%~dp0..\Himmel_POS.bat"

echo System Update Complete!
exit
