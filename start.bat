@echo off
setlocal
title SRF Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================
echo   Starting RSi SRF Project
echo   Root: %ROOT%
echo ============================================
echo.

if not exist "server\node_modules" (
    echo [setup] Installing backend dependencies...
    pushd "server"
    call npm install
    popd
)

if not exist "client\node_modules" (
    echo [setup] Installing frontend dependencies...
    pushd "client"
    call npm install
    popd
)

echo [start] Launching Backend  (http://localhost:5000)
start "SRF-Backend" cmd /k "cd /d "%ROOT%server" && npm run dev"

timeout /t 2 /nobreak >nul

echo [start] Launching Frontend (http://localhost:5173)
start "SRF-Frontend" cmd /k "cd /d "%ROOT%client" && npm run dev"

timeout /t 4 /nobreak >nul

echo [open] Opening browser...
start "" "http://localhost:5173"

echo.
echo ============================================
echo   Servers started in separate windows.
echo   Backend  window: "SRF-Backend"
echo   Frontend window: "SRF-Frontend"
echo.
echo   To shut everything down, run: stop.bat
echo ============================================
echo.
pause
endlocal
