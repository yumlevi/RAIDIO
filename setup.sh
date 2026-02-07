#!/bin/bash
# ===========================================================================
#  RAIDIO Setup Script for Linux/macOS
#  Complete installer: prerequisites, dependencies, ACE-Step, database
# ===========================================================================

set -e

# --- Phase 0: Banner + Setup ------------------------------------------------

echo ""
echo "  ===================================="
echo "    RAIDIO - AI Music Radio Setup"
echo "  ===================================="
echo ""

# Set working directory to script location
cd "$(dirname "$0")"

# Color helpers (no-op if not a terminal)
if [ -t 1 ]; then
    GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
    GREEN=''; YELLOW=''; RED=''; NC=''
fi
ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
skip() { echo "  [SKIP] $1"; }

INSTALLED_LIST=""
WARNED_LIST=""
NODE_OK=0
ACE_STEP_FOUND=""
GENERATED_SECRET=""

# Detect package manager
PKG_MGR=""
if command -v brew &>/dev/null; then
    PKG_MGR="brew"
elif command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
elif command -v pacman &>/dev/null; then
    PKG_MGR="pacman"
fi

pkg_install() {
    local pkg="$1"
    case "$PKG_MGR" in
        brew)   brew install "$pkg" ;;
        apt)    sudo apt-get install -y "$pkg" ;;
        dnf)    sudo dnf install -y "$pkg" ;;
        pacman) sudo pacman -S --noconfirm "$pkg" ;;
        *)      return 1 ;;
    esac
}

# --- Phase 1: Prerequisites --------------------------------------------------

echo "  [Phase 1] Checking prerequisites..."
echo "  ------------------------------------"
echo ""

# --- Git ---
if command -v git &>/dev/null; then
    GIT_VER=$(git --version | awk '{print $3}')
    ok "Git $GIT_VER"
    INSTALLED_LIST="$INSTALLED_LIST\n  Git $GIT_VER (found)"
else
    warn "Git not found."
    if [ -n "$PKG_MGR" ]; then
        echo "       Attempting: $PKG_MGR install git"
        if pkg_install git 2>/dev/null; then
            ok "Git installed via $PKG_MGR"
            INSTALLED_LIST="$INSTALLED_LIST\n  Git (auto-installed)"
        else
            warn "Could not auto-install Git."
            WARNED_LIST="$WARNED_LIST\n  Git - install manually"
        fi
    else
        WARNED_LIST="$WARNED_LIST\n  Git - install manually"
    fi
fi

