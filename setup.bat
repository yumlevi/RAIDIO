@echo off
REM ============================================================================
REM  RAIDIO Setup Script for Windows
REM  Complete installer: prerequisites, dependencies, ACE-Step, database
REM ============================================================================
setlocal enabledelayedexpansion

REM --- Phase 0: Banner + Setup ------------------------------------------------
echo.
echo   ====================================
echo     RAIDIO - AI Music Radio Setup
echo   ====================================
echo.

REM Set working directory to script location
cd /d "%~dp0"

REM Track what we installed/found for the summary
set "INSTALLED_LIST="
set "WARNED_LIST="
set "NODE_OK=0"
set "ACE_STEP_FOUND="
set "GENERATED_SECRET="

REM --- Phase 1: Prerequisites -------------------------------------------------
echo   [Phase 1] Checking prerequisites...
echo   ------------------------------------
echo.

REM --- Git ---
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=3" %%v in ('git --version') do set "GIT_VER=%%v"
    echo   [OK] Git !GIT_VER!
    set "INSTALLED_LIST=!INSTALLED_LIST!  Git !GIT_VER!&echo."
    goto :chk_node
)
echo   [!!] Git not found.
where winget >nul 2>&1
if !ERRORLEVEL! NEQ 0 goto :git_manual
echo        Attempting: winget install Git.Git
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo   [OK] Git installed via winget
    set "INSTALLED_LIST=!INSTALLED_LIST!  Git (auto-installed)&echo."
    goto :chk_node
)
:git_manual
echo   [WARN] Git not found. Download from: https://git-scm.com/download/win
set "WARNED_LIST=!WARNED_LIST!  Git - https://git-scm.com&echo."

:chk_node
REM --- Node.js ---
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :node_missing
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
for /f "tokens=1 delims=." %%m in ("!NODE_VER:~1!") do set "NODE_MAJOR=%%m"
if !NODE_MAJOR! GEQ 18 (
    echo   [OK] Node.js !NODE_VER!
    set "INSTALLED_LIST=!INSTALLED_LIST!  Node.js !NODE_VER!&echo."
    set "NODE_OK=1"
    goto :chk_python
)
echo   [!!] Node.js !NODE_VER! is too old, need 18+
echo        Please update from https://nodejs.org/
goto :chk_node_fatal

:node_missing
echo   [!!] Node.js not found.
where winget >nul 2>&1
if !ERRORLEVEL! NEQ 0 goto :node_manual
echo        Attempting: winget install OpenJS.NodeJS.LTS
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo   [OK] Node.js installed via winget
    echo        NOTE: You may need to restart your terminal for node to be on PATH.
    set "INSTALLED_LIST=!INSTALLED_LIST!  Node.js (auto-installed)&echo."
    set "NODE_OK=1"
    goto :chk_python
)
:node_manual
echo   [FAIL] Could not install Node.js. Download from: https://nodejs.org/

:chk_node_fatal
if "!NODE_OK!"=="0" (
    echo.
    echo   Node.js 18+ is required. Setup cannot continue.
    echo.
    pause
    exit /b 1
)

:chk_python
REM --- Python ---
set "PYTHON_CMD="
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PYTHON_CMD=python"
    goto :python_found
)
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PYTHON_CMD=python3"
    goto :python_found
)
goto :python_missing

:python_found
for /f "tokens=*" %%v in ('!PYTHON_CMD! --version 2^>^&1') do set "PY_VER=%%v"
echo   [OK] !PY_VER!
set "INSTALLED_LIST=!INSTALLED_LIST!  !PY_VER!&echo."
goto :chk_uv

:python_missing
echo   [!!] Python not found.
where winget >nul 2>&1
if !ERRORLEVEL! NEQ 0 goto :python_manual
echo        Attempting: winget install Python.Python.3.12
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo   [OK] Python 3.12 installed via winget
    echo        NOTE: Restart terminal for python to be on PATH.
    set "INSTALLED_LIST=!INSTALLED_LIST!  Python 3.12 (auto-installed)&echo."
    goto :chk_uv
)
:python_manual
echo   [WARN] Python not found. Download from: https://www.python.org/downloads/
set "WARNED_LIST=!WARNED_LIST!  Python - https://www.python.org/downloads/&echo."

:chk_uv
REM --- uv ---
where uv >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('uv --version 2^>^&1') do set "UV_VER=%%v"
    echo   [OK] !UV_VER!
    set "INSTALLED_LIST=!INSTALLED_LIST!  !UV_VER!&echo."
    goto :chk_ffmpeg
)
echo   [!!] uv not found.
if not defined PYTHON_CMD goto :uv_manual
echo        Attempting: pip install uv
!PYTHON_CMD! -m pip install uv >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo   [OK] uv installed via pip
    set "INSTALLED_LIST=!INSTALLED_LIST!  uv (auto-installed via pip)&echo."
    goto :chk_ffmpeg
)
:uv_manual
echo   [WARN] uv not found. Install with: pip install uv
set "WARNED_LIST=!WARNED_LIST!  uv - install with: pip install uv&echo."

