@echo off
title Himmel POS - Enable Mobile / LAN Access
echo ========================================================
echo   Himmel POS - Remote Mobile / LAN Access Setup
echo ========================================================
echo.

REM 1. Check and Elevate to Administrator Rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges to configure Windows Firewall...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

REM 2. Configure Windows Defender Firewall Inbound Rules
echo [1/3] Adding Windows Defender Firewall Inbound Rules...
netsh advfirewall firewall delete rule name="Himmel POS Frontend (Port 5173)" >nul 2>&1
netsh advfirewall firewall delete rule name="Himmel POS Backend (Port 8000)" >nul 2>&1

netsh advfirewall firewall add rule name="Himmel POS Frontend (Port 5173)" dir=in action=allow protocol=TCP localport=5173 >nul
netsh advfirewall firewall add rule name="Himmel POS Backend (Port 8000)" dir=in action=allow protocol=TCP localport=8000 >nul

if %errorlevel% equ 0 (
    echo [OK] Firewall rules for ports 5173 and 8000 configured successfully.
) else (
    echo [WARNING] Firewall configuration encountered an issue. Please verify ports 5173 and 8000 manually.
)

REM 3. Configure backend\.env for LAN host binding
echo.
echo [2/3] Updating backend environment configuration (backend\.env)...

if not exist "%~dp0backend\.env" (
    (
        echo HOST=0.0.0.0
        echo PORT=8000
        echo ALLOWED_ORIGINS=*
    ) > "%~dp0backend\.env"
    echo [OK] Created backend\.env with HOST=0.0.0.0 and ALLOWED_ORIGINS=*
) else (
    REM Update or append HOST and ALLOWED_ORIGINS settings
    findstr /i "^HOST=" "%~dp0backend\.env" >nul 2>&1
    if %errorlevel% neq 0 (
        echo HOST=0.0.0.0 >> "%~dp0backend\.env"
    )
    findstr /i "^ALLOWED_ORIGINS=" "%~dp0backend\.env" >nul 2>&1
    if %errorlevel% neq 0 (
        echo ALLOWED_ORIGINS=* >> "%~dp0backend\.env"
    )
    echo [OK] Configured backend\.env for 0.0.0.0 binding and CORS.
)

REM 4. Display Local IPv4 Addresses for Phone Access
echo.
echo [3/3] Detecting Local Network IP Address...
echo --------------------------------------------------------
powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*'} | ForEach-Object { Write-Host ('  -> Production URL: http://' + $_.IPAddress + ':8000') -ForegroundColor Green; Write-Host ('  -> Dev Server URL: http://' + $_.IPAddress + ':5173') -ForegroundColor Yellow }"
echo --------------------------------------------------------

echo.
echo ========================================================
echo   LAN and MOBILE ACCESS CONFIGURED SUCCESSFULLY!
echo   1. Ensure phone is connected to the SAME Wi-Fi router.
echo   2. Type one of the Green URLs above into your phone browser.
echo   3. Start the POS application using Himmel_POS.bat
echo ========================================================
echo.
pause

