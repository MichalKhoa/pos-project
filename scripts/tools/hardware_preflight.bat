@echo off
setlocal enabledelayedexpansion
title VoltFlow POS - Hardware & Environment Pre-Flight
echo ========================================================
echo   VoltFlow POS — Hardware Pre-Flight Diagnostic Tool
echo ========================================================
echo.

cd /d "%~dp0..\.."

set "PYTHON_EXE=python"
if exist "%~dp0..\..\backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\..\backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" "%~dp0hardware_preflight.py"

pause
