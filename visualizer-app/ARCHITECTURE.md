# FX Visualizer - Technical Architecture

## Overview

The FX Visualizer is a sophisticated 3D visualization tool built on modern web technologies, designed to provide real-time insights into reactive dataflow within the FX framework.

## Core Technologies

### Frontend Stack
- **React 18.2**: Component architecture and UI
- **TypeScript 5.3**: Type safety and developer experience
- **Vite 5.0**: Build tool and dev server
- **Tailwind CSS 3.4**: Utility-first styling

### 3D Rendering
- **Three.js 0.160**: WebGL rendering engine
- **@react-three/fiber 8.15**: React renderer for Three.js
- **@react-three/drei 9.92**: Useful Three.js helpers

### State Management
- **Zustand 4.4**: Lightweight state management
- **React Hooks**: Local component state

### Graph Processing
- **D3-force 3.0**: Force-directed graph layout
- **Dagre 0.8**: Hierarchical graph layout

### Animation
- **Framer Motion 10.16**: Declarative animations
- **GSAP 3.12**: Complex animation sequences

## System Architecture

### Data Flow

```
FX Framework
     ↓
useFXIntegration Hook
     ↓
Graph Manager (converts FX nodes → Visualizer nodes)
     ↓
Zustand Store (central state)
     ↓
React Components
     ↓
Three.js Rendering
     ↓
WebGL Canvas
```

### Component Hierarchy

```
App
├── Toolbar
├── Canvas3D
│   ├── Scene
│   │   ├── NodeRenderer (instanced)
│   │   ├── ConnectionRenderer
│   │   ├── Grid
│   │   └── Lighting
│   ├── OrbitControls
│   └── CameraController
├── Inspector (panel)
├── Timeline (panel)
├── Metrics (overlay)
└── Console (panel)
```

## Core Systems

### 1. Graph Management

**GraphManager** (`src/core/graph/GraphManager.ts`)
- Converts FX nodes to visualizer nodes
- Maintains node relationships
- Tracks node updates and lifecycle

**Key Features:**
- Incremental updates (not full tree scans)
- Efficient node lookup (Map-based)
- Connection tracking
- Layer management

### 2. Layout Engine

**LayoutEngine** (`src/core/layout/LayoutEngine.ts`)
- Force-directed layout
- Hierarchical layout
- Layer-based positioning
- Physics simulation

**Algorithms:**
- **Force**: D3-force with customizable forces
- **Dagre**: Hierarchical top-down
- **Hierarchical**: Custom tree layout
- **Circular**: Radial arrangement
- **Custom**: User-defined positions

### 3. Rendering Pipeline

**Canvas3D** → **NodeRenderer** → **WebGL**

**Optimization Strategies:**
- **Instanced Rendering**: Render 1000s of identical nodes in one draw call
- **LOD (Level of Detail)**: Reduce geometry for distant nodes
- **Frustum Culling**: Don't render off-screen nodes
- **Occlusion Culling**: Don't render hidden nodes
- **Batching**: Group draw calls by material

### 4. State Management

**Zustand Store** (`src/core/store.ts`)

State slices:
- `graph`: Nodes, connections, layers
- `selection`: Selected/hovered nodes
- `filters`: Active filters
- `layout`: Layout configuration
- `camera`: Camera state and presets
- `timeline`: Snapshots and playback
- `metrics`: Performance data
- `inspector`: Current inspection target
- `panels`: UI panel states
- `settings`: User preferences

**Performance Optimizations:**
- Selector hooks to prevent unnecessary re-renders
- Immutable updates
- Shallow equality checks

### 5. FX Integration

**useFXIntegration Hook** (`src/hooks/useFXIntegration.ts`)

Responsibilities:
- Scan FX tree recursively
- Convert FX nodes to visualizer nodes
- Track node updates
- Monitor update frequency
- Sync at configurable intervals

**Update Detection:**
```typescript
// Watch for value changes
const currentValue = fx.val(node);
if (currentValue !== vizNode.value) {
  // Update detected
  updateNode(node.__id, {
    value: currentValue,
    updateCount: vizNode.updateCount + 1,
    lastUpdate: Date.now(),
    state: 'active',
  });
}
```

## Node Rendering

### Node Types & Geometry

| Type | Shape | Purpose |
|------|-------|---------|
| data | Box | Data nodes |
| effect | Sphere | Effect nodes |
| component | Octahedron | React components |
| event | Cone | Event listeners |
| computed | Box | Computed values |
| async | Sphere | Async operations |
| worker | Cylinder | Web Workers |
| http | Diamond | HTTP requests |
| websocket | Torus | WebSocket connections |
| wasm | Dodecahedron | WebAssembly modules |

### Color System

