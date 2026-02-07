#!/bin/bash
# RAIDIO Startup Script for Linux/macOS
# Starts Backend + Frontend

set -e

echo "=================================="
echo "  RAIDIO - AI Music Radio"
echo "=================================="
echo

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Error: Dependencies not installed!"
    echo "Run: npm install"
    exit 1
fi

if [ ! -d "server/node_modules" ]; then
    echo "Error: Server dependencies not installed!"
    echo "Run: cd server && npm install"
    exit 1
fi

echo "Make sure ACE-Step API is running:"
echo "  cd path/to/ACE-Step"
echo "  uv run acestep-api --port 39871"
echo

# Get local IP for LAN access
if command -v ip &> /dev/null; then
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "")
elif command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
fi

# Start backend in background
echo "Starting backend on port ${PORT:-3001}..."
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Start frontend
echo "Starting frontend on port 1869..."
npm run dev &
FRONTEND_PID=$!

echo
echo "=================================="
echo "  RAIDIO Running!"
echo "=================================="
echo
echo "  Frontend:   http://localhost:1869"
echo "  Backend:    http://localhost:${PORT:-3001}"
echo "  WebSocket:  ws://localhost:${PORT:-3001}/api/radio/ws"
echo
if [ -n "$LOCAL_IP" ]; then
    echo "  LAN Access: http://$LOCAL_IP:1869"
    echo
fi
echo "Press Ctrl+C to stop..."

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait
