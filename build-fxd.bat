@echo off
echo 🔨 Building FXD Standalone Executable...
echo.

echo 📦 Compiling FXD with Deno...
deno compile --allow-all --output fxd.exe --target x86_64-pc-windows-msvc fxd-standalone.ts

if %ERRORLEVEL% == 0 (
    echo.
    echo ✅ FXD compiled successfully!
    echo 📁 Output: fxd.exe
    echo.
    echo 🎯 Next steps:
    echo    1. fxd.exe install     ^(Install system integration^)
    echo    2. fxd.exe compile     ^(Verify compilation^)
    echo    3. Double-click .fxd files to mount them!
    echo.
    echo 💡 The compiled fxd.exe contains:
    echo    • Full FXD runtime
    echo    • Web server and APIs
    echo    • 3D visualizer
    echo    • Terminal integration
    echo    • File association handlers
    echo.
) else (
    echo.
    echo ❌ Compilation failed!
    echo 💡 Make sure Deno is installed and try again
    echo.
)

pause