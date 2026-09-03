@echo off
title VoltFlow POS - Stop All Services
echo ========================================================
echo   Stopping all VoltFlow POS Services and Processes...
echo ========================================================
echo.

REM 1. Stop background service or scheduled task if active
sc query VoltFlowPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    net stop VoltFlowPOSBackend >nul 2>&1
)
schtasks /end /tn "VoltFlowPOSBackend" >nul 2>&1

sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    net stop HimmelPOSBackend >nul 2>&1
)
schtasks /end /tn "HimmelPOSBackend" >nul 2>&1

REM 2. Close command prompt terminals by window title
taskkill /T /F /FI "WINDOWTITLE eq VoltFlow POS*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS*" >nul 2>&1

REM 3. Terminate Litestream & POS browser app windows
taskkill /F /IM litestream.exe >nul 2>&1
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq *VoltFlow*" >nul 2>&1
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq *Himmel*" >nul 2>&1

REM 4. Free ports 8000 and 5173
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173,8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo.
echo ========================================================
echo   All VoltFlow POS services and processes stopped.
echo ========================================================
timeout /t 2 /nobreak >nul 2>&1
