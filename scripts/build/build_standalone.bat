@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Build Standalone Bundle
echo ========================================================
echo   Building VoltFlow POS Standalone Bundle (Windows)...
echo ========================================================
echo.

cd /d "%~dp0..\.."

REM 1. Compile frontend
echo [1/3] Building frontend UI bundle...
where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] npm is required to build the frontend. Please install Node.js.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Installing Node.js dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js dependencies.
        pause
        exit /b !errorlevel!
    )
)

call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b !errorlevel!
)

REM 2. Run PyInstaller via Python
echo.
echo [2/3] Freezing Python backend...
set "PYTHON_EXE=python"
if exist "%~dp0..\..\backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\..\backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" -c "import PyInstaller" >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] PyInstaller not detected. Installing PyInstaller...
    "%PYTHON_EXE%" -m pip install pyinstaller
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install PyInstaller.
        pause
        exit /b !errorlevel!
    )
)

"%PYTHON_EXE%" "%~dp0..\..\backend\build_standalone.py"
if !errorlevel! neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b !errorlevel!
)

REM 3. Stage Tauri Sidecar
echo.
echo [3/3] Staging Tauri sidecar...
"%PYTHON_EXE%" "%~dp0..\..\scripts\prepare_sidecar.py"
if !errorlevel! neq 0 (
    echo [ERROR] Sidecar preparation failed!
    pause
    exit /b !errorlevel!
)

echo.
echo ========================================================
echo   SUCCESS: Standalone executable and Tauri sidecar created!
echo   Location: backend\dist_standalone\pos-backend\pos-backend.exe
echo   Sidecar:  src-tauri\binaries\
echo   To launch web:   start_pos.bat
echo   To launch Tauri: npm run tauri dev
echo ========================================================
echo.
pause
