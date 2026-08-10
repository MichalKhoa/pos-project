@echo off
setlocal enabledelayedexpansion
:: Ensure admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================================
    echo   [ERROR] Administrator privileges required!
    echo   Please right-click this file and select "Run as administrator".
    echo ========================================================
    pause
    exit /b 1
)

title Himmel POS — Service Installer
echo ========================================================
echo   Installing Himmel POS Backend as Windows Background Service
echo ========================================================
echo.

set REPO_DIR=%~dp0
set BACKEND_DIR=%~dp0backend
set PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe

if not exist "%PYTHON_EXE%" (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%p in ('where python') do set "PYTHON_EXE=%%p"
    ) else (
        echo [ERROR] Python environment not found at %PYTHON_EXE% or system PATH.
        echo Please run Himmel_POS_Install.bat first!
        pause
        exit /b 1
    )
)

:: 1. Create Windows Scheduled Task for Silent Startup
echo [1/2] Creating Windows Scheduled Task 'HimmelPOSBackend'...
schtasks /create /tn "HimmelPOSBackend" /tr "\"%PYTHON_EXE%\" \"%BACKEND_DIR%\main.py\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1

if %errorlevel% neq 0 (
    echo Fallback: Creating Task for current logged in user...
    schtasks /create /tn "HimmelPOSBackend" /tr "\"%PYTHON_EXE%\" \"%BACKEND_DIR%\main.py\"" /sc ONLOGON /rl HIGHEST /f
)

:: 2. Start the service/task immediately
echo [2/2] Starting Himmel POS Backend Service...
schtasks /run /tn "HimmelPOSBackend" >nul 2>&1

echo.
echo ========================================================
echo   ✅ SUCCESS! Himmel POS Backend registered as Windows Service.
echo   - Runs silently in background on Windows boot.
echo   - To stop service: Run Himmel_POS_Service_Stop.bat
echo ========================================================
echo.
pause
