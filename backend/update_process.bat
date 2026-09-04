@echo off
title Himmel POS — Remote UI Updater
echo ========================================================
echo   Applying System Update from Cashier Interface...
echo ========================================================

:: 1. Pause 2s to allow caller HTTP API response to finish
timeout /t 2 /nobreak >nul

:: 2. Stop running services
cd /d "%~dp0.."
if exist "%~dp0..\scripts\tools\Himmel_POS_Stop.bat" (
    call "%~dp0..\scripts\tools\Himmel_POS_Stop.bat" >nul 2>&1
)

:: 3. Pull latest code from git master
echo Fetching and pulling latest release...
git pull origin master

:: 4. Update dependencies and database schema
echo Updating dependencies & database schema...
cd /d "%~dp0"
call .\venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
call .\venv\Scripts\python.exe -c "from database import engine, Base; Base.metadata.create_all(bind=engine); print('Database schema OK')"

:: 5. Rebuild React production bundle
echo Rebuilding React UI bundle...
cd /d "%~dp0.."
call npm install --no-audit --no-fund
call npm run build

:: 6. Restart backend service / app
echo Restarting Himmel POS Backend...
schtasks /query /tn "HimmelPOSBackend" >nul 2>&1
if %errorlevel% equ 0 (
    schtasks /run /tn "HimmelPOSBackend" >nul 2>&1
) else (
    start "" "%~dp0..\start.bat"
)

echo Update Complete!
exit
