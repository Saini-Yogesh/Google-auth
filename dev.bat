@echo off
setlocal
cd /d "%~dp0"
title Google Auth App - Development Mode

echo ========================================================
echo   Google Authentication App (Development Mode)
echo ========================================================
echo.

REM 1. Check Root Dependencies
if not exist "node_modules\" (
    echo [1/3] Installing backend dependencies...
    call npm install
)

REM 2. Check Client Dependencies
if not exist "client\node_modules\" (
    echo [2/3] Installing React frontend dependencies...
    cd client
    call npm install
    cd ..
)

echo [3/3] Launching Backend (port 3000) and React Vite (port 5173)...
echo.
echo ========================================================
echo   React Dev Server: http://localhost:5173
echo   Express API:      http://localhost:3000
echo ========================================================
echo.

start "" http://localhost:5173

npm run dev

