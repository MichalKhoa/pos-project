@echo off
setlocal enabledelayedexpansion
title Himmel POS — 1-Click Installer
echo ========================================================
echo   Himmel POS Automated 1-Click Installation Script
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Verify / Auto-Install / Bypass Python & Node.js
echo [1/5] Checking system prerequisites (Python & Node.js)...

set "SKIP_PYTHON=0"
set "SKIP_NODE=0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0backend\venv\Scripts\python.exe" (
        echo [OK] Existing Python virtual environment found in backend\venv.
    ) else (
        echo [WARNING] Python 3 was not found in system PATH.
        echo.
        echo Options:
        echo   [1] Attempt automatic installation via Winget (Recommended)
        echo   [2] Bypass / Skip Python check (Assume pre-configured environment)
        echo   [3] Exit installation
        echo.
        set /p "PY_CHOICE=Select an option [1/2/3] (default 1): "
        if "!PY_CHOICE!"=="2" (
            echo [INFO] Bypassing Python check...
            set "SKIP_PYTHON=1"
        ) else if "!PY_CHOICE!"=="3" (
            echo Installation canceled by user.
            pause
            exit /b 1
        ) else (
            echo [INFO] Installing Python 3.11 via Winget...
            winget install --id Python.Python.3.11 --exact --accept-package-agreements --accept-source-agreements
            if !errorlevel! neq 0 (
                echo [WARNING] Winget installation failed or Winget is unavailable.
                set /p "BYPASS_PY=Do you want to bypass Python check and continue? (Y/N): "
                if /i "!BYPASS_PY!" neq "Y" (
                    echo Please install Python 3.10+ manually from https://python.org and check "Add to PATH".
                    pause
                    exit /b 1
                )
                set "SKIP_PYTHON=1"
            )
        )
    )
) else (
    echo [OK] Python is installed.
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Node.js was not found in system PATH.
    echo.
    echo Options:
    echo   [1] Attempt automatic installation via Winget (Recommended)
    echo   [2] Bypass / Skip Node.js check
    echo   [3] Exit installation
    echo.
    set /p "NODE_CHOICE=Select an option [1/2/3] (default 1): "
    if "!NODE_CHOICE!"=="2" (
        echo [INFO] Bypassing Node.js check...
        set "SKIP_NODE=1"
    ) else if "!NODE_CHOICE!"=="3" (
        echo Installation canceled by user.
        pause
        exit /b 1
    ) else (
        echo [INFO] Installing Node.js LTS via Winget...
        winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
        if !errorlevel! neq 0 (
            echo [WARNING] Winget installation failed or Winget is unavailable.
            set /p "BYPASS_NODE=Do you want to bypass Node.js check and continue? (Y/N): "
            if /i "!BYPASS_NODE!" neq "Y" (
                echo Please install Node.js LTS manually from https://nodejs.org.
                pause
                exit /b 1
            )
            set "SKIP_NODE=1"
        )
    )
) else (
    echo [OK] Node.js is installed.
)

:: 2. Setup Python Virtual Environment
echo.
echo [2/5] Setting up Python virtual environment & backend packages...
if not exist "%~dp0backend\venv" (
    python -m venv "%~dp0backend\venv" 2>nul || py -m venv "%~dp0backend\venv" 2>nul
)

if exist "%~dp0backend\venv\Scripts\activate.bat" (
    call "%~dp0backend\venv\Scripts\activate.bat"
    python -m pip install --upgrade pip >nul 2>&1
    pip install -r "%~dp0backend\requirements.txt"
) else (
    echo [WARNING] backend\venv not created. Skipping Python package installation.
)

:: 3. Setup Frontend Dependencies & Run Build
echo.
echo [3/5] Installing Node.js dependencies & building frontend bundle...
cd /d "%~dp0"
where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo [NPM] Installing frontend dependencies...
    call npm install
    echo [NPM] Building React frontend UI (npm run build)...
    call npm run build
) else (
    echo [WARNING] npm command not found. Skipping frontend build.
)

:: 4. Streamlined Environment Configuration
echo.
echo [4/5] Checking environment configuration...
if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
    echo [OK] backend\.env configuration created automatically.
) else (
    echo [OK] backend\.env configuration already exists.
)

:: 5. Create Desktop Shortcut Automatically
echo.
echo [5/5] Creating Desktop Shortcut...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Himmel POS.lnk')); $s.TargetPath='%~dp0Himmel_POS.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='C:\Windows\System32\shell32.dll,13'; $s.Save()" >nul 2>&1

echo.
echo ========================================================
echo   ✅ INSTALLATION COMPLETED SUCCESSFULLY!
echo   Desktop shortcut "Himmel POS" has been created.
echo ========================================================
echo.
pause
