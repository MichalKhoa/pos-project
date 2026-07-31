@echo off
title Himmel POS — 1-Click Installer
echo ========================================================
echo   Himmel POS Automated 1-Click Installation Script
echo ========================================================
echo.

:: 1. Verify Python & Node.js
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python single command not found. Please install Python 3.10+ and check "Add to PATH".
    pause
    exit /b 1
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js LTS from nodejs.org.
    pause
    exit /b 1
)

:: 2. Setup Python Virtual Environment
echo [1/4] Setting up Python virtual environment...
if not exist "%~dp0backend\venv" (
    python -m venv "%~dp0backend\venv"
)
call "%~dp0backend\venv\Scripts\activate.bat" 2>nul || call "%~dp0backend\venv\bin\activate" 2>nul
python -m pip install --upgrade pip >nul 2>&1
pip install -r "%~dp0backend\requirements.txt"

:: 3. Setup Frontend Dependencies
echo.
echo [2/4] Installing Node.js frontend dependencies...
cd /d "%~dp0"
call npm install

:: 4. Streamlined Interactive .env Generator (Optional)
echo.
echo [3/4] Checking environment configuration...
if not exist "%~dp0backend\.env" (
    echo Config file backend\.env not found.
    set /p "LITE_KEY=Zadejte Litestream Access Key (stiskněte ENTER pro přeskočení): "
    if not "%LITE_KEY%"=="" (
        set /p "LITE_SECRET=Zadejte Litestream Secret Key: "
        (
            echo LITESTREAM_ACCESS_KEY_ID=%LITE_KEY%
            echo LITESTREAM_SECRET_ACCESS_KEY=%LITE_SECRET%
        ) > "%~dp0backend\.env"
        echo [OK] backend\.env byl automaticky vytvořen.
    ) else (
        echo [INFO] Přeskočeno. Databáze poběží v lokálním režimu.
    )
) else (
    echo [OK] Konfigurace backend\.env již existuje.
)

:: 5. Create Desktop Shortcut Automatically
echo.
echo [4/4] Vytvářím zástupce na Ploše...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Himmel POS.lnk')); $s.TargetPath='%~dp0Himmel_POS.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='C:\Windows\System32\shell32.dll,13'; $s.Save()" >nul 2>&1

echo.
echo ========================================================
echo   ✅ INSTALACE DOKONČENA!
echo   Na ploše byl vytvořen zástupce "Himmel POS".
echo ========================================================
echo.
pause