:chk_ffmpeg
REM --- FFmpeg ---
where ffmpeg >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=3" %%v in ('ffmpeg -version 2^>^&1 ^| findstr /c:"ffmpeg version"') do set "FF_VER=%%v"
    echo   [OK] FFmpeg !FF_VER!
    set "INSTALLED_LIST=!INSTALLED_LIST!  FFmpeg !FF_VER!&echo."
    goto :prereqs_done
)
echo   [!!] FFmpeg not found.
where winget >nul 2>&1
if !ERRORLEVEL! NEQ 0 goto :ffmpeg_manual
echo        Attempting: winget install Gyan.FFmpeg
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo   [OK] FFmpeg installed via winget
    echo        NOTE: Restart terminal for ffmpeg to be on PATH.
    set "INSTALLED_LIST=!INSTALLED_LIST!  FFmpeg (auto-installed)&echo."
    goto :prereqs_done
)
:ffmpeg_manual
echo   [WARN] FFmpeg not found. Download from: https://ffmpeg.org/download.html
set "WARNED_LIST=!WARNED_LIST!  FFmpeg - https://ffmpeg.org/download.html&echo."

:prereqs_done

echo.

REM --- Phase 2: Node.js Dependencies -----------------------------------------
echo   [Phase 2] Installing Node.js dependencies...
echo   ------------------------------------
echo.

if exist "node_modules" (
    echo   [SKIP] Frontend node_modules already exists.
) else (
    echo   Installing frontend dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo   [FAIL] npm install failed in root directory.
        pause
        exit /b 1
    )
    echo   [OK] Frontend dependencies installed.
)

if exist "server\node_modules" (
    echo   [SKIP] Server node_modules already exists.
) else (
    echo   Installing server dependencies...
    pushd server
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        popd
        echo   [FAIL] npm install failed in server directory.
        pause
        exit /b 1
    )
    popd
    echo   [OK] Server dependencies installed.
)

echo.

REM --- Phase 3: ACE-Step Model Setup ------------------------------------------
echo   [Phase 3] ACE-Step model setup...
echo   ------------------------------------
echo.

set "ACE_PATH="

REM Check ACESTEP_PATH env var first
if not defined ACESTEP_PATH goto :ace_no_env
if exist "!ACESTEP_PATH!\pyproject.toml" (
    set "ACE_PATH=!ACESTEP_PATH!"
    echo   [OK] ACE-Step found via ACESTEP_PATH: !ACE_PATH!
    goto :ace_found
)
if exist "!ACESTEP_PATH!\acestep" (
    set "ACE_PATH=!ACESTEP_PATH!"
    echo   [OK] ACE-Step found via ACESTEP_PATH: !ACE_PATH!
    goto :ace_found
)
echo   [WARN] ACESTEP_PATH is set but doesn't look valid: !ACESTEP_PATH!
:ace_no_env

REM Check default location inside models/
if defined ACE_PATH goto :ace_found
if exist "models\ACE-Step-1.5\pyproject.toml" (
    set "ACE_PATH=models\ACE-Step-1.5"
    echo   [OK] ACE-Step found at default location: models\ACE-Step-1.5
    goto :ace_found
)
if exist "models\ACE-Step-1.5\acestep" (
    set "ACE_PATH=models\ACE-Step-1.5"
    echo   [OK] ACE-Step found at default location: models\ACE-Step-1.5
    goto :ace_found
)

REM Not found — offer to clone
echo   ACE-Step not found.
echo.
set /p "CLONE_ACE=  Clone ACE-Step from GitHub? [Y/n]: "
if /i "!CLONE_ACE!"=="" set "CLONE_ACE=Y"
if /i "!CLONE_ACE!" NEQ "Y" (
    echo   [SKIP] Skipping ACE-Step clone.
    echo          You can clone it later or set ACESTEP_PATH.
    set "WARNED_LIST=!WARNED_LIST!  ACE-Step - not installed, clone manually or set ACESTEP_PATH&echo."
    goto :ace_done
)
echo.
if not exist "models" mkdir models
echo   Cloning ACE-Step-1.5 to models\ACE-Step-1.5 ...
git clone https://github.com/ace-step/ACE-Step-1.5.git models\ACE-Step-1.5
if !ERRORLEVEL! NEQ 0 (
    echo   [WARN] git clone failed. You can clone manually later.
    set "WARNED_LIST=!WARNED_LIST!  ACE-Step - clone failed, do it manually&echo."
    goto :ace_done
)
set "ACE_PATH=models\ACE-Step-1.5"
echo   [OK] ACE-Step cloned successfully.

:ace_found
set "ACE_STEP_FOUND=!ACE_PATH!"

REM Check for Python environment
set "HAS_VENV=0"
if exist "!ACE_PATH!\.venv" set "HAS_VENV=1"
if exist "!ACE_PATH!\python_embeded" set "HAS_VENV=1"

if "!HAS_VENV!"=="1" (
    echo   [OK] ACE-Step Python environment found.
    goto :ace_venv_done
)

