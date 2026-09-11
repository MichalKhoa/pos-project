@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Debug Mode
echo ========================================================
echo   Starting VoltFlow POS (Debug Mode)
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Check for conflicting processes on port 8000 or 5173
set "CONFLICT=0"
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set "CONFLICT=1"
netstat -ano | findstr /C:":5173 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set "CONFLICT=1"

if "!CONFLICT!"=="1" (
    echo [WARNING] Port 8000 or 5173 is already in use.
    echo Stopping conflicting POS background processes...
    call "%~dp0scripts\tools\Himmel_POS_Stop.bat" >nul 2>&1
    ping -n 2 127.0.0.1 >nul 2>&1
)

REM 2. Locate Python executable & verify packages
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" -c "import lxml, xmlsec, fastapi, uvicorn" >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Missing backend packages detected. Installing requirements...
    "%PYTHON_EXE%" -m pip install -r "%~dp0backend\requirements.txt"
)

REM 3. Run database migrations
echo [INFO] Applying database migrations...
"%PYTHON_EXE%" "%~dp0backend\migrations.py"
if !errorlevel! neq 0 (
    echo [ERROR] Database migration failed!
    pause
    exit /b 1
)

REM 4. Ensure frontend dependencies exist
if not exist "%~dp0node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install
)

REM 5. Launch Backend in development mode
echo [1/2] Launching Backend Server on http://localhost:8000...
cd /d "%~dp0backend"
set "ENV=development"
start "VoltFlow POS Backend (Debug)" cmd /k "run_backend.bat"
cd /d "%~dp0"

REM 6. Launch Frontend (Vite dev server or Tauri dev)
if /i "%~1"=="--tauri" goto :LAUNCH_TAURI

echo [2/2] Launching Vite Frontend on http://localhost:5173...
start "VoltFlow POS Frontend (Debug)" cmd /k "npm run dev"
goto :WAIT_FRONTEND

:LAUNCH_TAURI
echo [2/2] Launching Native Tauri Desktop Shell: tauri dev
start "VoltFlow POS Desktop (Debug)" cmd /k "npm run tauri:dev"
goto :DEBUG_READY

:WAIT_FRONTEND
echo [INFO] Waiting for frontend dev server on port 5173...
set /a RETRY=0

:WAIT_VITE
ping -n 2 127.0.0.1 >nul 2>&1
netstat -ano | findstr /C:":5173 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! neq 0 (
    set /a RETRY+=1
    if !RETRY! lss 10 goto :WAIT_VITE
)

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
    start "" "!EDGE_EXE!" http://localhost:5173
) else (
    start http://localhost:5173
)

:DEBUG_READY

echo.
echo ========================================================
echo   VoltFlow POS Debug Environment Active
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://127.0.0.1:8000
echo   - API Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
echo   Controls:
echo     [S] Stop all debug servers and exit
echo     [Q] Keep servers running and close this window
echo.
set "ACT="
set /p "ACT=Select action [S/Q] (default Q): "
if /i "!ACT!"=="S" (
    echo Stopping debug servers...
    call "%~dp0stop.bat"
    exit /b 0
)
exit /b 0
