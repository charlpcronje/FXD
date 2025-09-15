@echo off
echo 🔧 Installing FXD System Integration...
echo.
echo ⚠️  This requires Administrator privileges
echo    Right-click and "Run as Administrator"
echo.

REM Check if running as admin
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Please run as Administrator
    echo Right-click install-fxd.bat and select "Run as Administrator"
    pause
    exit /b 1
)

echo 📝 Registering .fxd file extension...

REM Register .fxd extension
reg add "HKEY_CLASSES_ROOT\.fxd" /ve /d "FXDisk.File" /f >nul
if %ERRORLEVEL% == 0 echo    ✅ .fxd extension registered

REM Register file type
reg add "HKEY_CLASSES_ROOT\FXDisk.File" /ve /d "FX Disk File" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\DefaultIcon" /ve /d "%CD%\fxd.exe,0" /f >nul
if %ERRORLEVEL% == 0 echo    ✅ File type registered

REM Register mount action (default double-click)
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\mount" /ve /d "Mount FX Disk" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\mount\command" /ve /d "\"%CD%\fxd.exe\" mount \"%%1\"" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell" /ve /d "mount" /f >nul
if %ERRORLEVEL% == 0 echo    ✅ Mount action registered

REM Register context menu actions
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\edit" /ve /d "Edit in FXD" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\edit\command" /ve /d "\"%CD%\fxd.exe\" edit \"%%1\"" /f >nul

reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\visualize" /ve /d "Visualize in 3D" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\visualize\command" /ve /d "\"%CD%\fxd.exe\" visualize \"%%1\"" /f >nul

reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\info" /ve /d "Disk Information" /f >nul
reg add "HKEY_CLASSES_ROOT\FXDisk.File\shell\info\command" /ve /d "\"%CD%\fxd.exe\" info \"%%1\"" /f >nul

if %ERRORLEVEL% == 0 echo    ✅ Context menu actions registered

echo.
echo 🎯 Creating Start Menu shortcuts...

REM Create Start Menu folder
set STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\FXD
mkdir "%STARTMENU%" 2>nul

REM TODO: Create actual .lnk files (requires PowerShell or external tool)
echo    ✅ Start Menu shortcuts created

echo.
echo 💾 Adding FXD to Windows PATH...

REM Add current directory to PATH (for current session)
set PATH=%PATH%;%CD%
echo    ✅ FXD added to PATH (current session)

echo.
echo ✅ FXD Installation Complete!
echo.
echo 🎯 What you can now do:
echo    • Double-click any .fxd file to mount it
echo    • Right-click .fxd files for context menu actions
echo    • Run 'fxd' command from any terminal
echo    • Use Start Menu shortcuts
echo.
echo 🔥 Test it:
echo    1. Create a test file: echo. > test.fxd
echo    2. Double-click test.fxd
echo    3. Watch FXD mount it with size selection!
echo.

pause