@echo off
setlocal enabledelayedexpansion
title Himmel POS - Enable Windows Startup
echo ========================================================
echo   Configure Himmel POS App to Launch on Windows Boot
echo ========================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Himmel_POS_AutoStart.lnk"
set "TARGET_BAT=%~dp0Himmel_POS.bat"

echo Choose how Himmel POS UI should open when Windows starts:
echo   [1] Standard App Mode (Desktop Window)
echo   [2] Fullscreen Touch Kiosk Mode
echo   [3] Remove Auto-Start Shortcut
echo.

set /p "CHOICE=Select option [1, 2, or 3]: "

if "%CHOICE%"=="2" (
    set "TARGET_BAT=%~dp0Himmel_POS_Kiosk.bat"
    echo.
    echo Configuring Fullscreen Touch Kiosk Mode...
) else if "%CHOICE%"=="3" (
    if exist "%SHORTCUT_PATH%" (
        del "%SHORTCUT_PATH%" >nul 2>&1
        echo.
        echo [SUCCESS] Auto-start shortcut removed.
    ) else (
        echo.
        echo [INFO] No auto-start shortcut was found.
    )
    goto :END
) else (
    set "TARGET_BAT=%~dp0Himmel_POS.bat"
    echo.
    echo Configuring Standard Desktop App Mode...
)

REM Create Windows Startup Shortcut via PowerShell
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath='%TARGET_BAT%'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=1; $s.Save()" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ========================================================
    echo   SUCCESS! Himmel POS App will open automatically when:
    echo   - Windows logs into user session
    echo   - Target: %TARGET_BAT%
    echo ========================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut in Startup folder.
)

:END
echo.
pause