**State Colors:**
- Idle: Dark gray (#2c3e50)
- Active: Blue (#3498db)
- Success: Green (#2ecc71)
- Error: Red (#e74c3c)
- Warning: Orange (#f39c12)
- Suspended: Purple (#9b59b6)
- Cached: Teal (#1abc9c)

**Data Type Colors:**
- String: Green (#2ecc71)
- Number: Blue (#3498db)
- Boolean: Orange (#f39c12)
- Object: Purple (#9b59b6)
- Array: Pink (#e91e63)
- Function: Cyan (#00bcd4)
- Null: Gray (#95a5a6)
- Undefined: Dark gray (#7f8c8d)

### Material Properties

```typescript
const material = new THREE.MeshStandardMaterial({
  color: dataTypeColor,
  emissive: stateColor,
  emissiveIntensity: state === 'active' ? 0.5 : 0.2,
  metalness: 0.5,
  roughness: 0.5,
  wireframe: node.isFrozen,
});
```

## Connection Rendering

### Connection Types

- **Dependency**: Parent-child relationships
- **Data**: Data flow connections
- **Event**: Event propagation
- **HTTP**: HTTP request/response
- **WebSocket**: Bidirectional communication

### Curve Generation

```typescript
// Create bezier curve with arc
const start = sourcePosition.clone();
const end = targetPosition.clone();
const mid = start.clone().lerp(end, 0.5);
mid.y += Math.abs(start.y - end.y) * 0.3; // Add arc

const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
```

### Particle Animation

```typescript
useFrame((state) => {
  for (let i = 0; i < particleCount; i++) {
    const t = (state.clock.elapsedTime * speed + i / particleCount) % 1;
    const point = curve.getPoint(t);
    particles.position[i] = point;
  }
  particles.needsUpdate = true;
});
```

## Performance Optimization

### Rendering Optimizations

1. **Instanced Meshes**: Share geometry and material
2. **Geometry Pooling**: Reuse geometry instances
3. **Material Sharing**: One material per node type
4. **Draw Call Batching**: Minimize state changes

### Update Optimizations

1. **Debounced Updates**: Batch rapid changes
2. **Selective Rendering**: Only render visible nodes
3. **RAF Scheduling**: Use requestAnimationFrame
4. **Web Workers**: Offload heavy computation

### Memory Management

1. **Object Pooling**: Reuse Three.js objects
2. **Dispose on Unmount**: Clean up resources
3. **WeakMap References**: Prevent memory leaks
4. **Texture Atlases**: Reduce texture memory

## Time Travel System

### Snapshot Format

```typescript
interface Snapshot {
  id: string;
  timestamp: number;
  description: string;
  state: {
    graph: {
      nodes: [string, VisualizerNode][];
      connections: [string, VisualizerConnection][];
    };
  };
  metadata: Record<string, any>;
}
```

### Playback Mechanism

```typescript
// Timeline playback
useEffect(() => {
  if (!timeline.playing) return;

  const interval = setInterval(() => {
    const nextIndex = timeline.currentIndex + 1;
    if (nextIndex < timeline.snapshots.length) {
      restoreSnapshot(timeline.snapshots[nextIndex].id);
    } else {
      pauseTimeline();
    }
  }, 1000 / timeline.playbackSpeed);

  return () => clearInterval(interval);
}, [timeline.playing, timeline.playbackSpeed]);
```

## Testing Strategy

### Unit Tests
- Utility functions
- Color calculations
- Graph algorithms
- State management

### Integration Tests
- FX integration
- Node creation and updates
- Connection tracking
- Snapshot system

### Performance Tests
- Rendering benchmarks
- Update throughput
- Memory usage
- Frame rate stability

## Build & Deployment

### Development Build

```bash
npm run dev
```

- Hot module replacement
- Source maps
- Unminified code
- Development mode optimizations

### Production Build

```bash
npm run build
```

- Code minification
- Tree shaking
- Bundle splitting
- Compression (gzip/brotli)
- Asset optimization

### Bundle Analysis

```bash
npm run build -- --analyze
```

Output:
- `dist/stats.html`: Bundle size visualization
- Chunk dependencies
- Module tree

## Future Enhancements

### Planned Features

1. **VR/AR Support**: Immersive 3D exploration
2. **AI-Powered Insights**: Anomaly detection
3. **Collaboration**: Multi-user viewing
4. **Plugin System**: Custom node types and visualizations
5. **Export Formats**: SVG, PNG, video
6. **Code Diffing**: Visual git integration
7. **ML Predictions**: Predict future errors

### Performance Goals

- 10,000+ nodes at 60 FPS
- < 8ms update latency
- < 100MB memory usage
- WebGPU support

---

**FX Visualizer** - Built for scale, designed for beauty, optimized for performance.
