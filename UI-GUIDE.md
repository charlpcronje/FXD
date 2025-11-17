# FXD User Interfaces & Visualizers

## 🚀 Quick Start

1. **Start the server**: `deno task serve` or `deno task demo`
2. **Open your browser**: http://localhost:4500
3. **Access any UI below** by appending the path to the URL

---

## 🎨 Available UIs

### 1. **Simple Interactive Demo**
**Path**: `/demo.html`
**URL**: http://localhost:4500/demo.html

**Features**:
- Create FX nodes with CSS selectors
- Real-time stats dashboard
- Add users dynamically
- View node tree structure
- Beautiful gradient interface

**Controls**:
- 🎬 Initialize Demo
- ➕ Add User
- 🔄 Refresh
- 🌳 Show Tree

---

### 2. **3D Visualizer with Version Control**
**Path**: `/public/visualizer-demo.html`
**URL**: http://localhost:4500/public/visualizer-demo.html

**Features**:
- Full 3D visualization using Three.js
- Interactive node graph with OrbitControls
- Version timeline and history
- Branch visualization
- Time travel through versions
- CSS2D labels for nodes

**Powered By**:
- `modules/fx-visualizer-3d.ts`
- `modules/fx-versioned-nodes.ts`
- `plugins/web/fx-time-travel.ts`

---

### 3. **FXD Quantum Desktop**
**Path**: `/public/fxd-quantum-desktop.html`
**URL**: http://localhost:4500/public/fxd-quantum-desktop.html

Full quantum development environment interface

---

### 4. **FXD Working App**
**Path**: `/public/fxd-working-app.html`
**URL**: http://localhost:4500/public/fxd-working-app.html

Production-ready FXD application interface

---

### 5. **FXD Main App**
**Path**: `/public/fxd-app.html`
**URL**: http://localhost:4500/public/fxd-app.html

Main FXD application interface

---

### 6. **Index/Landing Page**
**Path**: `/public/index.html`
**URL**: http://localhost:4500/public/index.html

Landing page with navigation to all UIs

---

## 🔧 Key Modules

### Core Functionality
- **fx-app.ts** - Central application orchestrator
- **fx-config.ts** - Configuration management
- **fx-events.ts** - Event bus system
- **fx-plugins.ts** - Plugin lifecycle management

### Visualization
- **fx-visualizer-3d.ts** - 3D node visualization with Three.js
- **fx-live-visualizer.ts** - Real-time visualization
- **fx-terminal-map.ts** - Terminal-based visualization

### Version Control & History
- **fx-versioned-nodes.ts** - Node versioning system
- **fx-node-history.ts** - Historical tracking
- **fx-git-scanner.ts** - Git integration

### Persistence & Storage
- **fx-persistence.ts** - Core persistence layer
- **fx-persistence-integration.ts** - SQLite integration
- **fx-snippet-persistence.ts** - Snippet storage
- **fx-view-persistence.ts** - View persistence
- **fx-backup-restore.ts** - Backup/restore functionality
- **fx-incremental-save.ts** - Incremental saves

### Code Management
- **fx-snippet-manager.ts** - Snippet CRUD operations
- **fx-snippets.ts** - Snippet core
- **fx-view.ts** - File view composition
- **fx-scan.ts** - Codebase scanning
- **fx-scan-core.ts** - Scan engine
- **fx-scan-ingest.ts** - Code ingestion
- **fx-parse.ts** - Code parsing

### Collaboration & Editing
- **fx-consciousness-editor.ts** - Advanced editor
- **fx-collaboration.ts** - Multi-user support
- **fx-websocket-transport.ts** - Real-time sync

### Export & Integration
- **fx-export.ts** - Export functionality
- **fx-import.ts** - Import functionality
- **fx-pdf-composer.ts** - PDF generation
- **fx-vscode-integration.ts** - VS Code integration
- **fx-file-association.ts** - File type handlers

