@echo off
echo Starting FX Server...
echo.

REM Build fx.ts to fx.js first
echo Building fx.ts...
deno task build
echo.

REM Get the port (default 8787)
set PORT=8787
if defined PORT_ENV set PORT=%PORT_ENV%

echo Checking for existing server on port %PORT%...

REM Find and kill any process using the port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    echo Found process %%a using port %PORT%, killing it...
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting server on port %PORT%...
deno task dev
