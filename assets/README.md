# FXD Visualizer Assets

This directory contains icon and image assets for the FXD Quantum Desktop Visualizer.

## Required Icons

To build the installer, you need to provide the following icon files:

### icon.png
- Size: 512x512 pixels
- Format: PNG with transparency
- Used for: Windows file associations, app icon

### icon.ico
- Size: Multi-resolution (16, 32, 48, 64, 128, 256)
- Format: Windows ICO
- Used for: Installer, Windows executable icon

## Creating Icons

You can create these icons using any graphics software. Recommended designs:

1. **Quantum/Tech Theme**: Circuit patterns, neural networks, geometric shapes
2. **Color Scheme**: Blue (#64c8ff), Purple (#764ba2), Orange (#ff8800)
3. **Simple & Recognizable**: Should be clear even at 16x16 pixels

## Converting PNG to ICO

If you have a PNG, convert to ICO:

**Online Tools**:
- https://www.icoconverter.com/
- https://convertio.co/png-ico/

**Command Line**:
```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## Placeholder

If you don't have custom icons yet, you can use a simple placeholder:
- Create a 512x512 PNG with FXD logo or text
- Use online tools to convert to ICO

The build process will use these icons for:
- Windows Start Menu shortcuts
- Desktop shortcuts
- File associations (.fxd files)
- Installer graphics
- Application window icon
