@echo off
setlocal
cd /d "%~dp0"
title Google Auth App - Production Runner

echo ========================================================
echo   Google Authentication App (React 19 + Express)
echo ========================================================
echo.

REM 1. Check Root Dependencies
if not exist "node_modules\" (
    echo [1/4] Installing backend dependencies...
    call npm install
) else (
    echo [1/4] Backend dependencies ready.
)

REM 2. Check Client Dependencies
if not exist "client\node_modules\" (
    echo [2/4] Installing React frontend dependencies...
    cd client
    call npm install
    cd ..
) else (
    echo [2/4] Frontend dependencies ready.
)

REM 3. Build React Frontend (if not already built)
if not exist "client\dist\" (
    echo [3/4] Building React application...
    call npm run build
) else (
    echo [3/4] React build found.
)

echo [4/4] Starting server on http://localhost:3000 ...
echo.
echo ========================================================
echo   Application running at: http://localhost:3000
echo   Press Ctrl+C to stop the server
echo ========================================================
echo.

REM Open browser after 2 seconds
start "" http://localhost:3000

REM Start Express Server
npm start

