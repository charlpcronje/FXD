# FXD Quantum Visualizer - Build Instructions

Complete guide to building and distributing the FXD Quantum Desktop Visualizer.

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from https://nodejs.org/
   - Verify: `node --version`

2. **npm** (comes with Node.js)
   - Verify: `npm --version`

3. **Git** (optional, for version control)
   - Download from https://git-scm.com/

### Required for Windows Build

- **Windows 10/11**
- **Visual Studio Build Tools** (for native modules)
- **7-Zip** or **WinRAR** (installed automatically by electron-builder)

---

## Initial Setup

### 1. Install Dependencies

```bash
cd C:\dev\fxd
npm install
```

This installs:
- Electron (app framework)
- Electron Builder (packaging tool)
- Three.js (3D rendering, loaded from CDN)
- Other dependencies

### 2. Prepare Icons

Create or obtain icon files and place in `assets/`:
- `icon.png` (512x512 PNG)
- `icon.ico` (Multi-size ICO)

See `assets/README.md` for details.

---

## Development Mode

### Running Locally

```bash
npm start
```

This launches the visualizer in development mode:
- Enables debugging
- Hot reload (manual)
- Console logging

### Development with Logging

```bash
npm run dev
```

Enables verbose logging for troubleshooting.

### Testing

```bash
# Open a .fxd file
1. Launch app: npm start
2. File → Open (Ctrl+O)
3. Navigate to examples/comprehensive-demo.fxd
4. Click Open

# Or drag & drop
1. Launch app
2. Drag examples/comprehensive-demo.fxd into window
```

---

## Building Installer

### Windows Installer (Recommended)

```bash
npm run build
```

This creates:
- `build/FXD-Quantum-Visualizer-Setup-1.0.0.exe` (installer)
- `build/win-unpacked/` (unpacked app files)

### Build Process

The build script:
1. Compiles Electron app
2. Packages with electron-builder
3. Creates NSIS installer
4. Registers .fxd file association
5. Creates Start Menu shortcuts
6. Creates desktop shortcut (optional)

### Build All Platforms

```bash
npm run build:all
```

Creates installers for:
- Windows (NSIS .exe)
- macOS (DMG, coming soon)
- Linux (AppImage, coming soon)

---

## Build Configuration

### package.json

The `build` section controls packaging:

```json
{
  "build": {
    "appId": "com.fxd.visualizer",
    "productName": "FXD Quantum Visualizer",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.png",
      "fileAssociations": [{
        "ext": "fxd",
        "name": "FXD File",
        "role": "Editor"
      }]
    }
  }
}
```

### installer.nsh

Custom NSIS script for file associations:
- Registers .fxd extension
- Sets default icon
- Adds to "Open with" menu
- Refreshes Windows icon cache

---

## File Association

### How It Works

When user installs:
1. NSIS installer runs
2. Executes `installer.nsh` custom script
3. Writes registry keys for .fxd association
4. Sets FXD Visualizer as default handler
5. Refreshes Windows shell

### Testing File Association

After installing:
```bash
1. Navigate to examples/ folder
2. Double-click comprehensive-demo.fxd
3. Should open in FXD Visualizer
```

If doesn't work:
- Right-click .fxd file
- Open with → Choose another app
- Select FXD Visualizer
- Check "Always use this app"

---

## Build Output

### Directory Structure

```
build/
├── FXD-Quantum-Visualizer-Setup-1.0.0.exe   # Installer
├── win-unpacked/                            # Unpacked app
│   ├── FXD Quantum Visualizer.exe
│   ├── resources/
│   └── ...
└── builder-effective-config.yaml            # Build config
```

### Installer Details

- **Size**: ~150-200 MB (includes Electron runtime)
- **Install location**: `C:\Program Files\FXD Quantum Visualizer\`
- **Shortcuts**: Start Menu, Desktop (optional)
- **Uninstaller**: Control Panel → Programs

---

## Distribution

### Preparing for Release

1. **Test thoroughly**:
   ```bash
   npm start  # Development mode
   # Test all features
   ```

2. **Update version**:
   ```json
   // package.json
   "version": "1.0.0"  // Increment as needed
   ```

3. **Build installer**:
   ```bash
   npm run build
   ```

4. **Test installer**:
   - Install on clean Windows VM
   - Test file association
   - Test all features
   - Test uninstall

5. **Create release notes**:
   - Document new features
   - List bug fixes
   - Include screenshots

### Release Checklist

- [ ] All tests passing
- [ ] Version incremented
- [ ] Icons present and correct
- [ ] Build completes without errors
- [ ] Installer tested on clean system
- [ ] File association works
- [ ] Uninstaller works
- [ ] Release notes written
- [ ] Documentation updated

---

## Common Build Issues

### Issue: electron-builder not found

```bash
npm install --save-dev electron-builder
```

### Issue: Icon errors

- Ensure `assets/icon.png` exists
- Ensure `assets/icon.ico` exists
- Check file paths in package.json

### Issue: NSIS errors

- Ensure `installer.nsh` exists
- Check syntax (no comments after commands)
- Verify registry key format

### Issue: Build hangs

- Check antivirus (may block NSIS)
- Close other apps
- Clear build cache: `rm -rf build/`

### Issue: File association doesn't work

- Run installer as Administrator
- Check registry:
  ```
  HKEY_CLASSES_ROOT\.fxd
  HKEY_CLASSES_ROOT\FXDFile
  ```
- Refresh icon cache or reboot

---

## Advanced Configuration

### Custom Build Targets

Edit `package.json`:

```json
"build": {
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64", "ia32"] },
      { "target": "portable" },
      { "target": "zip" }
    ]
  }
}
```

### Code Signing (Optional)

For production releases:

```json
"build": {
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "your-password"
  }
}
```

Note: Code signing requires certificate from trusted CA.

### Auto-Update (Future)

electron-builder supports auto-update:
- Requires update server
- Uses Squirrel.Windows
- See electron-builder docs

---

## Deployment

### Hosting Installer

Upload `build/FXD-Quantum-Visualizer-Setup-1.0.0.exe` to:
- GitHub Releases
- Your website download page
- Cloud storage (Dropbox, Google Drive)

### Download Links

Provide:
- Direct download link
- SHA256 checksum (for verification)
- Release notes
- System requirements

### System Requirements

Include in release notes:
- Windows 10/11 (64-bit)
- 4 GB RAM minimum
- GPU with OpenGL 3.0+ support
- 500 MB disk space

---

## Continuous Integration (CI)

### GitHub Actions Example

```yaml
name: Build
on: [push, pull_request]
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v2
        with:
          name: installer
          path: build/*.exe
```

---

## Support

For build issues:
- Check electron-builder docs: https://www.electron.build/
- GitHub issues: https://github.com/fxd-project/visualizer
- Discord: FXD Community

---

**Ready to build? Run `npm run build` and distribute your installer!** 🚀