echo.
echo   ACE-Step found but no Python environment detected.
set /p "INSTALL_DEPS=  Install Python dependencies with uv? [Y/n]: "
if /i "!INSTALL_DEPS!"=="" set "INSTALL_DEPS=Y"
if /i "!INSTALL_DEPS!" NEQ "Y" (
    echo   [SKIP] Skipping Python dependency install.
    goto :ace_venv_done
)

where uv >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo   [WARN] uv not found. Install uv first, then run:
    echo          cd !ACE_PATH! ^&^& uv sync
    set "WARNED_LIST=!WARNED_LIST!  ACE-Step deps - install uv then run: uv sync&echo."
    goto :ace_venv_done
)

echo   Running uv sync in !ACE_PATH! ...
pushd "!ACE_PATH!"
uv sync
if !ERRORLEVEL! NEQ 0 (
    echo   [WARN] uv sync failed. You can run it manually later.
    set "WARNED_LIST=!WARNED_LIST!  ACE-Step deps - uv sync failed&echo."
) else (
    echo   [OK] ACE-Step Python dependencies installed.
)
popd

:ace_venv_done
echo   NOTE: Model weights will download automatically on first run.

:ace_done
echo.

REM --- Phase 4: Configuration -------------------------------------------------
echo   [Phase 4] Configuration...
echo   ------------------------------------
echo.

REM Create server/.env from template if needed
if exist "server\.env" (
    echo   [SKIP] server\.env already exists, not overwriting.
    goto :env_root
)
if not exist "server\.env.example" (
    echo   [WARN] server\.env.example not found. Cannot create .env file.
    set "WARNED_LIST=!WARNED_LIST!  server\.env - template missing&echo."
    goto :env_root
)

copy /y "server\.env.example" "server\.env" >nul
echo   [OK] Created server\.env from template.

REM Generate a random secret
set "SECRET="
for /f "tokens=*" %%g in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N').Substring(0,24)" 2^>nul') do set "SECRET=%%g"
if not defined SECRET set "SECRET=!RANDOM!!RANDOM!!RANDOM!!RANDOM!!RANDOM!"

set "GENERATED_SECRET=!SECRET!"
REM Use PowerShell for reliable find-replace in .env
powershell -NoProfile -Command "(Get-Content 'server\.env') -replace 'RADIO_OWNER_SECRET=your-secret-here', 'RADIO_OWNER_SECRET=!SECRET!' | Set-Content 'server\.env'" 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo   [WARN] Could not auto-set secret. Edit server\.env manually.
) else (
    echo   [OK] Generated RADIO_OWNER_SECRET in server\.env
)

:env_root
REM Create root .env with RADIO_OWNER_SECRET (used by start scripts)
if exist ".env" (
    echo   [SKIP] Root .env already exists.
    goto :env_done
)
if not defined GENERATED_SECRET (
    echo   [SKIP] Root .env not created, no new secret generated.
    goto :env_done
)
echo RADIO_OWNER_SECRET=!GENERATED_SECRET!> .env
echo   [OK] Created root .env with RADIO_OWNER_SECRET.
:env_done

REM Create required directories
if not exist "server\data" (
    mkdir "server\data"
    echo   [OK] Created server\data\
) else (
    echo   [SKIP] server\data\ already exists.
)
if not exist "server\public\audio" (
    mkdir "server\public\audio"
    echo   [OK] Created server\public\audio\
) else (
    echo   [SKIP] server\public\audio\ already exists.
)

echo.

REM --- Phase 5: Database Migration --------------------------------------------
echo   [Phase 5] Database migration...
echo   ------------------------------------
echo.

pushd server
call npx tsx src/db/migrate.ts
if !ERRORLEVEL! NEQ 0 (
    echo   [WARN] Database migration had issues (may be OK if tables exist^).
) else (
    echo   [OK] Database migrated successfully.
)
popd

echo.

REM --- Phase 6: Summary -------------------------------------------------------
echo.
echo   ====================================
echo     Setup Complete!
echo   ====================================
echo.

if not defined INSTALLED_LIST goto :sum_no_prereqs
echo   Prerequisites:
echo !INSTALLED_LIST!
:sum_no_prereqs

if not defined WARNED_LIST goto :sum_no_warns
echo   Warnings:
echo !WARNED_LIST!
echo.
:sum_no_warns

if not defined GENERATED_SECRET goto :sum_no_secret
echo   Radio Owner Secret: !GENERATED_SECRET!
echo   Saved in server\.env and .env - use this to claim admin in the app
echo.
:sum_no_secret

if defined ACE_STEP_FOUND (
    echo   ACE-Step: !ACE_STEP_FOUND!
) else (
    echo   ACE-Step: Not installed - set ACESTEP_PATH or run setup again
)
echo.

echo   Next steps:
echo     1. Run start-all.bat to launch all services
echo     2. Open http://localhost:1869 in your browser
echo     3. Enter your owner secret in the app to claim admin
echo.

pause
