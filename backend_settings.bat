@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Backend Settings
echo ========================================================
echo   Launching VoltFlow POS Backend Settings GUI...
echo ========================================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\pythonw.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\pythonw.exe"
) else if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

start "" "%PYTHON_EXE%" "%~dp0backend\settings_gui.py"
