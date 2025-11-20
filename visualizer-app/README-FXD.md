# FXD Visualizer - Integration Guide

> **3D Visualization for FXD Node Graphs with Real-Time Updates**

This is the FXD-integrated version of the FX Visualizer, providing a complete visual interface for exploring, managing, and manipulating FXD node graphs stored in `.fxd` and `.fxwal` files.

## Features

### Core FXD Integration

- **SQLite Database Reading**: Load and visualize `.fxd` files (SQLite databases)
- **WAL Support**: Real-time updates from `.fxwal` (Write-Ahead Log) files
- **Disk Management**: Visual interface for managing multiple `.fxd` files
- **Node Binding**: Visual interface for creating FX Atomics bindings between nodes
- **Real-Time Sync**: Automatic updates via FX Signals subscription

### Visualization Features

- **3D Spatial Layout**: Nodes organized in 8 distinct layers (Core → TimeTravel)
- **Interactive Graph**: Click, drag, select, and manipulate nodes
- **Connection Visualization**: See relationships and data flow between nodes
- **Type-Based Coloring**: Different colors for different node types
- **Heat Maps**: Visualize node activity and update frequency

### Developer Tools

- **Node Inspector**: Deep inspection of node values and metadata
- **Disk Manager**: List, load, unload, and create `.fxd` files
- **Node Binder**: Visual interface for binding nodes with transforms
- **Performance Metrics**: FPS, node count, update rate, memory usage
- **Console**: Capture and filter logs

## Installation

```bash
cd visualizer-app
npm install
```

### Required Dependencies

For full FXD integration, you'll need SQLite for the browser:

```bash
npm install sql.js
# or
npm install better-sqlite3-wasm
```

## Usage

### 1. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Load a FXD File

#### Option A: Using the Disk Manager UI

1. Press `Ctrl+Shift+D` or click the disk icon to open Disk Manager
2. Select a `.fxd` file from the list
3. Click "Load" to visualize the node graph

#### Option B: Programmatically

```typescript
import { FXDAdapter } from './adapters/FXDAdapter';
import initSqlJs from 'sql.js';

// Initialize sql.js
const SQL = await initSqlJs({
  locateFile: file => `https://sql.js.org/dist/${file}`
});

// Read FXD file (using File System Access API)
const [fileHandle] = await window.showOpenFilePicker({
  types: [{
    description: 'FXD Files',
    accept: { 'application/x-sqlite3': ['.fxd'] }
  }]
});

const file = await fileHandle.getFile();
const buffer = await file.arrayBuffer();
const db = new SQL.Database(new Uint8Array(buffer));

// Load into adapter
const adapter = new FXDAdapter();
await adapter.loadFXDFile(file.name, db);

// Get nodes and connections
const nodes = await adapter.getNodes();
const connections = await adapter.getConnections();
```

### 3. Create a New FXD File

```typescript
import { FXDAdapter } from './adapters/FXDAdapter';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const db = new SQL.Database();

await FXDAdapter.createFXDFile('my-project.fxd', db);

// Export to file
const data = db.export();
const blob = new Blob([data], { type: 'application/x-sqlite3' });
// Save using File System Access API
```

### 4. Bind Nodes Visually

1. Select two nodes in the 3D view (Shift+Click)
2. Press `Ctrl+Shift+B` or click the link icon to open Node Binder
3. Configure binding:
   - **One-Way**: Source updates target
   - **Two-Way**: Bidirectional sync
   - **Transform**: Apply JavaScript function
4. Enable Atomics for SharedArrayBuffer entanglement
5. Click "Bind Nodes"

### 5. Real-Time Updates via FX Signals

The adapter automatically subscribes to FX Signals for real-time updates:

```typescript
const adapter = new FXDAdapter({
  autoSync: true,
  syncInterval: 100, // Check for updates every 100ms
});

