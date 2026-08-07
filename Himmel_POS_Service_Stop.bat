@echo off
title Himmel POS — Stop Background Service
echo ========================================================
echo   Stopping Himmel POS Background Service & Processes
echo ========================================================
echo.

:: 1. Stop Task Scheduler Service Task if running
echo [1/3] Terminating scheduled task 'HimmelPOSBackend'...
schtasks /end /tn "HimmelPOSBackend" >nul 2>&1

:: 2. Stop NSSM/Windows Service if installed
sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    echo [2/3] Stopping Windows Service 'HimmelPOSBackend'...
    net stop HimmelPOSBackend >nul 2>&1
)

:: 3. Terminate active backend python.exe instances
echo [3/3] Terminating active Python POS backend processes...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1

for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo table /nh 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================================
echo   ✅ Himmel POS Backend Service stopped cleanly!
echo ========================================================
timeout /t 2 >nul
