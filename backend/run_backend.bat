@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
if "%ENV%"=="" set ENV=production
set "PYTHON_EXE=python"
if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
)

echo [INFO] Running database migrations...
"%PYTHON_EXE%" migrations.py
if !errorlevel! neq 0 (
    echo [ERROR] Database migrations failed!
    pause
    exit /b !errorlevel!
)

echo [INFO] Starting backend server: %ENV%...
"%PYTHON_EXE%" main.py
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Backend exited with error code !errorlevel!.
    pause
    exit /b !errorlevel!
)

