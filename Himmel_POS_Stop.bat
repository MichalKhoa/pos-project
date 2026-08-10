@echo off
title Himmel POS Shutdown
echo ========================================================
echo   Stopping all Himmel POS Services and Terminals...
echo ========================================================
echo.

REM 1. Close command prompt windows by window title
echo Closing Backend Terminals...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1

echo Closing Web Dev Terminals...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web Dev*" >nul 2>&1

echo Closing Litestream Terminals...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Litestream*" >nul 2>&1

echo Closing App Windows...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS App*" >nul 2>&1
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Launcher*" >nul 2>&1

REM 2. Terminate python.exe running main.py and node.exe running vite
echo Terminating Python backend processes...
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo table /nh 2^>nul ^| findstr /i "python.exe"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Terminating Node.js frontend processes...
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo table /nh 2^>nul ^| findstr /i "node.exe"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 3. Terminate Litestream if running
taskkill /F /IM litestream.exe >nul 2>&1

echo.
echo ========================================================
echo   All Himmel POS services and terminals have stopped.
echo ========================================================
timeout /t 2 /nobreak >nul 2>&1

