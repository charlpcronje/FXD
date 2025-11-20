/**
 * FX Visualizer - Main Application Component
 */

import React, { useEffect, useState } from 'react';
import { Canvas3D } from './components/Canvas3D/Canvas3D';
import { Toolbar } from './components/UI/Toolbar/Toolbar';
import { Inspector } from './components/UI/Inspector/Inspector';
import { Timeline } from './components/UI/Timeline/Timeline';
import { Metrics } from './components/UI/Metrics/Metrics';
import { Console } from './components/UI/Console/Console';
import { useVisualizerStore } from './core/store';
import { useFXIntegration } from './hooks/useFXIntegration';
import type { FXCore } from './types';

// Mock FX instance for demo
const createMockFX = (): FXCore => {
  const createNode = (parentId: string) => ({
    __id: `node_${Math.random().toString(36).slice(2, 11)}`,
    __parent_id: parentId,
    __type: 'any',
    __proto: [],
    __value: null,
    __nodes: {},
  });

  const root = createNode('root');
  root.__id = 'root';
  root.__parent_id = null;

  // Create some demo nodes
  const demoNodes = [
    { id: 'app', parent: root, type: 'object', value: {} },
    { id: 'app.state', parent: null, type: 'object', value: { count: 0 } },
    { id: 'app.actions', parent: null, type: 'object', value: {} },
    { id: 'app.components', parent: null, type: 'object', value: {} },
  ];

  demoNodes.forEach(({ id, type, value }) => {
    const node = createNode(root.__id);
    node.__id = id;
    node.__type = type;
    node.__value = value;

    const parts = id.split('.');
    let current: any = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.__nodes) current.__nodes = {};
      if (!current.__nodes[part]) {
        current.__nodes[part] = createNode(current.__id);
        current.__nodes[part].__id = parts.slice(0, i + 1).join('.');
      }
      current = current.__nodes[part];
    }

    const lastPart = parts[parts.length - 1];
    if (!current.__nodes) current.__nodes = {};
    current.__nodes[lastPart] = node;
  });

  return {
    root,
    createNode,
    resolvePath: (path: string, root: any) => {
      if (path === 'root') return root;
      const parts = path.split('.');
      let current = root;

      for (const part of parts) {
        if (!current.__nodes || !current.__nodes[part]) return null;
        current = current.__nodes[part];
      }

      return current;
    },
    setPath: (path: string, value: any, root: any) => {
      const parts = path.split('.');
      let current = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.__nodes) current.__nodes = {};
        if (!current.__nodes[part]) {
          current.__nodes[part] = createNode(current.__id);
        }
        current = current.__nodes[part];
      }

      const lastPart = parts[parts.length - 1];
      if (!current.__nodes) current.__nodes = {};
      if (!current.__nodes[lastPart]) {
        current.__nodes[lastPart] = createNode(current.__id);
      }

      current.__nodes[lastPart].__value = value;
      return current.__nodes[lastPart];
    },
    val: (node: any, defaultValue?: any) => {
      return node.__value !== undefined ? node.__value : defaultValue;
    },
    set: (node: any, value: any) => {
      node.__value = value;
    },
    createNodeProxy: (node: any) => ({
      __id: node.__id,
      val: () => node.__value,
      watch: (callback: Function) => {
        // Mock watcher
        return () => {};
      },
    }),
  };
};

function App() {
  const [fx] = useState<FXCore>(() => createMockFX());
  const { panels } = useVisualizerStore();

  // Initialize FX integration
  useFXIntegration(fx, {
    autoSync: true,
    syncInterval: 100,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Command palette (TODO)
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        console.log('[FX Visualizer] Command palette (coming soon)');
      }

      // Ctrl+Shift+I: Toggle inspector
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        useVisualizerStore.getState().togglePanel('inspector');
      }

      // Ctrl+Shift+C: Toggle console
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        useVisualizerStore.getState().togglePanel('console');
      }

      // Ctrl+Shift+P: Toggle metrics
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        useVisualizerStore.getState().togglePanel('metrics');
      }

      // F: Focus on selected (TODO)
      if (e.key === 'f' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        console.log('[FX Visualizer] Focus on selected (coming soon)');
      }

      // A: Fit all (TODO)
      if (e.key === 'a' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        console.log('[FX Visualizer] Fit all (coming soon)');
      }

      // 1-9: Camera presets
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const presetNames = ['Default', 'Top', 'Side', 'Front', 'Layers'];
        const index = parseInt(e.key) - 1;
        if (index < presetNames.length) {
          useVisualizerStore.getState().applyCameraPreset(presetNames[index]);
          console.log(`[FX Visualizer] Applied camera preset: ${presetNames[index]}`);
        }
      }

      // Space: Play/Pause timeline
      if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const { timeline, playTimeline, pauseTimeline } = useVisualizerStore.getState();
        if (timeline.playing) {
          pauseTimeline();
        } else {
          playTimeline();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const inspectorPanel = panels.get('inspector');
  const timelinePanel = panels.get('timeline');
  const consolePanel = panels.get('console');
  const metricsPanel = panels.get('metrics');

  return (
    <div className="w-screen h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Canvas3D />

          {/* Metrics overlay */}
          {metricsPanel?.visible && (
            <div className="absolute top-4 left-4 z-10">
              <Metrics />
            </div>
          )}
        </div>

        {/* Inspector panel */}
        {inspectorPanel?.visible && (
          <div
            className="glass-dark border-l border-white/10 overflow-auto"
            style={{ width: inspectorPanel.width }}
          >
            <Inspector />
          </div>
        )}
      </div>

      {/* Timeline panel */}
      {timelinePanel?.visible && (
        <div
          className="glass-dark border-t border-white/10"
          style={{ height: timelinePanel.height }}
        >
          <Timeline />
        </div>
      )}

      {/* Console panel */}
      {consolePanel?.visible && (
        <div
          className="glass-dark border-t border-white/10"
          style={{ height: consolePanel.height }}
        >
          <Console />
        </div>
      )}

      {/* Watermark */}
      <div className="absolute bottom-4 right-4 text-xs text-white/20 pointer-events-none">
        FX Visualizer v1.0.0 - The Matrix Meets Developer Tools
      </div>
    </div>
  );
}

export default App;
