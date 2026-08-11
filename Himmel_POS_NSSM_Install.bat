@echo off
setlocal enabledelayedexpansion
title Himmel POS - NSSM Service Installer
echo ========================================================
echo   Installing Himmel POS Backend as NSSM Windows Service
echo ========================================================
echo.

REM 1. Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges to register a Windows Service.
    echo Please right-click 'Himmel_POS_NSSM_Install.bat' and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

set "REPO_DIR=%~dp0"
set "BACKEND_DIR=%~dp0backend"
set "LOGS_DIR=%BACKEND_DIR%\logs"
set "NSSM_EXE=%~dp0nssm.exe"

REM Create logs directory if missing
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM 2. Check for nssm.exe or attempt download if missing
if not exist "%NSSM_EXE%" (
    where nssm >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%i in ('where nssm') do set "NSSM_EXE=%%i"
    ) else (
        echo [INFO] nssm.exe not found locally. Downloading NSSM...
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%~dp0nssm.zip'" >nul 2>&1
        if exist "%~dp0nssm.zip" (
            powershell -Command "Expand-Archive -Path '%~dp0nssm.zip' -DestinationPath '%~dp0nssm_temp' -Force" >nul 2>&1
            if exist "%~dp0nssm_temp\nssm-2.24\win64\nssm.exe" (
                copy "%~dp0nssm_temp\nssm-2.24\win64\nssm.exe" "%NSSM_EXE%" >nul 2>&1
            )
            rmdir /s /q "%~dp0nssm_temp" >nul 2>&1
            del "%~dp0nssm.zip" >nul 2>&1
        )
    )
)

if not exist "%NSSM_EXE%" (
    echo [ERROR] Failed to locate or download nssm.exe.
    echo Please download NSSM manually from https://nssm.cc/download and place nssm.exe in this folder.
    echo.
    pause
    exit /b 1
)

REM 3. Determine Python Executable Path
set "PYTHON_EXE=python"
if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
)

echo Target Python Executable: %PYTHON_EXE%
echo Target Backend Directory:  %BACKEND_DIR%
echo.

REM 4. Remove existing HimmelPOSBackend service if present
sc query HimmelPOSBackend >nul 2>&1
if %errorlevel% equ 0 (
    echo [1/3] Removing existing HimmelPOSBackend service...
    "%NSSM_EXE%" stop HimmelPOSBackend >nul 2>&1
    "%NSSM_EXE%" remove HimmelPOSBackend confirm >nul 2>&1
)

REM 5. Install and Configure NSSM Service
echo [2/3] Installing HimmelPOSBackend service via NSSM...
"%NSSM_EXE%" install HimmelPOSBackend "%PYTHON_EXE%" "-m uvicorn main:app --host 0.0.0.0 --port 8000" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install service with NSSM.
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

REM 6. Start the Service and verify startup
echo [3/3] Starting HimmelPOSBackend Windows Service...
"%NSSM_EXE%" start HimmelPOSBackend >nul 2>&1

echo Waiting for backend initialization...
set "IS_ONLINE=0"
for /L %%i in (1,1,6) do (
    timeout /t 1 /nobreak >nul 2>&1
    netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        set "IS_ONLINE=1"
        goto :SERVICE_CHECK_DONE
    )
)
:SERVICE_CHECK_DONE

if !IS_ONLINE! equ 1 (
    echo.
    echo ========================================================
    echo   SUCCESS! Himmel POS Backend is running as NSSM Service.
    echo   - Auto-starts on Windows boot
    echo   - Silent execution (No terminal window)
    echo   - Auto-restarts on crash
    echo   - Logs saved to: backend\logs\nssm_err.log
    echo ========================================================
) else (
    echo [WARNING] Service installed, but backend is taking longer than usual to start.
    echo Check logs at: backend\logs\nssm_err.log
)

echo.
pause
