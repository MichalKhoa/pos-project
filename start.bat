@echo off
setlocal enabledelayedexpansion
title VoltFlow POS
echo ========================================================
echo   Starting VoltFlow POS...
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Build frontend UI if missing or explicitly requested (--rebuild)
set "NEED_BUILD=0"
if "%~1"=="--build" set "NEED_BUILD=1"
if "%~1"=="--rebuild" set "NEED_BUILD=1"
if not exist "%~dp0dist\index.html" set "NEED_BUILD=1"

if "!NEED_BUILD!"=="1" (
    where npm >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Building latest frontend UI bundle...
        call npm run build
        if !errorlevel! neq 0 (
            echo [ERROR] Frontend build failed!
            pause
            exit /b 1
        )
    ) else (
        echo [ERROR] npm is required to build the frontend.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Production frontend bundle found: dist\index.html. Skipping rebuild.
)

REM Sync built assets to standalone distribution if present
if exist "%~dp0backend\dist_standalone\pos-backend\_internal\dist" (
    xcopy /E /I /Y /Q "%~dp0dist" "%~dp0backend\dist_standalone\pos-backend\_internal\dist" >nul 2>&1
)
if exist "%~dp0backend\dist_standalone\pos-backend\dist" (
    xcopy /E /I /Y /Q "%~dp0dist" "%~dp0backend\dist_standalone\pos-backend\dist" >nul 2>&1
)

REM 2. Check if backend is already listening on port 8000
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] Backend is already active on port 8000.
    goto :BACKEND_READY
)

REM 3. Resolve launch target (Virtual Environment > System Python > Standalone binary)
set "STANDALONE_EXE=%~dp0backend\dist_standalone\pos-backend\pos-backend.exe"
set "VENV_PYTHON=%~dp0backend\venv\Scripts\python.exe"

if exist "%VENV_PYTHON%" (
    echo [INFO] Checking Python backend dependencies...
    "%VENV_PYTHON%" -c "import lxml, xmlsec, fastapi, uvicorn" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [WARNING] Missing backend packages detected. Installing requirements...
        "%VENV_PYTHON%" -m pip install -r "%~dp0backend\requirements.txt"
    )
    echo [INFO] Applying database migrations...
    "%VENV_PYTHON%" "%~dp0backend\migrations.py"
    if !errorlevel! neq 0 (
        echo [ERROR] Database migration failed.
        pause
        exit /b 1
    )
    echo [INFO] Launching backend via Python virtual environment...
    cd /d "%~dp0backend"
    set "ENV=production"
    start "VoltFlow POS Backend" /min cmd /c "run_backend.bat"
    cd /d "%~dp0"
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Applying database migrations...
        python "%~dp0backend\migrations.py"
        if !errorlevel! neq 0 (
            echo [ERROR] Database migration failed.
            pause
            exit /b 1
        )
        echo [INFO] Launching backend via system Python...
        cd /d "%~dp0backend"
        set "ENV=production"
        start "VoltFlow POS Backend" /min cmd /c "run_backend.bat"
        cd /d "%~dp0"
    ) else if exist "%STANDALONE_EXE%" (
        echo [INFO] Launching standalone backend binary...
        cd /d "%~dp0backend"
        start "VoltFlow POS Backend" /min "%STANDALONE_EXE%"
        cd /d "%~dp0"
    ) else (
        echo [ERROR] Neither Python nor standalone executable found.
        echo Please run install.bat or install Python.
        pause
        exit /b 1
    )
)

REM 4. Wait for backend server on port 8000
echo [INFO] Waiting for backend server on port 8000...
set /a RETRY=0
set "BACKEND_READY=0"

:WAIT_BACKEND
ping -n 2 127.0.0.1 >nul 2>&1
netstat -ano | findstr /C:":8000 " | findstr /i "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Backend server active on port 8000.
    set "BACKEND_READY=1"
    goto :BACKEND_READY
)
set /a RETRY+=1
if !RETRY! lss 15 goto :WAIT_BACKEND

echo.
echo [ERROR] Backend server failed to respond on port 8000 within 15 seconds.
echo Please check backend\logs\pos_backend.log or test directly with backend\run_backend.bat.
pause
exit /b 1

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
if !errorlevel! equ 0 (
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
echo To stop all services: run stop.bat
echo.
ping -n 4 127.0.0.1 >nul 2>&1

