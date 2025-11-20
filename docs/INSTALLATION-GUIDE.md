# FXD CLI - Complete Installation Guide

**Version:** 2.0.0
**Last Updated:** 2025-11-20
**Agent:** Agent 3 - CLI Excellence & System Integration

Complete installation instructions for FXD CLI on all platforms, including system integration, shell completions, and file associations.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Install](#quick-install)
- [Platform-Specific Installation](#platform-specific-installation)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
- [Building from Source](#building-from-source)
- [System Integration](#system-integration)
  - [PATH Configuration](#path-configuration)
  - [Shell Completions](#shell-completions)
  - [File Associations](#file-associations)
- [Verification](#verification)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### All Platforms

- **Deno 1.40+** (required for building from source)
- **Terminal/Command Prompt** access
- **10 MB** free disk space

### Platform-Specific

#### Windows
- Windows 10 or later
- PowerShell 5.1 or later
- Administrator access (recommended)

#### macOS
- macOS 10.13 (High Sierra) or later
- Terminal.app or compatible terminal
- Optional: Homebrew for package management

#### Linux
- Any modern Linux distribution
- Bash, Zsh, or Fish shell
- `update-mime-database` (for file associations)
- `gtk-update-icon-cache` (for icons, optional)

---

## Quick Install

The fastest way to install FXD CLI:

### One-Line Install (All Platforms)

```bash
deno run -A https://raw.githubusercontent.com/fxd/fxd/main/scripts/install.ts
```

This will:
1. Download and install the appropriate binary for your platform
2. Add FXD to your PATH
3. Set up shell completions
4. Configure file associations
5. Verify the installation

### Alternative: Clone and Install

```bash
# Clone repository
git clone https://github.com/fxd/fxd.git
cd fxd

# Build binaries
deno run -A scripts/build-cli.ts

# Install
deno run -A scripts/install.ts
```

---

## Platform-Specific Installation

### Windows

#### Method 1: Automated Installer (Recommended)

```powershell
# Run as Administrator (Right-click PowerShell → Run as Administrator)
deno run -A scripts/install.ts
```

**What it does:**
- Downloads `fxd-windows-x64.exe` → `%USERPROFILE%\AppData\Local\fxd\bin\fxd.exe`
- Adds `%USERPROFILE%\AppData\Local\fxd\bin` to user PATH
- Installs PowerShell completions to profile
- Creates registry entries for .fxd file association

#### Method 2: Manual Installation

```powershell
# 1. Create installation directory
New-Item -ItemType Directory -Path "$env:USERPROFILE\AppData\Local\fxd\bin" -Force

# 2. Download binary
Invoke-WebRequest -Uri "https://releases.fxd.dev/fxd-windows-x64.exe" -OutFile "$env:USERPROFILE\AppData\Local\fxd\bin\fxd.exe"

# 3. Add to PATH
$oldPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$newPath = $oldPath + ";$env:USERPROFILE\AppData\Local\fxd\bin"
[Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')

# 4. Restart terminal and verify
fxd version
```

#### File Associations (Windows)

```powershell
# Run as Administrator
deno run -A scripts/file-associations/windows-registry.ts

# Manual: Double-click the generated fxd-association.reg file
```

**Result:**
- .fxd files have custom icon
- Double-click opens with FXD
- Right-click menu: "Open with FXD", "Show Statistics", "Export"
- "New" menu: Create new .fxd file

#### Shell Completions (PowerShell)

```powershell
# Add to your PowerShell profile
notepad $PROFILE

# Add this line:
. C:\path\to\fxd\cli\completions\fxd.ps1

# Reload profile
. $PROFILE
```

---

### macOS

#### Method 1: Automated Installer (Recommended)

```bash
# For Intel Macs
deno run -A scripts/install.ts

# For Apple Silicon (M1/M2/M3)
deno run -A scripts/install.ts
```

The installer automatically detects your architecture.

**What it does:**
- Installs appropriate binary → `/usr/local/bin/fxd`
- Sets executable permissions
- Adds to PATH via `.zshrc`
- Installs Zsh completions
- Creates application bundle for file associations

#### Method 2: Manual Installation (Intel)

```bash
# 1. Download binary
curl -O https://releases.fxd.dev/fxd-macos-x64

# 2. Make executable
chmod +x fxd-macos-x64

# 3. Rename and move to PATH
sudo mv fxd-macos-x64 /usr/local/bin/fxd

# 4. Verify
fxd version
```

#### Method 3: Manual Installation (Apple Silicon)

```bash
# 1. Download binary
curl -O https://releases.fxd.dev/fxd-macos-arm64

# 2. Make executable
chmod +x fxd-macos-arm64

# 3. Rename and move to PATH
sudo mv fxd-macos-arm64 /usr/local/bin/fxd

# 4. Verify
fxd version
```

#### Method 4: Homebrew (Coming Soon)

```bash
brew tap fxd/fxd
brew install fxd
```

#### File Associations (macOS)

```bash
deno run -A scripts/file-associations/macos-plist.ts
```

**Result:**
- Creates `~/Applications/FXD.app`
- Registers UTI for .fxd files
- Enables double-click to open
- Finder integration

**Optional: Set as Default**

```bash
# Install duti (if not already installed)
brew install duti

# Set FXD as default for .fxd files
duti -s dev.fxd.cli .fxd all
```

#### Shell Completions (Zsh - macOS Default)

```bash
# 1. Create completions directory
mkdir -p ~/.zsh/completions

# 2. Copy completion file
cp cli/completions/fxd.zsh ~/.zsh/completions/_fxd

# 3. Add to .zshrc
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

# 4. Reload
source ~/.zshrc
```

#### Shell Completions (Bash - Optional)

```bash
# 1. Install bash-completion (if not installed)
brew install bash-completion

# 2. Copy completion file
cp cli/completions/fxd.bash /usr/local/etc/bash_completion.d/fxd

# 3. Add to .bash_profile
echo 'export BASH_COMPLETION_COMPAT_DIR="/usr/local/etc/bash_completion.d"' >> ~/.bash_profile
echo '[[ -r "/usr/local/etc/profile.d/bash_completion.sh" ]] && . "/usr/local/etc/profile.d/bash_completion.sh"' >> ~/.bash_profile

# 4. Reload
source ~/.bash_profile
```

---

### Linux

#### Method 1: Automated Installer (Recommended)

```bash
# For x86_64
deno run -A scripts/install.ts

# For ARM64
deno run -A scripts/install.ts
```

**What it does:**
- Installs binary → `/usr/local/bin/fxd`
- Sets executable permissions
- Adds to PATH via `.bashrc`
- Installs Bash completions
- Creates desktop file and MIME type

#### Method 2: Manual Installation (x86_64)

```bash
# 1. Download binary
curl -O https://releases.fxd.dev/fxd-linux-x64

# 2. Make executable
chmod +x fxd-linux-x64

# 3. Rename and move to PATH
sudo mv fxd-linux-x64 /usr/local/bin/fxd

# 4. Verify
fxd version
```

#### Method 3: Manual Installation (ARM64)

```bash
# 1. Download binary
curl -O https://releases.fxd.dev/fxd-linux-arm64

# 2. Make executable
chmod +x fxd-linux-arm64

# 3. Rename and move to PATH
sudo mv fxd-linux-arm64 /usr/local/bin/fxd

# 4. Verify
fxd version
```

#### Method 4: Package Managers (Coming Soon)

```bash
# Snap
sudo snap install fxd

# AppImage
chmod +x FXD-x86_64.AppImage
./FXD-x86_64.AppImage

# Flatpak
flatpak install fxd
```

#### File Associations (Linux)

```bash
deno run -A scripts/file-associations/linux-desktop.ts
```

**Result:**
- Creates `~/.local/share/applications/fxd.desktop`
- Registers MIME type `application/x-fxd`
- Enables file manager integration
- Optional: Installs icon

**Manual MIME Type Setup**

```bash
# Update MIME database
update-mime-database ~/.local/share/mime

# Update desktop database
update-desktop-database ~/.local/share/applications

# Set as default handler
xdg-mime default fxd.desktop application/x-fxd
```

#### Shell Completions (Bash)

```bash
# System-wide (requires sudo)
sudo cp cli/completions/fxd.bash /etc/bash_completion.d/fxd
source ~/.bashrc

# User-only
mkdir -p ~/.local/share/bash-completion/completions
cp cli/completions/fxd.bash ~/.local/share/bash-completion/completions/fxd
source ~/.bashrc
```

#### Shell Completions (Zsh)

```bash
# Create completions directory
mkdir -p ~/.zsh/completions

# Copy completion file
cp cli/completions/fxd.zsh ~/.zsh/completions/_fxd

# Add to .zshrc
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

# Reload
source ~/.zshrc
```

#### Shell Completions (Fish)

```bash
# Copy completion file
cp cli/completions/fxd.fish ~/.config/fish/completions/

# Reload (automatic in most cases)
```

---

## Building from Source

### Prerequisites for Building

```bash
# Check Deno version
deno --version  # Should be 1.40+

# Clone repository
git clone https://github.com/fxd/fxd.git
cd fxd
```

### Build All Platforms

```bash
# Build binaries for all platforms
deno run -A scripts/build-cli.ts

# Output will be in build/cli/binaries/
```

**Generated files:**
- `fxd-windows-x64.exe` (Windows 64-bit)
- `fxd-macos-x64` (macOS Intel)
- `fxd-macos-arm64` (macOS Apple Silicon)
- `fxd-linux-x64` (Linux 64-bit)
- `fxd-linux-arm64` (Linux ARM64)

### Build Single Platform

```bash
# Windows
deno compile --allow-all --target x86_64-pc-windows-msvc --output build/fxd cli/fxd-enhanced.ts

# macOS Intel
deno compile --allow-all --target x86_64-apple-darwin --output build/fxd cli/fxd-enhanced.ts

# macOS ARM
deno compile --allow-all --target aarch64-apple-darwin --output build/fxd cli/fxd-enhanced.ts

# Linux
deno compile --allow-all --target x86_64-unknown-linux-gnu --output build/fxd cli/fxd-enhanced.ts
```

### Install Local Build

```bash
# After building
deno run -A scripts/install.ts

# This will install the locally built binary
```

---

## System Integration

### PATH Configuration

#### Windows

```powershell
# Check current PATH
$env:PATH -split ';'

# Add directory permanently
$oldPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$newPath = $oldPath + ";C:\path\to\fxd\bin"
[Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')

# Verify (restart terminal first)
fxd version
```

#### macOS/Linux

```bash
# Check current PATH
echo $PATH | tr ':' '\n'

# Add to .bashrc or .zshrc
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
fxd version
```

### Shell Completions

See platform-specific sections above for detailed instructions.

**Testing Completions:**

```bash
# Type this and press TAB
fxd <TAB>

# Should show:
# help version health save load import export stats list create mount unmount

# Test file completion
fxd load <TAB>

# Should show .fxd files in current directory
```

### File Associations

See platform-specific sections above for detailed instructions.

**Testing File Associations:**

```bash
# Create test file
touch test.fxd

# Double-click test.fxd in file manager
# Should open with FXD CLI
```

---

## Verification

### Basic Verification

```bash
# Check installation
which fxd           # Should show path to fxd binary
fxd --version       # Should show version 2.0.0
fxd health          # Should show all systems operational
```

### Complete Verification

```bash
# Run full test suite
fxd health

# Test commands
fxd create test-project
fxd save test.fxd
fxd load test.fxd
fxd stats test.fxd
fxd list

# Test completions (if installed)
fxd <TAB>

# Test file associations (if installed)
# Double-click a .fxd file in file manager
```

### Verify Installation Script

```bash
# The installer includes verification
deno run -A scripts/install.ts

# Look for:
# ✅ Binary exists
# ✅ Binary executes successfully
# ✅ All systems operational
```

---

## Uninstallation

### Windows

```powershell
# 1. Remove binary
Remove-Item "$env:USERPROFILE\AppData\Local\fxd" -Recurse -Force

# 2. Remove from PATH
$oldPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$newPath = ($oldPath -split ';' | Where-Object { $_ -notlike '*fxd*' }) -join ';'
[Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')

# 3. Remove file associations (optional)
# Delete HKEY_CLASSES_ROOT\.fxd registry key

# 4. Remove completions
# Remove line from $PROFILE
```

### macOS/Linux

```bash
# 1. Remove binary
sudo rm /usr/local/bin/fxd

# 2. Remove from PATH
# Edit ~/.bashrc or ~/.zshrc and remove FXD PATH lines

# 3. Remove file associations
rm -rf ~/.local/share/applications/fxd.desktop  # Linux
rm -rf ~/Applications/FXD.app                    # macOS

# 4. Remove completions
rm -f ~/.zsh/completions/_fxd                    # Zsh
rm -f ~/.config/fish/completions/fxd.fish        # Fish
sudo rm -f /etc/bash_completion.d/fxd            # Bash

# 5. Remove configuration (optional)
rm -rf ~/.fxd
```

---

## Troubleshooting

### Common Issues

#### "fxd: command not found"

**Solution:**
```bash
# Check if binary exists
ls -l /usr/local/bin/fxd  # macOS/Linux
ls "$env:USERPROFILE\AppData\Local\fxd\bin\fxd.exe"  # Windows

# If exists, PATH issue:
echo $PATH  # macOS/Linux
echo $env:PATH  # Windows

# Reinstall:
deno run -A scripts/install.ts
```

#### "Permission denied"

**macOS/Linux Solution:**
```bash
# Make binary executable
chmod +x /usr/local/bin/fxd

# Or use sudo
sudo deno run -A scripts/install.ts
```

**Windows Solution:**
```powershell
# Run as Administrator
# Right-click PowerShell → Run as Administrator
deno run -A scripts/install.ts
```

#### "Deno not found"

**Solution:**
```bash
# Install Deno first
# macOS/Linux:
curl -fsSL https://deno.land/install.sh | sh

# Windows:
irm https://deno.land/install.ps1 | iex

# Verify:
deno --version
```

#### Completions Don't Work

**Solution:**
```bash
# Reload shell configuration
source ~/.bashrc    # Bash
source ~/.zshrc     # Zsh

# Or restart terminal

# Verify completion file exists
ls -l ~/.zsh/completions/_fxd           # Zsh
ls -l /etc/bash_completion.d/fxd       # Bash
ls -l ~/.config/fish/completions/fxd.fish  # Fish

# Reinstall if missing
deno run -A scripts/install.ts
```

#### File Associations Don't Work

**Windows:**
```powershell
# Rerun registry script as Administrator
deno run -A scripts/file-associations/windows-registry.ts

# Restart Windows Explorer
taskkill /F /IM explorer.exe
start explorer.exe
```

**Linux:**
```bash
# Update databases
update-mime-database ~/.local/share/mime
update-desktop-database ~/.local/share/applications

# Set default handler
xdg-mime default fxd.desktop application/x-fxd

# Test
xdg-mime query default application/x-fxd
```

**macOS:**
```bash
# Rerun plist script
deno run -A scripts/file-associations/macos-plist.ts

# Register app bundle
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f ~/Applications/FXD.app

# Log out and back in
```

#### Build Failures

**Solution:**
```bash
# Check Deno version (must be 1.40+)
deno --version

# Update Deno
deno upgrade

# Clear cache
deno cache --reload cli/fxd-enhanced.ts

# Rebuild
deno run -A scripts/build-cli.ts
```

---

## Advanced Configuration

### Custom Installation Directory

```bash
# Set custom directory
export FXD_INSTALL_DIR="$HOME/custom/path"
deno run -A scripts/install.ts
```

### Proxy Configuration

```bash
# Set proxy for downloads
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080

# Install
deno run -A scripts/install.ts
```

### Offline Installation

```bash
# 1. On machine with internet, build and package
deno run -A scripts/build-cli.ts
tar -czf fxd-binaries.tar.gz build/

# 2. Transfer fxd-binaries.tar.gz to offline machine

# 3. Extract and install
tar -xzf fxd-binaries.tar.gz
deno run -A scripts/install.ts
```

### Multi-User Installation (Linux/macOS)

```bash
# Install to system-wide directory
sudo deno run -A scripts/install.ts

# Make available to all users
sudo chmod +x /usr/local/bin/fxd

# Install completions system-wide
sudo cp cli/completions/fxd.bash /etc/bash_completion.d/fxd
```

---

## Next Steps

After installation:

1. **Read the documentation:**
   - [CLI Reference](CLI-REFERENCE.md)
   - [Getting Started](GETTING-STARTED-COMPLETE.md)
   - [User Guide](USER-GUIDE.md)

2. **Try basic commands:**
   ```bash
   fxd help
   fxd create my-first-project
   fxd health
   ```

3. **Set up your workflow:**
   - Configure file associations
   - Set up shell completions
   - Create your first .fxd project

4. **Join the community:**
   - GitHub Discussions
   - Issue Tracker
   - Discord Server (coming soon)

---

## Support

- **Documentation:** [docs/](.)
- **Issues:** https://github.com/fxd/fxd/issues
- **Discussions:** https://github.com/fxd/fxd/discussions

---

**Installation Guide v2.0.0**
**Maintained by:** Agent 3 - CLI Excellence & System Integration
**Last Updated:** 2025-11-20
