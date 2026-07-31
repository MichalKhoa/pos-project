@echo off
title Himmel POS — Silent Kiosk Launcher
echo ========================================================
echo   Starting Himmel POS (Production Silent Mode)...
echo ========================================================

:: 0. Load environment variables from .env if present
if exist "%~dp0backend\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0backend\.env") do set "%%a=%%b"
) else if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0.env") do set "%%a=%%b"
)

:: 1. Launch Python FastAPI Backend completely hidden (VB script runner)
echo Starting Python Backend Service (Silent)...
start /B venv\bin\python backend\main.py >nul 2>&1 || start /B python backend\main.py >nul 2>&1

:: 2. Launch Litestream Replication silently if present
if exist "%~dp0backend\litestream.exe" (
    echo Starting Database Replication (Silent)...
    start /B backend\litestream.exe replicate -config backend\litestream.yml >nul 2>&1
)

:: 3. Launch Vite Web App Server silently
echo Starting Cashier Interface (Silent)...
start /B npm run dev >nul 2>&1

:: 4. Wait for initialization
timeout /t 3 /nobreak >nul

:: 5. Open Edge in Kiosk Window Mode
echo Opening Cashier Display...
start "Himmel POS App" msedge --app=http://localhost:5173 --start-maximized

echo Himmel POS is running in silent mode.
