push pls
@echo off
REM Music Visualizer - Local Server Start Script (Windows)
REM Runs a simple HTTP server to serve the visualizer

cd /d "%~dp0"

echo ========================================
echo Music Visualizer - Local Server Startup
echo ========================================
echo.

REM Try Python 3
python --version >nul 2>&1
if errorlevel 0 (
    echo Starting server with Python 3...
    echo Open http://localhost:8000 in your browser
    echo Press Ctrl+C to stop the server
    echo.
    python -m http.server 8000
    exit /b 0
)

REM Try Node.js http-server
where /q npx
if %errorlevel% equ 0 (
    echo Starting server with npx http-server...
    echo Open http://localhost:8080 in your browser
    echo Press Ctrl+C to stop the server
    echo.
    npx http-server
    exit /b 0
)

REM Try Node.js built-in http module (as fallback)
where /q node
if %errorlevel% equ 0 (
    echo Starting server with Node.js...
    echo Open http://localhost:8000 in your browser
    echo Press Ctrl+C to stop the server
    echo.
    node -e "const http = require('http'); const fs = require('fs'); const path = require('path'); const server = http.createServer((req, res) => { let url = req.url === '/' ? 'index.html' : req.url.substring(1); let filePath = path.join(process.cwd(), url); try { const content = fs.readFileSync(filePath); const ext = path.extname(url); const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' }; res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain'); res.end(content); } catch(e) { res.writeHead(404); res.end('Not found'); } }); server.listen(8000, () => console.log('Server running at http://localhost:8000')); "
    exit /b 0
)

echo Error: No server found!
echo Please install Python 3 or Node.js
echo.
echo Python 3: https://www.python.org/downloads/
echo Node.js: https://nodejs.org/
pause

