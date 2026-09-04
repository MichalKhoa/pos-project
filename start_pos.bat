@echo off
setlocal enabledelayedexpansion
title VoltFlow POS
echo ========================================================
echo   Starting VoltFlow POS...
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Ensure frontend UI is built
if not exist "%~dp0dist\index.html" (
    echo [INFO] Frontend build missing. Building UI bundle...
    where npm >nul 2>&1
    if !errorlevel! equ 0 (
        call npm run build
    ) else (
        echo [ERROR] npm is required to build the frontend.
        pause
        exit /b 1
    )
)

REM 2. Check if backend is already listening on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is active on port 8000.
    goto :BACKEND_READY
)

REM 3. Resolve launch target (Standalone binary > Virtual Environment > System Python)
set "STANDALONE_EXE=%~dp0backend\dist_standalone\pos-backend\pos-backend.exe"
set "VENV_PYTHON=%~dp0backend\venv\Scripts\python.exe"

if exist "%STANDALONE_EXE%" (
    echo [INFO] Launching standalone backend binary...
    start "VoltFlow POS Backend" /min "%STANDALONE_EXE%"
) else if exist "%VENV_PYTHON%" (
    echo [INFO] Launching backend via Python virtual environment...
    "%VENV_PYTHON%" "%~dp0backend\migrations.py" >nul 2>&1
    start "VoltFlow POS Backend" /min /D "%~dp0backend" "%VENV_PYTHON%" main.py
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Launching backend via system Python...
        python "%~dp0backend\migrations.py" >nul 2>&1
        start "VoltFlow POS Backend" /min /D "%~dp0backend" python main.py
    ) else (
        echo [ERROR] Neither standalone executable nor Python found.
        echo Please run build_standalone.bat or install Python.
        pause
        exit /b 1
    )
)

REM 4. Wait for backend server on port 8000
echo [INFO] Waiting for backend server...
set /a RETRY=0
:WAIT_BACKEND
ping -n 2 127.0.0.1 >nul 2>&1
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Backend server active on port 8000.
    goto :BACKEND_READY
)
set /a RETRY+=1
if !RETRY! lss 15 goto :WAIT_BACKEND
echo [WARNING] Backend startup took longer than 15 seconds.

:BACKEND_READY

REM 5. Display Local Network IP & Customer Display URL
set "LOCAL_IP=localhost"
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "127.0.0.1"') do (
    if "!LOCAL_IP!"=="localhost" set "LOCAL_IP=%%a"
)

echo.
echo --------------------------------------------------------
echo  Register URL:        http://localhost:8000
echo  Customer Screen:     http://!LOCAL_IP!:8000/#/customer-display
echo  API Docs:            http://localhost:8000/docs
echo --------------------------------------------------------
echo.

where qrencode >nul 2>&1
if %errorlevel% equ 0 (
    echo Scan with phone for customer screen:
    qrencode -t ANSI256 "http://!LOCAL_IP!:8000/#/customer-display"
    echo.
)

REM 6. Launch POS Register in Microsoft Edge App Mode
set "EDGE_EXE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set "EDGE_EXE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
) else (
    where msedge >nul 2>&1
    if !errorlevel! equ 0 set "EDGE_EXE=msedge"
)

if not "!EDGE_EXE!"=="" (
    start "" "!EDGE_EXE!" --app=http://localhost:8000
) else (
    start http://localhost:8000
)

echo [SUCCESS] VoltFlow POS running!
echo To stop all services: scripts\tools\Himmel_POS_Stop.bat
echo.
