@echo off
REM RAIDIO Startup Script for Windows
setlocal enabledelayedexpansion

echo ==================================
echo   RAIDIO - AI Music Radio
echo ==================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Error: Dependencies not installed!
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

REM Get local IP for LAN access
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
    )
)

echo.
echo Starting RAIDIO...
echo.
echo Make sure ACE-Step API is running:
echo   cd path\to\ACE-Step
echo   uv run acestep-api --port 39871
echo.
echo ==================================
echo.

REM Start backend in new window
echo Starting backend server...
start "RAIDIO Backend" cmd /k "cd server && npm run dev"

REM Wait for backend to start
echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

REM Start frontend in new window
echo Starting frontend...
start "RAIDIO Frontend" cmd /k "npm run dev"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Check if cloudflared is installed and ask about tunnel
set TUNNEL_URL=
where cloudflared >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo Cloudflare Tunnel detected!
    echo.
    set /p ENABLE_TUNNEL="Enable public sharing via Cloudflare Tunnel? (y/n): "
    if /i "!ENABLE_TUNNEL!"=="y" (
        echo.
        echo Starting Cloudflare Tunnel...
        echo This will create a public URL for sharing.
        echo.

        REM Use LAN IP if available, otherwise localhost
        REM --no-tls-verify needed for Windows certificate issues
        if defined LOCAL_IP (
            start "RAIDIO Tunnel" cmd /k "cloudflared tunnel --no-tls-verify --url http://!LOCAL_IP!:1869"
        ) else (
            start "RAIDIO Tunnel" cmd /k "cloudflared tunnel --no-tls-verify --url http://localhost:1869"
        )

        echo Waiting for tunnel to initialize...
        timeout /t 5 /nobreak >nul

        echo.
        echo ==================================
        echo   TUNNEL ACTIVE
        echo ==================================
        echo.
        echo   Check the "RAIDIO Tunnel" window for your
        echo   public URL (looks like: https://xxx.trycloudflare.com)
        echo.
        echo   Share that URL with anyone to let them join!
        echo.
    )
)

echo.
echo ==================================
echo   RAIDIO Running!
echo ==================================
echo.
echo   Local URLs:
echo   -----------
echo   Frontend:     http://localhost:1869
echo   Backend:      http://localhost:3001
echo   WebSocket:    ws://localhost:3001/api/radio/ws
echo.
if defined LOCAL_IP (
    echo   LAN Access:   http://!LOCAL_IP!:1869
    echo   (Share with devices on your local network)
    echo.
)
echo ----------------------------------
echo   Radio Features:
echo ----------------------------------
echo   - All listeners hear the same music
echo   - Generated songs go to shared queue
echo   - Vote to skip (50%% of listeners)
echo   - Admin can instant-skip + change settings
echo   - Chat with other listeners
echo.
echo   To claim admin: Use your secret in Settings
echo.
echo ==================================
echo.
echo   Close the terminal windows to stop.
echo.
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:1869

pause