### System & Performance
- **fx-commander.ts** - Command execution
- **fx-terminal-server.ts** - Terminal server
- **fx-ramdisk.ts** - In-memory filesystem
- **fx-vfs-manager.ts** - Virtual filesystem
- **fx-memory-leak-detection.ts** - Leak detection
- **fx-performance-monitoring.ts** - Performance metrics
- **fx-rate-limiting.ts** - Rate limiting

### Security & Stability
- **fx-security-hardening.ts** - Security features
- **fx-auth.ts** - Authentication
- **fx-data-integrity.ts** - Data validation
- **fx-production-stability.ts** - Stability monitoring
- **fx-error-handling.ts** - Error management
- **fx-recovery-system.ts** - Crash recovery
- **fx-transaction-system.ts** - ACID transactions

### Analytics & Telemetry
- **fx-telemetry-analytics.ts** - Usage analytics
- **fx-diagnostic-tools.ts** - Diagnostics

### Other
- **fx-project.ts** - Project management
- **fx-metadata-persistence.ts** - Metadata storage
- **fx-migration-system.ts** - Schema migrations
- **fx-group-extras.ts** - Advanced group operations
- **fx-node-serializer.ts** - Serialization

---

## 📖 API Usage

### Browser (via bundled fx.js)

```javascript
// Get the FX API
const { $$, fx, $val, $set, $get } = FX;

// Create nodes
$$('users.alice').val({ name: 'Alice', role: 'admin' });

// CSS selectors
const developers = $$('users').select('[role=developer]');

// Reactive groups
const team = $$('').group().select('[role=developer]').reactive(true);
team.on('change', () => console.log('Team changed!'));
```

### Server (TypeScript/Deno)

```typescript
import { $$, fx } from "./fxn.ts";

// Same API as browser
$$('data.users.bob').val({ name: 'Bob' });
const activeUsers = $$('data.users').select('[active=true]');
```

---

## 🎯 Running Different UIs

```bash
# Build and serve all UIs
deno task demo

# Just build fx.js
deno task build

# Development mode
deno task dev

# Custom port
PORT=8080 deno task serve
```

---

## 📊 Current Status

- ✅ **Core Runtime**: Complete
- ✅ **CSS Selectors**: Complete
- ✅ **Reactive Groups**: Complete
- ✅ **SQLite Persistence**: Complete
- ✅ **3D Visualizer**: Complete
- ✅ **Version Control**: Complete
- ✅ **Multi-UI System**: Complete
- ✅ **Production Ready**: 82% (Silver Certification)

---

## 🖥️ FXD.EXE - Standalone CLI Tool

**File**: `fxd.exe` (83MB compiled executable from `cli/fxd.ts`)

### What it does:
- **Visual Code Management Platform** - Complete FXD system in a single executable
- **Mount .fxd files** - Click any .fxd file to mount it as a virtual drive
- **System integration** - Install file associations and handlers
- **Full CLI** - Create, import, export, run snippets

### Key Commands:

```bash
# Disk Management
fxd mount project.fxd          # Mount with GUI dialog
fxd unmount D:                 # Unmount drive
fxd list-drives                # Show all mounted drives

# Development
fxd create my-project          # Create new .fxd disk
fxd import ./src               # Import existing code
fxd run greeting               # Execute snippet by ID
fxd list                       # List disk contents
fxd export ./output            # Export all contents

# System
fxd install                    # Install .fxd file associations
fxd compile                    # Recompile fxd.exe
fxd server --port=3000         # Start FXD web server
```

### How to compile:
```bash
deno compile --allow-all --output=fxd.exe cli/fxd.ts
```

### Web UIs served by fxd.exe:
- **Main App**: http://localhost:3000/app
- **Visualizer**: http://localhost:8080
- **Full CLI**: Terminal interface

---

## 🔍 Troubleshooting

### "Add User" button not working
- **Fixed**: Rebuild with `deno task build`
- The fix exports `$$` properly from `fx.js`

### Port already in use
- Kill existing servers: `Ctrl+C` in terminals
- Or use different port: `PORT=8080 deno task serve`

### Module not found errors
- Run: `deno task build` to regenerate fx.js
- Check imports in HTML files reference correct paths

---

**Last Updated**: 2025-10-02
**Version**: 1.0.0 (Production Candidate)
