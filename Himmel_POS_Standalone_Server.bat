@echo off
setlocal enabledelayedexpansion
title Himmel POS - Standalone Backend Server Mode
echo ========================================================
echo   Starting Himmel POS - Headless Server Mode
echo ========================================================
echo.

cd /d "%~dp0"

REM Resolve Python executable (prefer backend\venv Python if available)
set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 1. Verify Prerequisites (Python and Node.js with Bypass option)
where python >nul 2>&1
if %errorlevel% neq 0 if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo [WARNING] Python missing in PATH and backend\venv.
    echo Press 'B' to bypass or any other key to launch installer...
    set "CHOICE="
    set /p "CHOICE=Choice [B to bypass]: "
    if /i "!CHOICE!" neq "B" (
        call "%~dp0Himmel_POS_Install.bat"
    )
)

REM 2. Ensure backend\.env exists with LAN configuration (0.0.0.0)
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
)

REM 3. Build UI bundle so static files served by FastAPI are up to date
echo [NPM] Building fresh UI static assets (npm run build)...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm run build
) else (
    if not exist "%~dp0dist\index.html" (
        echo [WARNING] npm command not found and dist\index.html missing!
    )
)

REM 4. Stop existing POS backend instances
echo Stopping existing backend processes...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" >nul 2>&1

REM 5. Launch Python FastAPI Backend in persistent background console
echo Starting Himmel POS Server on 0.0.0.0:8000...
start "Himmel POS Backend Server" cmd /k "cd /d "%~dp0backend" && set ENV=production && "%PYTHON_EXE%" main.py"

echo.
echo ========================================================
echo   HIMMEL POS SERVER IS ACTIVE!
echo   - Local Register: http://localhost:8000
echo   - OpenAPI Docs:   http://localhost:8000/docs
echo   - Keep this console window open to maintain server operation.
echo ========================================================
timeout /t 5 /nobreak >nul 2>&1

