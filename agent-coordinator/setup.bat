@echo off
REM FXD Agent Coordinator Setup
REM Sets up symlinks and directory structure

echo ====================================
echo FXD Agent Coordinator Setup
echo ====================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges
    echo Please run as Administrator
    pause
    exit /b 1
)

REM Create directories
echo Creating directories...
if not exist "%CD%\contexts" mkdir "%CD%\contexts"
if not exist "%CD%\backups" mkdir "%CD%\backups"
echo   - contexts/
echo   - backups/
echo.

REM Create symlink to Claude project contexts
echo Creating symlink to Claude project contexts...
set CLAUDE_PROJECT=C:\Users\%USERNAME%\.claude\projects\C--dev-fxd

if exist "%CLAUDE_PROJECT%" (
    REM Remove existing mem directory if it's not a symlink
    if exist "%CD%\mem" (
        echo   - Removing existing mem directory...
        rmdir /s /q "%CD%\mem" 2>nul
        del /f /q "%CD%\mem" 2>nul
    )

    REM Create symlink
    mklink /D "%CD%\mem" "%CLAUDE_PROJECT%"

    if %errorLevel% equ 0 (
        echo   - SUCCESS: Symlink created
        echo   - From: %CD%\mem
        echo   - To:   %CLAUDE_PROJECT%
    ) else (
        echo   - ERROR: Failed to create symlink
        echo   - Check administrator privileges
        exit /b 1
    )
) else (
    echo   - WARNING: Claude project directory not found
    echo   - Expected: %CLAUDE_PROJECT%
    echo   - The symlink will be created when the directory exists
)
echo.

REM Create empty annotations file
echo Creating annotations.json...
if not exist "%CD%\annotations.json" (
    echo {} > "%CD%\annotations.json"
    echo   - Created annotations.json
) else (
    echo   - annotations.json already exists
)
echo.

REM Test Python
echo Checking Python installation...
python --version >nul 2>&1
if %errorLevel% equ 0 (
    python --version
    echo   - Python is installed
) else (
    echo   - WARNING: Python not found
    echo   - Install Python 3.7+ to run context manager
)
echo.

REM Create quick launch scripts
echo Creating launch scripts...

REM Daemon launcher
echo @echo off > start-daemon.bat
echo echo Starting FXD Context Manager Daemon... >> start-daemon.bat
echo python agent-context-manager.py daemon >> start-daemon.bat
echo   - Created start-daemon.bat

REM Status checker
echo @echo off > check-status.bat
echo python agent-context-manager.py status >> check-status.bat
echo   - Created check-status.bat

REM Scanner
echo @echo off > scan-annotations.bat
echo python agent-context-manager.py scan >> scan-annotations.bat
echo   - Created scan-annotations.bat

echo.
echo ====================================
echo Setup Complete!
echo ====================================
echo.
echo Directory Structure:
echo   %CD%\contexts\         - Agent contexts
echo   %CD%\backups\          - Context backups
echo   %CD%\mem\              - Symlink to Claude contexts
echo   %CD%\annotations.json  - Code annotations index
echo.
echo Quick Launch:
echo   start-daemon.bat      - Start context manager
echo   check-status.bat      - Check agent status
echo   scan-annotations.bat  - Scan for annotations
echo.
echo Next Steps:
echo   1. Review: launch-agents.md
echo   2. Start daemon: start-daemon.bat
echo   3. Launch agents in Claude Code
echo.
pause
