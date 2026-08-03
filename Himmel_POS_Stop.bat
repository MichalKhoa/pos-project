@echo off
title Himmel POS Shutdown
echo ========================================================
echo   Stopping Himmel POS Services & Terminal Windows...
echo ========================================================

:: 1. Close command prompt windows along with all child process trees (/T /F)
echo Closing Backend Terminal Window...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Backend*" 2>nul

echo Closing Web Server Terminal Window...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Web*" 2>nul

echo Closing Litestream Terminal Window...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Litestream*" 2>nul

echo Closing Launcher Windows...
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Launcher*" 2>nul
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS Kiosk Launcher*" 2>nul
taskkill /T /F /FI "WINDOWTITLE eq Himmel POS — Enable Mobile*" 2>nul

:: 2. Terminate any remaining Node.js or Python processes
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *" 2>nul

:: 3. Close MS Edge application window
echo Closing Cashier App Window...
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq http://localhost:5173*" 2>nul
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq Himmel POS App*" 2>nul

echo Done! All Himmel POS processes and leftover terminal windows have been closed.
timeout /t 2 >nul
