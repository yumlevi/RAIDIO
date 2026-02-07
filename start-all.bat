@echo off
REM ACE-Step Radio Complete Startup Script for Windows
REM Starts ACE-Step API + Backend + Frontend in Radio Mode
setlocal enabledelayedexpansion

echo ==================================
echo   ACE-Step Radio - Complete Setup
echo ==================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Error: UI dependencies not installed!
    echo Please run setup.bat first.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo Error: Server dependencies not installed!
    echo Please run setup.bat first.
    pause
    exit /b 1
)

REM Check for .env file and RADIO_OWNER_SECRET
set RADIO_SECRET=
if exist ".env" (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="RADIO_OWNER_SECRET" set RADIO_SECRET=%%b
    )
)

REM If no secret set, prompt for one
if "%RADIO_SECRET%"=="" (
    echo.
    echo No RADIO_OWNER_SECRET found in .env file.
    echo.
    echo Enter a secret password for radio admin access:
    echo (This lets you skip songs instantly and change settings)
    echo.
    set /p RADIO_SECRET="Secret: "

    REM Save to .env file
    if not exist ".env" (
        echo RADIO_OWNER_SECRET=!RADIO_SECRET!> .env
    ) else (
        echo RADIO_OWNER_SECRET=!RADIO_SECRET!>> .env
    )
    echo.
    echo Secret saved to .env file.
    echo.
)

REM Get ACE-Step path from environment or use default
if "%ACESTEP_PATH%"=="" (
    set ACESTEP_PATH=models\ACE-Step-1.5
)

REM Check if ACE-Step exists
if not exist "%ACESTEP_PATH%" (
    echo.
    echo Warning: ACE-Step not found at %ACESTEP_PATH%
    echo.
    echo Please set ACESTEP_PATH or run setup.bat to install ACE-Step
    echo Example: set ACESTEP_PATH=C:\path\to\ACE-Step-1.5
    echo.
    pause
    exit /b 1
)

REM Detect ACE-Step installation type
set API_COMMAND=
if exist "%ACESTEP_PATH%\python_embeded\python.exe" (
    echo [+] Detected Windows Portable Package
    set API_COMMAND=python_embeded\python acestep\api_server.py
) else (
    echo [+] Detected Standard Installation
    set API_COMMAND=uv run acestep-api --port 39871
)

REM Get local IP for LAN access
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
    )
)

echo.
echo ==================================
echo   Starting Radio Station...
echo ==================================
echo.

REM Start ACE-Step API in new window
echo [1/3] Starting ACE-Step API server...
start "ACE-Step API Server" cmd /k "cd /d "%ACESTEP_PATH%" && %API_COMMAND%"

REM Wait for API to start
echo Waiting for API to initialize...
timeout /t 5 /nobreak >nul

REM Start backend in new window
echo [2/3] Starting backend server with Radio WebSocket...
start "ACE-Step Radio Backend" cmd /k "cd /d "%~dp0server" && npm run dev"

REM Wait for backend to start
echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

REM Start frontend in new window
echo [3/3] Starting frontend...
start "ACE-Step Radio Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

echo.
echo ==================================
echo   ACE-Step Radio Running!
echo ==================================
echo.
echo   ACE-Step API:  http://localhost:39871
echo   Backend:       http://localhost:3001
echo   Frontend:      http://localhost:1869
echo   WebSocket:     ws://localhost:3001/api/radio/ws
echo.
if defined LOCAL_IP (
    echo   LAN Access:    http://!LOCAL_IP!:3000
    echo.
    echo   Share this URL with friends to listen together!
    echo.
)
echo ----------------------------------
echo   Radio Features:
echo ----------------------------------
echo   - All listeners hear the same music
echo   - Generated songs go to shared queue
echo   - Vote to skip (50%% of listeners)
echo   - Admin can instant-skip + change settings
echo.
echo   To claim admin: Use your secret in the app
echo.
echo ==================================
echo.
echo   Close the terminal windows to stop all services.
echo.
echo Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:1869

echo.
echo Press any key to close this window (services will keep running)
pause >nul
