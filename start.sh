#!/bin/bash
echo "╔══════════════════════════════╗"
echo "║      ALPHA■DESK STARTING     ║"
echo "╚══════════════════════════════╝"
echo ""
echo "Starting backend on port 3001..."
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo ""
echo "✓ Server running at http://localhost:3001"
echo "✓ WebSocket at ws://localhost:3001"
echo ""
echo "Open frontend/index.html in your browser"
echo ""
echo "Press Ctrl+C to stop"
wait $BACKEND_PID
