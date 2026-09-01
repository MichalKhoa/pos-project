@echo off
title Himmel POS - Stop All Services
echo ========================================================
echo   Stopping all Himmel POS Services and Processes...
echo ========================================================
echo.

REM 1. Stop background NSSM service or scheduled task if active
sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    net stop HimmelPOSBackend >nul 2>&1
)
schtasks /end /tn "HimmelPOSBackend" >nul 2>&1

REM 2. Close command prompt terminals by window title
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web Dev*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Litestream*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS App*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Launcher*" >nul 2>&1

REM 3. Terminate Litestream
taskkill /F /IM litestream.exe >nul 2>&1

REM 4. Free ports 8000 and 5173
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo.
echo ========================================================
echo   All Himmel POS services and processes stopped.
echo ========================================================
timeout /t 2 /nobreak >nul 2>&1
