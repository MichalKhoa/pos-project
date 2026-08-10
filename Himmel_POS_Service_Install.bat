@echo off
setlocal enabledelayedexpansion

set "IS_SILENT=0"
if "%1"=="--silent" set "IS_SILENT=1"

REM Check for Admin rights (optional for ONSTART SYSTEM task, fallback to ONLOGON user task if not admin)
net session >nul 2>&1
set "IS_ADMIN=0"
if %errorlevel% equ 0 set "IS_ADMIN=1"

if %IS_ADMIN% neq 1 if %IS_SILENT% neq 1 (
    echo [INFO] Running without full Administrator privileges.
    echo Service will be installed for current logged-in user (ONLOGON).
)

title Himmel POS - Service Installer
echo ========================================================
echo   Installing Himmel POS Backend as Windows Background Service
echo ========================================================
echo.

set "REPO_DIR=%~dp0"
set "BACKEND_DIR=%~dp0backend"
set "RUN_SCRIPT=%BACKEND_DIR%\run_backend.bat"

if not exist "%RUN_SCRIPT%" (
    (
        echo @echo off
        echo cd /d "%%~dp0"
        echo set ENV=production
        echo set "PYTHON_EXE=python"
        echo if exist "%%~dp0venv\Scripts\python.exe" set "PYTHON_EXE=%%~dp0venv\Scripts\python.exe"
        echo "%%PYTHON_EXE%%" main.py
    ) > "%RUN_SCRIPT%"
)

REM 1. Create Windows Scheduled Task for Auto-Boot on Startup/Logon
echo [1/2] Creating Windows Scheduled Task 'HimmelPOSBackend'...
if %IS_ADMIN% equ 1 (
    schtasks /create /tn "HimmelPOSBackend" /tr "cmd.exe /c \"\"%RUN_SCRIPT%\"\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1
)

if %errorlevel% neq 0 (
    schtasks /create /tn "HimmelPOSBackend" /tr "cmd.exe /c \"\"%RUN_SCRIPT%\"\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
)

REM 2. Boot the background service immediately
echo [2/2] Booting Himmel POS Backend Service...
schtasks /run /tn "HimmelPOSBackend" >nul 2>&1

REM Ensure backend is active on port 8000; if task didn't spin up immediately, launch fallback
timeout /t 2 /nobreak >nul 2>&1
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    start "Himmel POS Backend" /min cmd /c "%RUN_SCRIPT%"
)

echo.
echo ========================================================
echo   SUCCESS! Himmel POS Backend registered as Windows Service.
echo   - Runs silently in background on Windows boot.
echo   - To stop service: Run Himmel_POS_Service_Stop.bat
echo ========================================================
echo.

if %IS_SILENT% neq 1 (
    pause
)
