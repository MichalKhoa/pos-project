@echo off
setlocal enabledelayedexpansion
title Himmel POS - Debug Launcher
echo ========================================================
echo   Starting Himmel POS (Debug Mode: Vite + FastAPI)
echo ========================================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)

REM 1. Start FastAPI Backend in new window
echo [1/2] Starting Backend Server (:8000)...
start "Himmel POS Backend (Debug)" /D "%~dp0backend" cmd /k "set ENV=development&& %PYTHON_EXE% main.py"

REM 2. Start Vite Dev Server in new window
echo [2/2] Starting Vite Dev Server (:5173)...
start "Himmel POS Frontend (Vite)" cmd /k "npm run dev"

echo.
echo Debug environment initialized.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
