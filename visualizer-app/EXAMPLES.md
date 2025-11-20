# FX Visualizer - Usage Examples

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Custom Configuration](#custom-configuration)
3. [Programmatic Control](#programmatic-control)
4. [Time Travel](#time-travel)
5. [Performance Monitoring](#performance-monitoring)
6. [Custom Node Types](#custom-node-types)
7. [Export & Import](#export--import)
8. [Real-World Examples](#real-world-examples)

## Basic Setup

### Minimal Example

```typescript
import { FXVisualizer } from '@fx/visualizer';
import { fx } from './your-fx-instance';

// Create visualizer
const visualizer = new FXVisualizer(fx);

// Mount to DOM
visualizer.mount('#visualizer-root');
```

### With Container

```html
<!DOCTYPE html>
<html>
  <head>
    <title>FX Visualizer Example</title>
  </head>
  <body>
    <div id="app" style="width: 100vw; height: 100vh;"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```typescript
// main.ts
import { FXVisualizer } from '@fx/visualizer';
import { createFX } from '@fx/core';

const fx = createFX();
const visualizer = new FXVisualizer(fx, {
  autoSync: true,
  syncInterval: 100,
});

visualizer.mount('#app');
```

## Custom Configuration

### Theme Customization

```typescript
const visualizer = new FXVisualizer(fx, {
  theme: 'circuit', // 'dark' | 'light' | 'circuit'
  showGrid: true,
  showLabels: true,
  showStats: true,

  // Custom colors
  colors: {
    background: '#0a0a0a',
    grid: '#d4af37',
    trace: '#b87333',
  },
});
```

### Layout Configuration

```typescript
const visualizer = new FXVisualizer(fx, {
  layout: {
    algorithm: 'force', // 'force' | 'dagre' | 'hierarchical' | 'circular'
    spacing: 150,
    layerSpacing: 250,
    iterations: 500,
    enablePhysics: true,

    // Force-directed specific
    forces: {
      charge: -500,
      link: 100,
      collision: 50,
      center: 1,
    },
  },
});
```

### Performance Tuning

```typescript
const visualizer = new FXVisualizer(fx, {
  renderQuality: 'high', // 'low' | 'medium' | 'high' | 'ultra'
  maxNodes: 5000,
  lodEnabled: true,
  enableAnimations: true,
  particleEffects: true,

  // Advanced
  frustumCulling: true,
  occlusionCulling: false,
  instancedRendering: true,
});
```

## Programmatic Control

### Node Selection

```typescript
// Select single node
visualizer.selectNode('app.state.count');

// Select multiple nodes
visualizer.selectNodes(['app.state.count', 'app.state.user']);

// Get selected nodes
const selected = visualizer.getSelectedNodes();

// Clear selection
visualizer.clearSelection();

// Select by filter
visualizer.selectWhere((node) => node.type === 'component');
```

### Camera Control

```typescript
// Move camera
visualizer.camera.position.set(0, 500, 1000);

// Look at node
visualizer.camera.lookAt('app.state.count');

// Apply preset
visualizer.camera.applyPreset('top');

// Focus on selection
visualizer.camera.focusSelection();

// Fit all nodes
visualizer.camera.fitAll();

// Custom preset
visualizer.camera.addPreset({
  name: 'debug',
  position: new THREE.Vector3(1000, 300, 500),
  target: new THREE.Vector3(0, 0, 0),
  description: 'Debug view',
});
```

### Filtering

```typescript
// Filter by node type
visualizer.filter({
  nodeTypes: ['component', 'effect'],
});

// Filter by layer
visualizer.filter({
  layers: ['component', 'dom'],
});

// Filter by state
visualizer.filter({
  states: ['active', 'error'],
});

// Custom filter
visualizer.filter({
  custom: (node) => {
    return node.updateFrequency > 10 && node.value !== null;
  },
});

// Clear filters
visualizer.clearFilters();
```

### Node Manipulation

```typescript
// Freeze node (stop updates)
visualizer.freezeNode('app.state.count');

// Unfreeze node
visualizer.unfreezeNode('app.state.count');

// Watch node
visualizer.watchNode('app.state.count', (value) => {
  console.log('Count changed:', value);
});

// Delete node
visualizer.deleteNode('app.state.temp');

// Get node info
const nodeInfo = visualizer.getNode('app.state.count');
console.log(nodeInfo);
```

## Time Travel

### Basic Time Travel

```typescript
// Create snapshot
const snapshot = visualizer.createSnapshot('Before user login');

// Restore snapshot
visualizer.restoreSnapshot(snapshot.id);

// Get all snapshots
const snapshots = visualizer.getSnapshots();

// Play timeline
visualizer.timeline.play();

// Pause timeline
visualizer.timeline.pause();

// Set playback speed
visualizer.timeline.setSpeed(2); // 2x speed
```

### Advanced Time Travel

```typescript
// Auto-snapshot on interval
visualizer.timeline.startAutoSnapshot({
  interval: 5000, // Every 5 seconds
  maxSnapshots: 100,
  description: (index) => `Auto ${index}`,
});

// Snapshot on condition
visualizer.timeline.snapshotWhen((state) => {
  return state.graph.nodes.size > 100;
}, 'Many nodes');

// Compare snapshots
const diff = visualizer.timeline.compare(snapshot1.id, snapshot2.id);
console.log('Differences:', diff);

// Timeline playback with callback
visualizer.timeline.play({
  speed: 1,
  onFrame: (snapshot, index) => {
    console.log(`Frame ${index}:`, snapshot.description);
  },
  onComplete: () => {
    console.log('Playback complete');
  },
});
```

## Performance Monitoring

### Basic Metrics

```typescript
// Get current metrics
const metrics = visualizer.getMetrics();
console.log('FPS:', metrics.fps);
console.log('Nodes:', metrics.nodeCount);
console.log('Update rate:', metrics.updateRate);

// Subscribe to metrics updates
visualizer.onMetrics((metrics) => {
  document.getElementById('fps').textContent = metrics.fps.toString();
});
```

### Performance Profiling

```typescript
// Start profiling
visualizer.profiler.start();

// Stop profiling
const profile = visualizer.profiler.stop();

// Analyze hotspots
const hotspots = visualizer.profiler.getHotspots();
hotspots.forEach((node) => {
  console.log(`${node.id}: ${node.executionTime}ms`);
});

// Generate flame graph
visualizer.profiler.generateFlameGraph('#flamegraph-container');

// Export profile
const profileData = visualizer.profiler.export();
// Save or send to analytics service
```

### Memory Monitoring

```typescript
// Get memory usage
const memory = visualizer.getMemoryUsage();
console.log('Heap used:', memory.usedJSHeapSize);
console.log('Heap limit:', memory.jsHeapSizeLimit);

// Memory leak detection
visualizer.detectMemoryLeaks({
  interval: 10000,
  threshold: 50 * 1024 * 1024, // 50MB
  onLeak: (info) => {
    console.warn('Potential memory leak:', info);
  },
});
```

## Custom Node Types

### Register Custom Node Renderer

```typescript
visualizer.registerNodeType({
  name: 'custom',
  match: (node) => node.id.startsWith('custom.'),
  geometry: ({ node }) => {
    // Return Three.js geometry
    return new THREE.TetrahedronGeometry(20);
  },
  material: ({ node, state }) => {
    return new THREE.MeshStandardMaterial({
      color: state === 'active' ? '#00ff00' : '#666666',
      emissive: '#00ff00',
      emissiveIntensity: 0.3,
    });
  },
  onClick: ({ node, event }) => {
    console.log('Custom node clicked:', node.id);
  },
});
```

### Custom Connection Type

```typescript
visualizer.registerConnectionType({
  name: 'data-flow',
  match: (connection) => connection.type === 'data',
  curve: ({ source, target }) => {
    // Custom curve calculation
    const mid = source.clone().lerp(target, 0.5);
    mid.y += 100; // Higher arc
    return new THREE.QuadraticBezierCurve3(source, mid, target);
  },
  material: ({ connection }) => {
    return new THREE.LineBasicMaterial({
      color: '#00ffff',
      linewidth: 3,
      opacity: 0.8,
      transparent: true,
    });
  },
  particles: {
    enabled: true,
    count: 30,
    size: 6,
    speed: 0.5,
    color: '#00ffff',
  },
});
```

## Export & Import

### Export State

```typescript
// Export current state
const state = visualizer.export();

// Save to file
const blob = new Blob([JSON.stringify(state, null, 2)], {
  type: 'application/json',
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'fx-visualizer-state.json';
a.click();
```

### Import State

```typescript
// Import from file
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/json';
input.onchange = async (e) => {
  const file = e.target.files[0];
  const text = await file.text();
  const state = JSON.parse(text);
  visualizer.import(state);
};
input.click();
```

### Export Screenshot

```typescript
// Export as PNG
const screenshot = visualizer.screenshot({
  width: 1920,
  height: 1080,
  format: 'png',
  quality: 1.0,
});

// Download
const a = document.createElement('a');
a.href = screenshot;
a.download = 'fx-visualizer.png';
a.click();
```

### Export Video

```typescript
// Record animation
const recorder = visualizer.startRecording({
  duration: 10000, // 10 seconds
  fps: 60,
  format: 'webm',
});

// Stop and download
recorder.stop().then((blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fx-visualizer.webm';
  a.click();
});
```

## Real-World Examples

### React Application

```typescript
import React, { useEffect, useRef } from 'react';
import { FXVisualizer } from '@fx/visualizer';
import { fx } from './fx-instance';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<FXVisualizer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const visualizer = new FXVisualizer(fx, {
      autoSync: true,
      theme: 'circuit',
    });

    visualizer.mount(containerRef.current);
    visualizerRef.current = visualizer;

    return () => {
      visualizer.unmount();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
  );
}
```

### Debug Panel

```typescript
import { FXVisualizer } from '@fx/visualizer';
import { fx } from './fx-instance';

// Create debug panel
const debugPanel = document.createElement('div');
debugPanel.id = 'debug-panel';
debugPanel.style.cssText = `
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
`;
document.body.appendChild(debugPanel);

// Initialize visualizer in debug panel
const visualizer = new FXVisualizer(fx, {
  autoSync: true,
  renderQuality: 'medium', // Lower quality for debug panel
  maxNodes: 1000,
});

visualizer.mount(debugPanel);

// Add toggle button
const toggleButton = document.createElement('button');
toggleButton.textContent = 'Toggle Debug';
toggleButton.onclick = () => {
  debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
};
document.body.appendChild(toggleButton);
```

### Performance Dashboard

```typescript
import { FXVisualizer } from '@fx/visualizer';
import { Chart } from 'chart.js';

const visualizer = new FXVisualizer(fx);

// FPS chart
const fpsData: number[] = [];
const fpsLabels: string[] = [];

visualizer.onMetrics((metrics) => {
  fpsData.push(metrics.fps);
  fpsLabels.push(new Date().toLocaleTimeString());

  if (fpsData.length > 60) {
    fpsData.shift();
    fpsLabels.shift();
  }

  fpsChart.data.datasets[0].data = fpsData;
  fpsChart.data.labels = fpsLabels;
  fpsChart.update();
});

const fpsChart = new Chart('fps-chart', {
  type: 'line',
  data: {
    labels: fpsLabels,
    datasets: [{
      label: 'FPS',
      data: fpsData,
      borderColor: '#3498db',
      tension: 0.4,
    }],
  },
});
```

---

**Need more examples?** Check out the `examples/` directory for complete, runnable examples.