adapter.subscribeToChanges((type, data) => {
  if (type === 'node') {
    console.log('Nodes updated:', data);
    // Visualizer updates automatically
  }
});
```

## Architecture

```
visualizer-app/
├── src/
│   ├── adapters/
│   │   └── FXDAdapter.ts          # FXD data source adapter
│   ├── components/
│   │   ├── Canvas3D/              # Main 3D canvas
│   │   ├── NodeRenderer/          # Node visualization
│   │   ├── ConnectionRenderer/    # Connection visualization
│   │   └── UI/
│   │       ├── DiskManager/       # FXD file management
│   │       ├── NodeBinder/        # Visual node binding
│   │       ├── Inspector/         # Node inspector
│   │       ├── Toolbar/           # Main toolbar
│   │       ├── Timeline/          # Time travel controls
│   │       ├── Metrics/           # Performance metrics
│   │       └── Console/           # Log console
│   ├── core/
│   │   └── store.ts               # Zustand state management
│   ├── hooks/
│   │   └── useFXIntegration.ts    # FX framework integration
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   ├── App-FXD.tsx                # Main app with FXD integration
│   └── main.tsx                   # Entry point
```

## FXD Adapter API

### Constructor

```typescript
const adapter = new FXDAdapter({
  autoSync?: boolean,        // Auto-sync changes (default: true)
  syncInterval?: number,     // Sync interval in ms (default: 100)
  maxNodes?: number,         // Max nodes to load (default: 10000)
  enableWAL?: boolean,       // Enable WAL support (default: true)
});
```

### Methods

#### `loadFXDFile(filePath: string, db: SQLiteDatabase): Promise<void>`

Load a `.fxd` file into the visualizer.

#### `getNodes(): Promise<VisualizerNode[]>`

Get all nodes for visualization.

#### `getConnections(): Promise<VisualizerConnection[]>`

Get all connections between nodes.

#### `getDiskStats(): Promise<DiskStats>`

Get disk statistics (node count, size, sync state).

#### `subscribeToChanges(callback: Function): () => void`

Subscribe to node/connection changes. Returns unsubscribe function.

#### `dispose(): void`

Clean up resources and close database connection.

### Static Methods

#### `FXDAdapter.listFXDFiles(directory?: string): Promise<FXDFileInfo[]>`

List available `.fxd` files (requires File System Access API).

#### `FXDAdapter.createFXDFile(path: string, db: SQLiteDatabase): Promise<void>`

Create a new `.fxd` file with proper schema.

## Keyboard Shortcuts

### Navigation
- **Arrow Keys**: Move selected nodes
- **Shift + Arrow**: Move camera
- **Ctrl + Scroll**: Zoom
- **F**: Focus on selected node
- **A**: Fit all nodes in view
- **1-9**: Apply camera presets

### Selection
- **Click**: Select node
- **Shift + Click**: Add to selection
- **Ctrl + A**: Select all
- **Box Drag**: Select multiple nodes

### Panels
- **Ctrl + Shift + D**: Toggle Disk Manager
- **Ctrl + Shift + B**: Toggle Node Binder
- **Ctrl + Shift + I**: Toggle Inspector
- **Ctrl + Shift + C**: Toggle Console
- **Ctrl + Shift + P**: Toggle Metrics

### Time Travel
- **Space**: Play/Pause timeline
- **,**: Step backward
- **.**: Step forward

## Integration with FXD Core

The visualizer integrates with FXD core features:

### 1. FX Signals

```typescript
// FX Signals automatically trigger visualizer updates
import { Signal } from '../modules/fx-signals';

const signal = new Signal();
signal.subscribe((value) => {
  // Adapter detects change and updates visualization
  adapter.syncFromSignal(value);
});
```

### 2. FX Persistence

```typescript
// Load from FXD disk
import { FXDisk } from '../modules/fx-persistence';

const disk = new FXDisk('my-project.fxd');
await disk.open();

// Adapter reads directly from disk
await adapter.loadFromDisk(disk);
```

### 3. FX WAL (Write-Ahead Log)

```typescript
// Real-time updates from WAL
import { FXWAL } from '../modules/fx-wal';

const wal = new FXWAL('my-project.fxwal');
wal.on('entry', (entry) => {
  // Adapter applies WAL entry to visualization
  adapter.applyWALEntry(entry);
});
```

### 4. FX Atomics (Node Binding)

```typescript
// Visual node binding creates FX Atomics bindings
import { FXAtomics } from '../modules/fx-atomics';

const binding = FXAtomics.bind(sourceNode, targetNode, {
  transform: (value) => value * 2,
  bufferSize: 1024,
});

// Binding is visualized as a connection in 3D
```

## Browser Requirements

- **Chrome 90+** (recommended)
- **Firefox 88+**
- **Safari 14+**
- **Edge 90+**

### Required APIs

- **WebGL 2.0**: For 3D rendering
- **File System Access API**: For loading `.fxd` files
- **SharedArrayBuffer** (optional): For FX Atomics support
- **WebAssembly**: For sql.js or better-sqlite3-wasm

## Performance

- **60 FPS** with 1000+ nodes
- **< 16ms** update latency
- **Instanced rendering** for thousands of nodes
- **Level of Detail (LOD)** for distant objects
- **Frustum culling** for off-screen nodes

## Troubleshooting

### FXD File Won't Load

1. Check browser console for errors
2. Verify sql.js or better-sqlite3-wasm is installed
3. Ensure File System Access API is supported
4. Try a different `.fxd` file

### Performance Issues

1. Reduce `maxNodes` in adapter config
2. Disable particle effects in settings
3. Enable LOD (Level of Detail)
4. Lower render quality setting

### Atomics Not Working

1. Ensure SharedArrayBuffer is enabled
2. Check CORS headers (requires cross-origin isolation)
3. Verify buffer size is sufficient

## Examples

### Example 1: Load Demo Project

```typescript
import { FXDAdapter } from './adapters/FXDAdapter';

const adapter = new FXDAdapter();

// Load example FXD file
await adapter.loadFXDFile('examples/demo-final.fxd', db);

// Visualizer updates automatically
```

### Example 2: Create and Populate FXD File

```typescript
import { FXDAdapter } from './adapters/FXDAdapter';
import { fx } from '../fxn';

// Create new disk
const db = new SQL.Database();
await FXDAdapter.createFXDFile('new-project.fxd', db);

// Add nodes
const root = fx();
root('app.state.count').set(42);
root('app.actions.increment').set(() => {
  root('app.state.count').set(root('app.state.count').get() + 1);
});

// Save to disk and visualize
```

### Example 3: Real-Time Monitoring

```typescript
const adapter = new FXDAdapter({ autoSync: true, syncInterval: 50 });

adapter.subscribeToChanges((type, data) => {
  console.log(`[Monitor] ${type} changed:`, data);

  if (type === 'node') {
    // Highlight changed nodes in visualizer
    data.forEach(node => {
      highlightNode(node.id, 'flash');
    });
  }
});
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

MIT © FX Team

---

**FXD Visualizer** - Making reactive dataflow visible, tangible, and beautiful.
