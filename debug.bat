@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Debug Mode
echo ========================================================
echo   Starting VoltFlow POS (Debug Mode: Vite + FastAPI)
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Locate Python
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Run migrations
echo [INFO] Running database migrations...
"%PYTHON_EXE%" "%~dp0backend\migrations.py" >nul 2>&1

REM 3. Launch Backend
echo [1/2] Launching Backend Server on http://localhost:8000...
start "VoltFlow POS Backend (Debug)" /D "%~dp0backend" cmd /k "set ENV=development&& %PYTHON_EXE% main.py"

REM 4. Launch Vite Dev Server
echo [2/2] Launching Vite Frontend on http://localhost:5173...
start "VoltFlow POS Frontend (Debug)" cmd /k "npm run dev"

echo.
echo ========================================================
echo   Debug Servers Running:
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://127.0.0.1:8000
echo   - API Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
