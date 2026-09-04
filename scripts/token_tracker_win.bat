@echo off
setlocal
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    python "%~dp0token_tracker_win.py" %*
    exit /b %ERRORLEVEL%
)
where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    py -3 "%~dp0token_tracker_win.py" %*
    exit /b %ERRORLEVEL%
)
echo [ERROR] Python not found in PATH. Please install Python or ensure it is added to PATH.
exit /b 1
