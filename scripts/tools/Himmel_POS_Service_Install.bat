@echo off
setlocal enabledelayedexpansion
title Himmel POS - Windows Background Service Manager
echo ========================================================
echo   Himmel POS - Windows Background Service Manager
echo ========================================================
echo.

cd /d "%~dp0"

set "BACKEND_DIR=%~dp0backend"
set "LOGS_DIR=%BACKEND_DIR%\logs"
set "NSSM_EXE=%~dp0nssm.exe"

REM Create logs directory if missing
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM Resolve Python executable
set "PYTHON_EXE=python"
if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
)

echo Choose service setup mode:
echo   [1] Install as NSSM Windows Service (Recommended - Auto-restart on crash)
echo   [2] Install as Native Windows Scheduled Task (No Admin required)
echo   [3] Remove / Uninstall Service
echo.
set "CHOICE="
set /p "CHOICE=Select an option [1, 2 or 3] (default 1): "

if "%CHOICE%"=="3" (
    echo.
    echo [1/2] Removing NSSM Windows Service...
    sc query HimmelPOSBackend >nul 2>&1
    if !errorlevel! equ 0 (
        if exist "%NSSM_EXE%" (
            "%NSSM_EXE%" stop HimmelPOSBackend >nul 2>&1
            "%NSSM_EXE%" remove HimmelPOSBackend confirm >nul 2>&1
        ) else (
            net stop HimmelPOSBackend >nul 2>&1
            sc delete HimmelPOSBackend >nul 2>&1
        )
    )
    echo [2/2] Removing Windows Scheduled Task...
    schtasks /delete /tn "HimmelPOSBackend" /f >nul 2>&1
    echo.
    echo [SUCCESS] All Himmel POS background services uninstalled.
    echo.
    pause
    exit /b 0
)

if "%CHOICE%"=="2" (
    REM ==========================================
    REM OPTION 2: Windows Scheduled Task
    REM ==========================================
    echo.
    echo Installing as Windows Scheduled Task...
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

    net session >nul 2>&1
    if !errorlevel! equ 0 (
        schtasks /create /tn "HimmelPOSBackend" /tr "cmd.exe /c \"\"%RUN_SCRIPT%\"\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1
    ) else (
        schtasks /create /tn "HimmelPOSBackend" /tr "cmd.exe /c \"\"%RUN_SCRIPT%\"\"" /sc ONLOGON /rl HIGHEST /f >nul 2>&1
    )
    schtasks /run /tn "HimmelPOSBackend" >nul 2>&1

    echo.
    echo ========================================================
    echo   SUCCESS! Registered as Windows Scheduled Task.
    echo   - Auto-starts on boot/logon.
    echo   - Silent execution on port 8000.
    echo ========================================================
    echo.
    pause
    exit /b 0
)

REM ==========================================
REM OPTION 1: NSSM Windows Service (Default)
REM ==========================================
echo.
echo Installing as true NSSM Windows Service...

REM Check Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NSSM Windows Service requires Administrator privileges.
    echo Please right-click 'Himmel_POS_Service_Install.bat' and select 'Run as administrator'.
    echo.
    echo (Or choose Option 2 for Scheduled Task which requires no admin).
    echo.
    pause
    exit /b 1
)

if not exist "%NSSM_EXE%" (
    echo [ERROR] nssm.exe was not found in %~dp0.
    echo Falling back to Windows Scheduled Task...
    goto :FALLBACK_TASK
)

REM Stop and remove existing service if present
sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    echo [1/3] Removing existing service instance...
    "%NSSM_EXE%" stop HimmelPOSBackend >nul 2>&1
    "%NSSM_EXE%" remove HimmelPOSBackend confirm >nul 2>&1
)

echo [2/3] Registering and configuring NSSM service...
"%NSSM_EXE%" install HimmelPOSBackend "%PYTHON_EXE%" "-m uvicorn main:app --host 0.0.0.0 --port 8000" >nul
if %errorlevel% neq 0 (
    echo [ERROR] NSSM install command failed.
    pause
    exit /b 1
)

"%NSSM_EXE%" set HimmelPOSBackend AppDirectory "%BACKEND_DIR%" >nul
"%NSSM_EXE%" set HimmelPOSBackend Start SERVICE_AUTO_START >nul
"%NSSM_EXE%" set HimmelPOSBackend AppStdout "%LOGS_DIR%\nssm_out.log" >nul
"%NSSM_EXE%" set HimmelPOSBackend AppStderr "%LOGS_DIR%\nssm_err.log" >nul
"%NSSM_EXE%" set HimmelPOSBackend AppRotateFiles 1 >nul
"%NSSM_EXE%" set HimmelPOSBackend AppRotateOnline 1 >nul
"%NSSM_EXE%" set HimmelPOSBackend AppRotateBytes 1048576 >nul
"%NSSM_EXE%" set HimmelPOSBackend AppThrottle 1500 >nul

echo [3/3] Starting HimmelPOSBackend Service...
"%NSSM_EXE%" start HimmelPOSBackend >nul 2>&1

echo.
echo ========================================================
echo   SUCCESS! NSSM Windows Service installed & running!
echo   - Status: Active in services.msc as 'HimmelPOSBackend'
echo   - Auto-starts on Windows boot
echo   - Automatic immediate restart if Python crashes
echo   - Logs saved to: backend\logs\nssm_err.log
echo   - To stop anytime: Run Himmel_POS_Stop.bat
echo ========================================================
echo.
pause
exit /b 0

:FALLBACK_TASK
set "RUN_SCRIPT=%BACKEND_DIR%\run_backend.bat"
schtasks /create /tn "HimmelPOSBackend" /tr "cmd.exe /c \"\"%RUN_SCRIPT%\"\"" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f >nul 2>&1
schtasks /run /tn "HimmelPOSBackend" >nul 2>&1
echo [OK] Registered as Windows Scheduled Task.
pause
