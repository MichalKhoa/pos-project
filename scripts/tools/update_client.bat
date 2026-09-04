@echo off
setlocal enabledelayedexpansion
title VoltFlow POS — Client Remote Updater
echo ========================================================
echo   VoltFlow POS - Automated Client Package Updater (NSIS)
echo ========================================================
echo.

set "LOG_FILE=%TEMP%\voltflow_update.log"
echo [%date% %time%] Starting VoltFlow POS Client Update > "%LOG_FILE%"

:: 1. Check if direct installer path was passed as argument %1
set "INSTALLER_PATH=%~1"

if not "%INSTALLER_PATH%"=="" (
    if exist "%INSTALLER_PATH%" (
        echo [1/3] Using provided installer package: %INSTALLER_PATH%
        echo [%date% %time%] Using local installer: %INSTALLER_PATH% >> "%LOG_FILE%"
        goto :APPLY_UPDATE
    )
)

:: 2. Download latest installer from GitHub Releases
echo [1/3] Fetching latest release info from GitHub...
set "API_URL=https://api.github.com/repos/MichalKhoa/pos-project-himmel/releases/latest"
set "TEMP_INSTALLER=%TEMP%\VoltFlow_POS_Setup_Latest.exe"

:: Query GitHub release API using PowerShell
set "DOWNLOAD_CMD=$res = Invoke-RestMethod -Uri '%API_URL%' -Headers @{'User-Agent'='VoltFlow-Updater'}; $asset = $res.assets | Where-Object { $_.name -like '*setup*.exe' -or $_.name -like '*Setup*.exe' } | Select-Object -First 1; if ($asset) { Write-Output $asset.browser_download_url } else { exit 1 }"

for /f "usebackq tokens=*" %%u in (`powershell -NoProfile -Command "%DOWNLOAD_CMD%" 2^>nul`) do (
    set "DOWNLOAD_URL=%%u"
)

if "%DOWNLOAD_URL%"=="" (
    echo [ERROR] Could not resolve download URL from GitHub Releases.
    echo Please ensure an active Internet connection and published release exist.
    echo [%date% %time%] Failed to resolve release URL >> "%LOG_FILE%"
    exit /b 1
)

echo [INFO] Downloading update from: !DOWNLOAD_URL!
echo [%date% %time%] Downloading from: !DOWNLOAD_URL! >> "%LOG_FILE%"
curl -L -s -o "%TEMP_INSTALLER%" "!DOWNLOAD_URL!"
if %errorlevel% neq 0 (
    echo [ERROR] Download failed.
    echo [%date% %time%] Download failed with code %errorlevel% >> "%LOG_FILE%"
    exit /b 1
)

set "INSTALLER_PATH=%TEMP_INSTALLER%"

:APPLY_UPDATE
:: 3. Stop running POS processes safely
echo.
echo [2/3] Terminating active POS instances...
echo [%date% %time%] Terminating active instances >> "%LOG_FILE%"

taskkill /F /IM "VoltFlow POS.exe" >nul 2>&1
taskkill /F /IM "pos-backend.exe" >nul 2>&1
taskkill /F /IM "pos-backend-standalone.exe" >nul 2>&1

:: Free port 8000 if occupied
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":8000 " ^| findstr /i "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Small cooldown
timeout /t 2 /nobreak >nul

:: 4. Run NSIS installer silently (/S)
echo.
echo [3/3] Installing update silently (/S)...
echo [%date% %time%] Executing: "%INSTALLER_PATH%" /S >> "%LOG_FILE%"

start /wait "" "%INSTALLER_PATH%" /S
if %errorlevel% neq 0 (
    echo [ERROR] Installer exited with error code: %errorlevel%
    echo [%date% %time%] Installer failed with code: %errorlevel% >> "%LOG_FILE%"
    exit /b %errorlevel%
)

echo [%date% %time%] Installation complete >> "%LOG_FILE%"

:: 5. Clean up temporary installer if downloaded
if exist "%TEMP_INSTALLER%" (
    del /f /q "%TEMP_INSTALLER%" >nul 2>&1
)

:: 6. Locate and relaunch VoltFlow POS
set "APP_EXE="
if exist "%ProgramFiles%\VoltFlow POS\VoltFlow POS.exe" (
    set "APP_EXE=%ProgramFiles%\VoltFlow POS\VoltFlow POS.exe"
) else if exist "%LocalAppData%\Programs\VoltFlow POS\VoltFlow POS.exe" (
    set "APP_EXE=%LocalAppData%\Programs\VoltFlow POS\VoltFlow POS.exe"
)

if not "!APP_EXE!"=="" (
    echo.
    echo [OK] Launching updated application: !APP_EXE!
    start "" "!APP_EXE!"
)

echo.
echo ========================================================
echo   VoltFlow POS Updated Successfully!
echo ========================================================
echo Log file: %LOG_FILE%
echo.
exit /b 0
