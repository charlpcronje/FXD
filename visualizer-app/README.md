# FX Visualizer - The Matrix Meets Developer Tools

> **The most advanced, visually stunning, and functionally comprehensive visualizer for the FX reactive framework.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.160-000000.svg)

## Features

### 🎨 Visual Design
- **Circuit Board Aesthetic**: Inspired by PCB design with golden traces and copper connections
- **3D Spatial Visualization**: Nodes organized in 8 distinct layers (Core → TimeTravel)
- **Real-time Particle Effects**: Animated data flow particles showing reactive updates
- **Heat Map Visualization**: Color-coded nodes based on update frequency
- **Glow Effects**: Pulsing glows for highly active nodes
- **Type-Based Coloring**: Different colors for different data types and node states

### 🎮 Interactive Features
- **Node Manipulation**: Click, drag, select, freeze, watch, and delete nodes
- **Multi-Select**: Box select, shift-click, and batch operations
- **Camera Controls**: Zoom, pan, rotate with 9 preset camera angles
- **Smart Filtering**: Filter by type, layer, state, or custom expressions
- **Live Search**: Fuzzy search across node IDs, types, and values

### ⏱️ Time Travel Debugging
- **Snapshot System**: Create, restore, and compare application states
- **Timeline Scrubber**: Navigate through history with frame-by-frame precision
- **Playback Controls**: Play, pause, speed control (0.1x - 10x)
- **Diff Visualization**: See what changed between snapshots
- **Auto-Recording**: Continuous recording of last N minutes

### 📊 Performance Profiling
- **Real-time Metrics**: FPS, node count, update rate, memory usage
- **Flame Graphs**: Visualize call stacks and execution time
- **Heat Maps**: Identify performance bottlenecks
- **Network Waterfall**: HTTP/WebSocket requests timeline

### 🔧 Developer Tools
- **Integrated Console**: Capture and filter logs with search
- **Property Inspector**: Deep inspection of node values and metadata
- **Code Generation**: Generate TypeScript from visual flows
- **State Export/Import**: Save and load application states

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

```bash
npm run build
```

## Usage

### Basic Integration

```typescript
import { FXVisualizer } from '@fx/visualizer';
import { fx } from './your-fx-instance';

// Initialize visualizer
const visualizer = new FXVisualizer(fx, {
  autoSync: true,
  syncInterval: 100,
  maxNodes: 10000,
});

// Mount to DOM
visualizer.mount('#visualizer-root');
```

### Advanced Configuration

```typescript
const visualizer = new FXVisualizer(fx, {
  // Sync options
  autoSync: true,
  syncInterval: 100,
  maxNodes: 10000,
  trackPerformance: true,

  // Visual options
  theme: 'circuit',
  showGrid: true,
  showLabels: true,
  particleEffects: true,

  // Layout options
  layout: {
    algorithm: 'force',
    spacing: 100,
    layerSpacing: 200,
    enablePhysics: true,
  },

  // Performance options
  renderQuality: 'high',
  lodEnabled: true,
  enableAnimations: true,
});
```

## Keyboard Shortcuts

### Navigation
- **Arrow Keys**: Move selected nodes
- **Shift + Arrow**: Move camera
- **Ctrl + Scroll**: Zoom
- **F**: Focus on selected node
- **A**: Fit all nodes in view
- **0**: Reset camera
- **1-9**: Apply camera presets

### Selection
- **Ctrl + A**: Select all
- **Ctrl + Shift + A**: Deselect all
- **Ctrl + I**: Invert selection
- **Click**: Select node
- **Shift + Click**: Add to selection
- **Box Drag**: Select multiple nodes

### Editing
- **Ctrl + C**: Copy selected nodes
- **Ctrl + V**: Paste nodes
- **Ctrl + X**: Cut nodes
- **Ctrl + Z**: Undo
- **Ctrl + Shift + Z**: Redo
- **Delete**: Delete selected nodes
- **Ctrl + D**: Duplicate selected nodes

### View
- **T**: Toggle layer visibility
- **G**: Toggle grid
- **H**: Toggle HUD
- **L**: Toggle labels

### Debug
- **Ctrl + K**: Open command palette
- **Ctrl + Shift + I**: Toggle inspector
- **Ctrl + Shift + C**: Toggle console
- **Ctrl + Shift + P**: Toggle profiler

### Time Travel
- **Space**: Play/Pause timeline
- **,**: Step backward
- **.**: Step forward
- **[**: Previous snapshot
- **]**: Next snapshot

## Architecture

The visualizer is built with a modular architecture:

```
fx-visualizer/
├── src/
│   ├── core/
│   │   ├── store.ts          # Zustand state management
│   │   ├── engine/           # 3D rendering engine
│   │   ├── graph/            # Graph data structures
│   │   └── layout/           # Auto-layout algorithms
│   ├── components/
│   │   ├── Canvas3D/         # Main 3D canvas
│   │   ├── NodeRenderer/     # Node visualization
│   │   ├── ConnectionRenderer/ # Connection visualization
│   │   └── UI/               # 2D UI overlays
│   ├── hooks/
│   │   └── useFXIntegration.ts # FX framework integration
│   ├── utils/
│   │   └── colors.ts         # Color utilities
│   └── types/
│       └── index.ts          # TypeScript definitions
```

## Performance

The visualizer is optimized for:
- **60 FPS** with 1000+ nodes
- **< 16ms** update latency
- **Instanced rendering** for thousands of nodes
- **Level of Detail (LOD)** for distant objects
- **Frustum culling** for off-screen nodes
- **WebGL acceleration** via Three.js

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebGL 2.0 and ES2020 required.

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md).

## License

MIT © FX Team

## Acknowledgments

- Built with [React](https://react.dev/)
- 3D rendering with [Three.js](https://threejs.org/)
- State management with [Zustand](https://github.com/pmndrs/zustand)
- Graph layout with [D3-force](https://github.com/d3/d3-force)
- Icons from [Lucide](https://lucide.dev/)

---

**FX Visualizer** - Making reactive dataflow visible, tangible, and beautiful.
