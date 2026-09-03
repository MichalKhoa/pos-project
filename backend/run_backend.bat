@echo off
cd /d "%~dp0"
if "%ENV%"=="" set ENV=production
set "PYTHON_EXE=python"
if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
)
"%PYTHON_EXE%" migrations.py
"%PYTHON_EXE%" main.py
