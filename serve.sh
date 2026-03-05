#!/usr/bin/env bash
# Music Visualizer - Local Server Start Script
# Runs a simple HTTP server to serve the visualizer

# Try Python 3 first
if command -v python3 &> /dev/null; then
    echo "Starting server with Python 3..."
    echo "Open http://localhost:8000 in your browser"
    python3 -m http.server 8000
# Fallback to Python 2
elif command -v python &> /dev/null; then
    echo "Starting server with Python 2..."
    echo "Open http://localhost:8000 in your browser"
    python -m SimpleHTTPServer 8000
# Try Node.js http-server
elif command -v npx &> /dev/null; then
    echo "Starting server with npx http-server..."
    echo "Open http://localhost:8080 in your browser"
    npx http-server
else
    echo "No server found. Please install Python or Node.js"
    exit 1
fi

