@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Build Windows Release Package
echo ========================================================
echo   Building VoltFlow POS Native Windows Installer (Tauri v2)
echo ========================================================
echo.

cd /d "%~dp0..\.."

REM 0. Verify Prerequisites
echo [0/4] Checking build environment...

where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is required. Please install Node.js 18+.
    pause
    exit /b 1
)

where cargo >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Rust / Cargo is required. Please install Rust from https://rustup.rs
    pause
    exit /b 1
)

set "PYTHON_EXE=python"
if exist "%~dp0..\..\backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\..\backend\venv\Scripts\python.exe"
)
"%PYTHON_EXE%" --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python is required.
    pause
    exit /b 1
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

if not exist "node_modules\.bin\tauri.cmd" (
    echo [INFO] Installing Node.js dependencies and Tauri CLI...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js dependencies.
        pause
        exit /b !errorlevel!
    )
)

REM 1. Compile Frontend UI
echo.
echo [1/4] Compiling React frontend bundle...
call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b !errorlevel!
)

REM 2. Freeze Backend Executable
echo.
echo [2/4] Freezing standalone Python backend...
set "PYINSTALLER_ONEFILE=1"
"%PYTHON_EXE%" "%~dp0..\..\backend\build_standalone.py"
if !errorlevel! neq 0 (
    echo [ERROR] PyInstaller freeze failed!
    pause
    exit /b !errorlevel!
)

REM 3. Stage Tauri Sidecar Binary
echo.
echo [3/4] Staging sidecar binary for Tauri...
"%PYTHON_EXE%" "%~dp0..\..\scripts\prepare_sidecar.py"
if !errorlevel! neq 0 (
    echo [ERROR] Sidecar staging failed!
    pause
    exit /b !errorlevel!
)

REM 4. Build Tauri Native Release Bundle (NSIS / MSI)
echo.
echo [4/4] Building Tauri Windows desktop installer...
call npm run tauri build
if !errorlevel! neq 0 (
    echo [ERROR] Tauri build failed!
    pause
    exit /b !errorlevel!
)

echo.
echo ========================================================
echo   SUCCESS: Windows Native Installer Built Successfully!
echo ========================================================
echo.
echo   Installer packages generated in:
echo   src-tauri\target\release\bundle\nsis\
echo   src-tauri\target\release\bundle\msi\
echo.
echo ========================================================
pause
