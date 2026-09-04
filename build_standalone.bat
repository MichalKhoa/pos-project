@echo off
setlocal enabledelayedexpansion
title Himmel POS - Build Standalone Bundle
echo ========================================================
echo   Building Himmel POS Standalone Bundle (Windows)...
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Compile frontend
echo [1/2] Building frontend UI bundle...
where npm >nul 2>&1
if !errorlevel! equ 0 (
    call npm run build
) else (
    echo [ERROR] npm is required to build the frontend.
    pause
    exit /b 1
)

REM 2. Run PyInstaller via Python
echo.
echo [2/2] Freezing Python backend...
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" "%~dp0backend\build_standalone.py"
if !errorlevel! neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b !errorlevel!
)

echo.
echo ========================================================
echo   SUCCESS: Standalone executable created!
echo   Location: backend\dist_standalone\pos-backend\pos-backend.exe
echo   To launch: start_pos.bat
echo ========================================================
echo.
pause
