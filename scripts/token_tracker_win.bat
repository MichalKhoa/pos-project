@echo off
setlocal
cd /d "%~dp0.."

set PYTHON_CMD=
if exist "%~dp0..\backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0..\backend\venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set PYTHON_CMD=python
    ) else (
        where py >nul 2>&1
        if %ERRORLEVEL% equ 0 (
            set PYTHON_CMD=py -3
        )
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERROR] Python not found in virtualenv or system PATH.
    echo Please install Python or ensure it is added to PATH.
    pause
    exit /b 1
)

if "%~1"=="" (
    echo ========================================================
    echo   Updating Token Usage Summaries (VoltFlow POS)
    echo ========================================================
    echo.
    %PYTHON_CMD% "%~dp0token_tracker_win.py" update
    echo.
    echo Summaries updated in folder: token_summaries\
    echo.
    pause
    exit /b 0
)

%PYTHON_CMD% "%~dp0token_tracker_win.py" %*
exit /b %ERRORLEVEL%
