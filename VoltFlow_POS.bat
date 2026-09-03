@echo off
setlocal enabledelayedexpansion
title VoltFlow POS
echo ========================================================
echo   Starting VoltFlow POS
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Resolve Python Executable
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 2. Ensure frontend UI is built; only compile if dist/ is missing
if not exist "%~dp0dist\index.html" (
    echo [NPM] Compiling frontend UI bundle [first run]...
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        call npm run build
    )
)

REM 3. Ensure backend is running on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is active on port 8000.
    goto :BACKEND_READY
)

echo [INFO] Checking database migrations and schema changes...
"%PYTHON_EXE%" "%~dp0backend\migrations.py"
echo [INFO] Starting Backend Server...
start "VoltFlow POS Backend" /min /D "%~dp0backend" cmd /c "%~dp0backend\run_backend.bat"

echo [INFO] Waiting for backend server on port 8000...
set /a RETRY_COUNT=0
:WAIT_BACKEND
ping -n 2 127.0.0.1 >nul 2>&1
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Backend server active on port 8000.
    goto :BACKEND_READY
)
set /a RETRY_COUNT+=1
if !RETRY_COUNT! lss 10 goto :WAIT_BACKEND
echo [WARNING] Backend server startup took longer than 10 seconds.

:BACKEND_READY

REM 4. Start Litestream Database Backup if present and not running
if exist "%~dp0backend\litestream.exe" (
    tasklist /FI "IMAGENAME eq litestream.exe" 2>nul | findstr /i "litestream.exe" >nul 2>&1
    if %errorlevel% neq 0 (
        start "VoltFlow POS Litestream" /min cmd /c "cd /d "%~dp0backend" && litestream.exe replicate -config litestream.yml"
    )
)

REM 5. Display Local Network IP and Phone Customer Display Screen URL
echo.
set "LOCAL_IP=localhost"
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "127.0.0.1"') do (
    if "!LOCAL_IP!"=="localhost" set "LOCAL_IP=%%a"
)

echo [NETWORK] Local POS IP: !LOCAL_IP!
echo [CUSTOMER DISPLAY] http://!LOCAL_IP!:8000/#/customer-display
echo [QR CODE] Scan with smartphone to use as live customer screen:
echo.

REM 6. Render ASCII QR Code on terminal if available
where qrencode >nul 2>&1
if %errorlevel% equ 0 (
    qrencode -t ANSI256 "http://!LOCAL_IP!:8000/#/customer-display"
)

REM 7. Launch Full POS App via Microsoft Edge App Mode (or default browser fallback)
echo.
echo [LAUNCH] Opening VoltFlow POS Register...
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

echo.
echo ========================================================
echo   VoltFlow POS is running!
echo   To stop all services, run: VoltFlow_POS_Stop.bat
echo ========================================================
echo.
