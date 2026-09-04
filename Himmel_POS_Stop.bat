@echo off
setlocal enabledelayedexpansion
title Himmel POS - Stop Services
echo ========================================================
echo   Stopping Himmel POS Services...
echo ========================================================
echo.

REM Stop standalone backend executable
taskkill /F /IM pos-backend.exe >nul 2>&1
taskkill /F /IM pos-backend-standalone.exe >nul 2>&1
taskkill /F /IM litestream.exe >nul 2>&1

REM Free port 8000 if occupied
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":8000 " ^| findstr /i "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Free port 5173 (Vite dev server) if occupied
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":5173 " ^| findstr /i "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [OK] Himmel POS services stopped.
timeout /t 2 >nul
