@echo off
echo ========================================
echo FXD Quantum Desktop Visualizer
echo Quick Start Script
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found:
node --version
echo.

echo Checking if dependencies are installed...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo.
echo ========================================
echo What would you like to do?
echo ========================================
echo 1. Run in development mode (test locally)
echo 2. Build Windows installer
echo 3. View user guide
echo 4. Exit
echo.

set /p choice=Enter your choice (1-4):

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build
if "%choice%"=="3" goto docs
if "%choice%"=="4" goto end

:dev
echo.
echo Starting FXD Visualizer in development mode...
echo Press Ctrl+C to stop
echo.
call npm start
goto end

:build
echo.
echo Building Windows installer...
echo This may take a few minutes...
echo.
call npm run build
echo.
echo ========================================
echo Build complete!
echo ========================================
echo Installer location: build\FXD-Quantum-Visualizer-Setup-1.0.0.exe
echo.
echo You can now:
echo 1. Test the installer locally
echo 2. Distribute the .exe file
echo.
pause
goto end

:docs
echo.
echo Opening user guide...
start docs\USER-GUIDE.md
goto end

:end
echo.
echo Thank you for using FXD Quantum Visualizer!
pause
