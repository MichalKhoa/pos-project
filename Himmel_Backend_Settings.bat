@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PYTHONW_EXE=pythonw"
if exist "%~dp0backend\venv\Scripts\pythonw.exe" (
    set "PYTHONW_EXE=%~dp0backend\venv\Scripts\pythonw.exe"
)

start "" "!PYTHONW_EXE!" "%~dp0backend\settings_gui.py"
exit
