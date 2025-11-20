# FXD Visualizer - Quick Start Guide

Get the FXD Visualizer up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A modern browser (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+)

## Installation

### Step 1: Install Dependencies

```bash
cd visualizer-app
npm install
```

### Step 2: Install SQLite Support (Choose One)

**Option A: sql.js (JavaScript SQLite)**
```bash
npm install sql.js
```

**Option B: better-sqlite3-wasm (WebAssembly SQLite, faster)**
```bash
npm install better-sqlite3-wasm
```

## Running the Visualizer

### Start Development Server

```bash
npm run dev
```

The visualizer will be available at [http://localhost:5173](http://localhost:5173)

## First Steps

### 1. Open Disk Manager

Press `Ctrl+Shift+D` or click the disk icon in the bottom-left corner.

### 2. Load an Example FXD File

The project includes several example `.fxd` files:
- `examples/demo-final.fxd` - Final demo with 15 nodes
- `examples/comprehensive-demo.fxd` - Comprehensive example with 23 nodes
- `examples/code-project.fxd` - Code project structure with 8 nodes

Click "Load" next to any file to visualize it.

### 3. Explore the 3D Graph

- **Rotate**: Left mouse drag
- **Pan**: Right mouse drag or Shift + left drag
- **Zoom**: Mouse wheel
- **Select Node**: Left click
- **Multi-Select**: Shift + left click

### 4. Inspect Nodes

Click a node to select it, then press `Ctrl+Shift+I` to open the Inspector panel.

You'll see:
- Node ID and type
- Current value
- Metadata
- Prototypes
- Effects and watchers

### 5. Bind Nodes (Optional)

To create a binding between two nodes:

1. Select two nodes (Shift + click on each)
2. Press `Ctrl+Shift+B` to open Node Binder
3. Choose binding type:
   - **One-Way**: Source updates target
   - **Two-Way**: Bidirectional sync
   - **Transform**: Apply a function
4. Configure options (atomics, debounce, throttle)
5. Click "Bind Nodes"

## Keyboard Shortcuts

### Essential Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Toggle Disk Manager |
| `Ctrl+Shift+B` | Toggle Node Binder |
| `Ctrl+Shift+I` | Toggle Inspector |
| `Ctrl+Shift+C` | Toggle Console |
| `Ctrl+Shift+P` | Toggle Performance Metrics |
| `F` | Focus on selected node |
| `A` | Fit all nodes in view |
| `Space` | Play/Pause timeline |
| `1-9` | Camera presets |

### Navigation

| Shortcut | Action |
|----------|--------|
| Arrow keys | Move selected node |
| Shift + Arrow | Move camera |
| Ctrl + Scroll | Zoom |
| Mouse drag | Rotate camera |
| Right click drag | Pan camera |

### Selection

| Shortcut | Action |
|----------|--------|
| Click | Select node |
| Shift + Click | Add to selection |
| Ctrl + A | Select all |
| Esc | Clear selection |

## Understanding the UI

### Main Canvas (Center)

The 3D canvas shows your node graph with:
- **Nodes** as colored spheres/boxes
- **Connections** as golden lines
- **Layers** spread across Z-axis (depth)

Node colors indicate type:
- **Green**: String data
- **Blue**: Number data
- **Orange**: Boolean data
- **Purple**: Object data
- **Pink**: Array data
- **Cyan**: Function data

### Disk Manager (Left Sidebar)

Manage `.fxd` files:
- View all available files
- See file statistics (nodes, size, modified date)
- Load/unload disks
- Create new FXD files

### Node Binder (Right Sidebar)

Create bindings between nodes:
- Select source and target
- Choose binding type
- Configure transforms
- Enable atomics (SharedArrayBuffer)
- Set debounce/throttle

### Inspector (Right Sidebar)

Deep dive into node data:
- View raw node structure
- See current value
- Inspect metadata
- View prototype chain
- Monitor effects and watchers

### Performance Metrics (Overlay)

Real-time performance data:
- FPS (frames per second)
- Node count
- Connection count
- Update rate
- Memory usage

## Common Tasks

### Task 1: Load a FXD File from Disk

```typescript
// In browser console or code:
import initSqlJs from 'sql.js';

// Initialize SQL.js
const SQL = await initSqlJs({
  locateFile: file => `https://sql.js.org/dist/${file}`
});

// Load file (requires File System Access API)
const [handle] = await window.showOpenFilePicker({
  types: [{
    description: 'FXD Files',
    accept: { 'application/x-sqlite3': ['.fxd'] }
  }]
});

const file = await handle.getFile();
const buffer = await file.arrayBuffer();
const db = new SQL.Database(new Uint8Array(buffer));

// Create adapter and load
const adapter = new FXDAdapter();
await adapter.loadFXDFile(file.name, db);
```

### Task 2: Create a New FXD File

1. Click "New Disk" in Disk Manager
2. Enter a name (e.g., "my-project")
3. Click "Create"
4. The new disk will be created and loaded

### Task 3: Bind Two Nodes with a Transform

1. Select source node (e.g., `app.state.count`)
2. Shift+Click target node (e.g., `app.ui.display`)
3. Press `Ctrl+Shift+B`
4. Select "Transform" binding type
5. Enter transform function:
   ```javascript
   (value) => `Count: ${value}`
   ```
6. Click "Bind Nodes"

Now when `count` changes, `display` will automatically update with the formatted string!

### Task 4: Monitor Real-Time Changes

1. Load a FXD file
2. Press `Ctrl+Shift+P` to show metrics
3. Watch the update rate and FPS
4. Changes from external sources will appear automatically

## Troubleshooting

### Visualizer Won't Start

**Solution**: Check that all dependencies are installed:
```bash
npm install
npm install sql.js
```

### FXD File Won't Load

**Possible Issues**:
1. File is corrupted or not a valid SQLite database
2. sql.js not installed
3. File System Access API not supported

**Solution**:
- Try a different `.fxd` file
- Check browser console for errors
- Ensure you're using a supported browser

### Poor Performance

**Optimization Tips**:
1. Reduce node count (set `maxNodes` in adapter config)
2. Disable particle effects (Settings → Particle Effects)
3. Enable LOD (Level of Detail) system
4. Lower render quality (Settings → Render Quality)

### Atomics Not Working

**Requirements**:
- SharedArrayBuffer support
- CORS headers for cross-origin isolation:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```

**Solution**: For development, use a local server with proper headers, or use Electron/Tauri for desktop app.

## Next Steps

### Learn More

- Read [README-FXD.md](./README-FXD.md) for detailed documentation
- Explore [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [EXAMPLES.md](./EXAMPLES.md) for code examples

### Extend the Visualizer

- Create custom node renderers
- Add new panel types
- Implement custom layouts
- Build plugins for specific use cases

### Integrate with Your Project

```typescript
import { FXDAdapter } from './adapters/FXDAdapter';

// In your app
const adapter = new FXDAdapter({
  autoSync: true,
  syncInterval: 100,
});

adapter.subscribeToChanges((type, data) => {
  console.log('FXD change:', type, data);
});

await adapter.loadFXDFile('myproject.fxd', db);
```

## Get Help

- GitHub Issues: [Report bugs or request features]
- Documentation: Read the full docs in [README-FXD.md]
- Examples: Check `examples/` directory for sample files

## Success!

You're now ready to visualize and explore FXD node graphs in 3D!

Press `Ctrl+Shift+D` to load your first `.fxd` file and start exploring.

**Happy Visualizing!** 🎨✨