# --- Node.js ---
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    NODE_MAJOR=${NODE_VER#v}
    NODE_MAJOR=${NODE_MAJOR%%.*}
    if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
        ok "Node.js $NODE_VER"
        INSTALLED_LIST="$INSTALLED_LIST\n  Node.js $NODE_VER (found)"
        NODE_OK=1
    else
        warn "Node.js $NODE_VER is too old (need 18+)"
        echo "       Install via nvm: https://github.com/nvm-sh/nvm"
        echo "         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
        echo "         nvm install --lts"
        WARNED_LIST="$WARNED_LIST\n  Node.js - update to 18+"
    fi
else
    warn "Node.js not found."
    if [ "$PKG_MGR" = "brew" ]; then
        echo "       Attempting: brew install node"
        if brew install node 2>/dev/null; then
            ok "Node.js installed via brew"
            INSTALLED_LIST="$INSTALLED_LIST\n  Node.js (auto-installed)"
            NODE_OK=1
        else
            fail "Could not install Node.js."
        fi
    else
        echo "       Install via nvm:"
        echo "         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
        echo "         nvm install --lts"
    fi
fi

if [ "$NODE_OK" -eq 0 ]; then
    echo ""
    fail "Node.js 18+ is required. Setup cannot continue."
    echo ""
    exit 1
fi

# --- Python ---
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    PY_VER=$($PYTHON_CMD --version 2>&1)
    ok "$PY_VER"
    INSTALLED_LIST="$INSTALLED_LIST\n  $PY_VER (found)"
else
    warn "Python not found."
    if [ -n "$PKG_MGR" ]; then
        local_pkg="python3"
        [ "$PKG_MGR" = "brew" ] && local_pkg="python@3.12"
        echo "       Attempting: $PKG_MGR install $local_pkg"
        if pkg_install "$local_pkg" 2>/dev/null; then
            ok "Python installed via $PKG_MGR"
            INSTALLED_LIST="$INSTALLED_LIST\n  Python (auto-installed)"
        else
            warn "Could not install Python."
            WARNED_LIST="$WARNED_LIST\n  Python - install manually"
        fi
    else
        WARNED_LIST="$WARNED_LIST\n  Python - install from https://www.python.org/downloads/"
    fi
fi

# --- uv ---
if command -v uv &>/dev/null; then
    UV_VER=$(uv --version 2>&1)
    ok "$UV_VER"
    INSTALLED_LIST="$INSTALLED_LIST\n  $UV_VER (found)"
else
    warn "uv not found."
    echo "       Attempting: curl installer"
    if curl -LsSf https://astral.sh/uv/install.sh 2>/dev/null | sh 2>/dev/null; then
        # Source the env to make uv available in this session
        [ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env" 2>/dev/null
        export PATH="$HOME/.local/bin:$PATH"
        if command -v uv &>/dev/null; then
            ok "uv installed"
            INSTALLED_LIST="$INSTALLED_LIST\n  uv (auto-installed)"
        else
            warn "uv installed but not on PATH yet. Restart your terminal."
            WARNED_LIST="$WARNED_LIST\n  uv - restart terminal to pick up PATH"
        fi
    else
        warn "Could not install uv."
        echo "       Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
        WARNED_LIST="$WARNED_LIST\n  uv - install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
fi

# --- FFmpeg ---
if command -v ffmpeg &>/dev/null; then
    FF_VER=$(ffmpeg -version 2>&1 | head -n1 | awk '{print $3}')
    ok "FFmpeg $FF_VER"
    INSTALLED_LIST="$INSTALLED_LIST\n  FFmpeg $FF_VER (found)"
else
    warn "FFmpeg not found."
    if [ -n "$PKG_MGR" ]; then
        echo "       Attempting: $PKG_MGR install ffmpeg"
        if pkg_install ffmpeg 2>/dev/null; then
            ok "FFmpeg installed via $PKG_MGR"
            INSTALLED_LIST="$INSTALLED_LIST\n  FFmpeg (auto-installed)"
        else
            warn "Could not install FFmpeg."
            WARNED_LIST="$WARNED_LIST\n  FFmpeg - install manually"
        fi
    else
        WARNED_LIST="$WARNED_LIST\n  FFmpeg - install from https://ffmpeg.org/download.html"
    fi
fi

echo ""

# --- Phase 2: Node.js Dependencies -------------------------------------------

echo "  [Phase 2] Installing Node.js dependencies..."
echo "  ------------------------------------"
echo ""

if [ -d "node_modules" ]; then
    skip "Frontend node_modules already exists."
else
    echo "  Installing frontend dependencies..."
    npm install
    ok "Frontend dependencies installed."
fi

if [ -d "server/node_modules" ]; then
    skip "Server node_modules already exists."
else
    echo "  Installing server dependencies..."
    (cd server && npm install)
    ok "Server dependencies installed."
fi

echo ""

# --- Phase 3: ACE-Step Model Setup --------------------------------------------

echo "  [Phase 3] ACE-Step model setup..."
echo "  ------------------------------------"
echo ""

ACE_PATH=""

# Check ACESTEP_PATH env var first
if [ -n "$ACESTEP_PATH" ]; then
    if [ -f "$ACESTEP_PATH/pyproject.toml" ] || [ -d "$ACESTEP_PATH/acestep" ]; then
        ACE_PATH="$ACESTEP_PATH"
        ok "ACE-Step found via ACESTEP_PATH: $ACE_PATH"
    else
        warn "ACESTEP_PATH is set but doesn't look valid: $ACESTEP_PATH"
    fi
fi

# Check default sibling location
if [ -z "$ACE_PATH" ]; then
    if [ -f "models/ACE-Step-1.5/pyproject.toml" ] || [ -d "models/ACE-Step-1.5/acestep" ]; then
        ACE_PATH="models/ACE-Step-1.5"
        ok "ACE-Step found at default location: models/ACE-Step-1.5"
    fi
fi

# If not found, offer to clone
if [ -z "$ACE_PATH" ]; then
    echo "  ACE-Step not found."
    echo ""
    read -r -p "  Clone ACE-Step from GitHub? [Y/n]: " CLONE_ACE
    CLONE_ACE=${CLONE_ACE:-Y}
    if [[ "$CLONE_ACE" =~ ^[Yy]$ ]]; then
        echo ""
        mkdir -p models
        echo "  Cloning ACE-Step-1.5 to models/ACE-Step-1.5 ..."
        if git clone https://github.com/ace-step/ACE-Step-1.5.git models/ACE-Step-1.5; then
            ACE_PATH="models/ACE-Step-1.5"
            ok "ACE-Step cloned successfully."
        else
            warn "git clone failed. You can clone manually later."
            WARNED_LIST="$WARNED_LIST\n  ACE-Step - clone failed, do it manually"
        fi
    else
        skip "Skipping ACE-Step clone."
        echo "         You can clone it later or set ACESTEP_PATH."
        WARNED_LIST="$WARNED_LIST\n  ACE-Step - not installed, clone manually or set ACESTEP_PATH"
    fi
fi

# If found, check for Python environment and offer to set up
if [ -n "$ACE_PATH" ]; then
    ACE_STEP_FOUND="$ACE_PATH"
    HAS_VENV=0
    [ -d "$ACE_PATH/.venv" ] && HAS_VENV=1
    [ -d "$ACE_PATH/python_embeded" ] && HAS_VENV=1

    if [ "$HAS_VENV" -eq 0 ]; then
        echo ""
        echo "  ACE-Step found but no Python environment detected."
        read -r -p "  Install Python dependencies with uv? [Y/n]: " INSTALL_DEPS
        INSTALL_DEPS=${INSTALL_DEPS:-Y}
        if [[ "$INSTALL_DEPS" =~ ^[Yy]$ ]]; then
            if command -v uv &>/dev/null; then
                echo "  Running uv sync in $ACE_PATH ..."
                if (cd "$ACE_PATH" && uv sync); then
                    ok "ACE-Step Python dependencies installed."
                else
                    warn "uv sync failed. You can run it manually later."
                    WARNED_LIST="$WARNED_LIST\n  ACE-Step deps - uv sync failed"
                fi
            else
                warn "uv not found. Install uv first, then run:"
                echo "         cd $ACE_PATH && uv sync"
                WARNED_LIST="$WARNED_LIST\n  ACE-Step deps - install uv then run: uv sync"
            fi
        else
            skip "Skipping Python dependency install."
        fi
    else
        ok "ACE-Step Python environment found."
    fi
    echo "  NOTE: Model weights (~3GB) will download automatically on first run."
fi

echo ""

# --- Phase 4: Configuration --------------------------------------------------

echo "  [Phase 4] Configuration..."
echo "  ------------------------------------"
echo ""

# Create server/.env from template if needed
if [ -f "server/.env" ]; then
    skip "server/.env already exists (not overwriting)."
else
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        ok "Created server/.env from template."

        # Generate a random secret
        SECRET=""
        if command -v openssl &>/dev/null; then
            SECRET=$(openssl rand -hex 12)
        elif [ -f /dev/urandom ]; then
            SECRET=$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')
        fi

        # Replace placeholder in server/.env
        if [ -n "$SECRET" ]; then
            GENERATED_SECRET="$SECRET"
            if sed -i.bak "s/RADIO_OWNER_SECRET=your-secret-here/RADIO_OWNER_SECRET=$SECRET/" server/.env 2>/dev/null; then
                rm -f server/.env.bak
                ok "Generated RADIO_OWNER_SECRET in server/.env"
            elif sed -i '' "s/RADIO_OWNER_SECRET=your-secret-here/RADIO_OWNER_SECRET=$SECRET/" server/.env 2>/dev/null; then
                ok "Generated RADIO_OWNER_SECRET in server/.env"
            else
                warn "Could not auto-set secret. Edit server/.env manually."
            fi
        fi
    else
        warn "server/.env.example not found. Cannot create .env file."
        WARNED_LIST="$WARNED_LIST\n  server/.env - template missing"
    fi
fi

# Create root .env with RADIO_OWNER_SECRET (used by start scripts)
if [ -f ".env" ]; then
    skip "Root .env already exists."
else
    if [ -n "$GENERATED_SECRET" ]; then
        echo "RADIO_OWNER_SECRET=$GENERATED_SECRET" > .env
        ok "Created root .env with RADIO_OWNER_SECRET."
    else
        skip "Root .env not created (no new secret generated)."
    fi
fi

# Create required directories
if [ ! -d "server/data" ]; then
    mkdir -p server/data
    ok "Created server/data/"
else
    skip "server/data/ already exists."
fi

if [ ! -d "server/public/audio" ]; then
    mkdir -p server/public/audio
    ok "Created server/public/audio/"
else
    skip "server/public/audio/ already exists."
fi

echo ""

# --- Phase 5: Database Migration ----------------------------------------------

echo "  [Phase 5] Database migration..."
echo "  ------------------------------------"
echo ""

if (cd server && npx tsx src/db/migrate.ts); then
    ok "Database migrated successfully."
else
    warn "Database migration had issues (may be OK if tables exist)."
fi

echo ""

# --- Phase 6: Summary ---------------------------------------------------------

echo ""
echo "  ===================================="
echo "    Setup Complete!"
echo "  ===================================="
echo ""

if [ -n "$INSTALLED_LIST" ]; then
    echo "  Prerequisites:"
    echo -e "$INSTALLED_LIST"
    echo ""
fi

if [ -n "$WARNED_LIST" ]; then
    echo "  Warnings:"
    echo -e "$WARNED_LIST"
    echo ""
fi

if [ -n "$GENERATED_SECRET" ]; then
    echo "  Radio Owner Secret: $GENERATED_SECRET"
    echo "  (saved in server/.env and .env - use this to claim admin in the app)"
    echo ""
fi

if [ -n "$ACE_STEP_FOUND" ]; then
    echo "  ACE-Step: $ACE_STEP_FOUND"
else
    echo "  ACE-Step: Not installed (set ACESTEP_PATH or clone to models/ACE-Step-1.5)"
fi
echo ""

echo "  Next steps:"
echo "    1. Run ./start-all.sh to launch all services"
echo "    2. Open http://localhost:1869 in your browser"
echo "    3. Enter your owner secret in the app to claim admin"
echo ""
