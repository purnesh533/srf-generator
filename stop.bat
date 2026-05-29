@echo off
setlocal
title SRF Stopper

echo ============================================
echo   Stopping RSi SRF Project
echo ============================================
echo.

echo [stop] Closing labelled server windows...
taskkill /FI "WINDOWTITLE eq SRF-Backend*"  /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SRF-Frontend*" /T /F >nul 2>&1

echo [stop] Killing process listening on port 5000 (backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo        - PID %%a
    taskkill /PID %%a /T /F >nul 2>&1
)

echo [stop] Killing process listening on port 5173 (frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo        - PID %%a
    taskkill /PID %%a /T /F >nul 2>&1
)

echo [stop] Killing any leftover nodemon / vite processes...
taskkill /IM nodemon.exe /T /F >nul 2>&1
taskkill /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq SRF-*" /T /F >nul 2>&1

echo.
echo ============================================
echo   All SRF servers have been stopped.
echo ============================================
echo.
pause
endlocal
