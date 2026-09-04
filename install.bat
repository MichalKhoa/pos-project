@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Installation
echo ========================================================
echo   VoltFlow POS — Project Installation (Windows)
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Check prerequisites
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js/npm not found. Please install Node.js LTS.
    pause
    exit /b 1
)

REM 2. Create Python virtual environment
echo [1/4] Setting up Python virtual environment...
if not exist "%~dp0backend\venv\Scripts\python.exe" (
    python -m venv "%~dp0backend\venv"
)
set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
"%PYTHON_EXE%" -m pip install --upgrade pip >nul 2>&1
"%PYTHON_EXE%" -m pip install -r "%~dp0backend\requirements.txt"

REM 3. Database migrations
echo [2/4] Applying database schema migrations...
"%PYTHON_EXE%" "%~dp0backend\migrations.py"

REM 4. Setup .env
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
    echo [INFO] Created backend\.env configuration.
)

REM 5. Install frontend dependencies and build bundle
echo [3/4] Installing Node.js frontend dependencies...
call npm install

echo [4/4] Building production UI bundle...
call npm run build

echo.
echo ========================================================
echo   Installation Complete!
echo.
echo   Commands:
echo     debug.bat   -> Start in debug mode (Vite :5173 + FastAPI :8000)
echo     start.bat   -> Start in production mode (:8000)
echo ========================================================
echo.
pause
