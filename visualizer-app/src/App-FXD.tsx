/**
 * FX Visualizer - Main Application Component with FXD Integration
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Canvas3D } from './components/Canvas3D/Canvas3D';
import { Toolbar } from './components/UI/Toolbar/Toolbar';
import { Inspector } from './components/UI/Inspector/Inspector';
import { Timeline } from './components/UI/Timeline/Timeline';
import { Metrics } from './components/UI/Metrics/Metrics';
import { Console } from './components/UI/Console/Console';
import { DiskManager } from './components/UI/DiskManager/DiskManager';
import { NodeBinder } from './components/UI/NodeBinder/NodeBinder';
import { useVisualizerStore } from './core/store';
import { FXDAdapter } from './adapters/FXDAdapter';
import type { VisualizerNode, VisualizerConnection } from './types';
import type { BindingConfig } from './components/UI/NodeBinder/NodeBinder';
import { Database, Link } from 'lucide-react';

function App() {
  const [adapter, setAdapter] = useState<FXDAdapter | null>(null);
  const [currentDisk, setCurrentDisk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    panels,
    togglePanel,
    setGraph,
    selection,
    timeline,
    playTimeline,
    pauseTimeline,
    applyCameraPreset
  } = useVisualizerStore();

  // Initialize adapter
  useEffect(() => {
    const newAdapter = new FXDAdapter({
      autoSync: true,
      syncInterval: 100,
      maxNodes: 10000,
      enableWAL: true,
    });

    setAdapter(newAdapter);

    // Subscribe to changes
    const unsubscribe = newAdapter.subscribeToChanges((type, data) => {
      if (type === 'node') {
        console.log('[FXD Adapter] Nodes updated:', data.length);
        // Update visualizer graph
        syncAdapterToVisualizer(newAdapter);
      } else if (type === 'connection') {
        console.log('[FXD Adapter] Connections updated:', data.length);
      }
    });

    return () => {
      unsubscribe();
      newAdapter.dispose();
    };
  }, []);

  // Sync adapter data to visualizer
  const syncAdapterToVisualizer = useCallback(async (adapterInstance: FXDAdapter) => {
    try {
      const nodes = await adapterInstance.getNodes();
      const connections = await adapterInstance.getConnections();

      // Convert to Map format expected by visualizer
      const nodesMap = new Map<string, VisualizerNode>();
      nodes.forEach(node => nodesMap.set(node.id, node));

      const connectionsMap = new Map<string, VisualizerConnection>();
      connections.forEach(conn => connectionsMap.set(conn.id, conn));

      // Build layers map
      const layersMap = new Map();
      nodes.forEach(node => {
        if (!layersMap.has(node.layer)) {
          layersMap.set(node.layer, new Set());
        }
        layersMap.get(node.layer).add(node.id);
      });

      setGraph({
        nodes: nodesMap,
        connections: connectionsMap,
        layers: layersMap,
      });
    } catch (error) {
      console.error('[FXD Adapter] Error syncing to visualizer:', error);
    }
  }, [setGraph]);

  // Load FXD file
  const handleLoadDisk = useCallback(async (filePath: string) => {
    if (!adapter) {
      setError('Adapter not initialized');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // In a real browser environment, we would use:
      // 1. File System Access API to read the file
      // 2. sql.js or better-sqlite3-wasm to load the SQLite database
      // For now, we'll show how to integrate it:

      console.log(`[FXD Adapter] Loading disk: ${filePath}`);

      // Example: Load with sql.js (would need to be imported)
      // const SQL = await initSqlJs();
      // const fileBuffer = await fs.readFile(filePath);
      // const db = new SQL.Database(fileBuffer);

      // await adapter.loadFXDFile(filePath, db);
      // setCurrentDisk(filePath);
      // await syncAdapterToVisualizer(adapter);

      // For demo purposes, show message
      alert(`FXD file loading requires:\n1. File System Access API\n2. sql.js or better-sqlite3-wasm\n\nIntegration point ready at:\nFXDAdapter.loadFXDFile()`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disk');
    } finally {
      setLoading(false);
    }
  }, [adapter, syncAdapterToVisualizer]);

  // Create new FXD file
  const handleCreateDisk = useCallback(async (name: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`[FXD Adapter] Creating disk: ${name}`);

      // Example: Create with sql.js
      // const SQL = await initSqlJs();
      // const db = new SQL.Database();
      // await FXDAdapter.createFXDFile(name, db);

      alert(`FXD file creation requires:\n1. File System Access API\n2. sql.js or better-sqlite3-wasm\n\nIntegration point ready at:\nFXDAdapter.createFXDFile()`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create disk');
    } finally {
      setLoading(false);
    }
  }, []);

  // Unload current disk
  const handleUnloadDisk = useCallback(() => {
    if (adapter) {
      adapter.dispose();
      setCurrentDisk(null);
      setGraph({
        nodes: new Map(),
        connections: new Map(),
        layers: new Map(),
      });
    }
  }, [adapter, setGraph]);

  // Bind nodes
  const handleBindNodes = useCallback(async (
    sourceId: string,
    targetId: string,
    config: BindingConfig
  ) => {
    console.log('[Node Binder] Binding nodes:', { sourceId, targetId, config });

    // In a real implementation, this would:
    // 1. Create an FX atomics binding if config.atomics.enabled
    // 2. Set up transform function if config.type === 'transform'
    // 3. Configure debounce/throttle
    // 4. Update the database

    alert(`Node binding configured:\nSource: ${sourceId}\nTarget: ${targetId}\nType: ${config.type}\n\nIntegration point ready!`);
  }, []);

  // Unbind nodes
  const handleUnbindNodes = useCallback(async (sourceId: string, targetId: string) => {
    console.log('[Node Binder] Unbinding nodes:', { sourceId, targetId });
    alert(`Unbinding: ${sourceId} -> ${targetId}\n\nIntegration point ready!`);
  }, []);

  // Get nodes for NodeBinder
  const getNodesArray = useCallback(() => {
    const { graph } = useVisualizerStore.getState();
    return Array.from(graph.nodes.values());
  }, []);

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
        togglePanel('inspector');
      }

      // Ctrl+Shift+C: Toggle console
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        togglePanel('console');
      }

      // Ctrl+Shift+P: Toggle metrics
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        togglePanel('metrics');
      }

      // Ctrl+Shift+D: Toggle disk manager
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        togglePanel('diskmanager');
      }

      // Ctrl+Shift+B: Toggle node binder
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        togglePanel('nodebinder');
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
          applyCameraPreset(presetNames[index]);
          console.log(`[FX Visualizer] Applied camera preset: ${presetNames[index]}`);
        }
      }

      // Space: Play/Pause timeline
      if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (timeline.playing) {
          pauseTimeline();
        } else {
          playTimeline();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, timeline, playTimeline, pauseTimeline, applyCameraPreset]);

  const inspectorPanel = panels.get('inspector');
  const timelinePanel = panels.get('timeline');
  const consolePanel = panels.get('console');
  const metricsPanel = panels.get('metrics');
  const diskManagerPanel = panels.get('diskmanager');
  const nodeBinderPanel = panels.get('nodebinder');

  return (
    <div className="w-screen h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Error bar */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-500 px-4 py-2 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left sidebar - Disk Manager */}
        {diskManagerPanel?.visible && (
          <div
            className="glass-dark border-r border-white/10 overflow-auto"
            style={{ width: diskManagerPanel.width || 350 }}
          >
            <DiskManager
              onLoadDisk={handleLoadDisk}
              onCreateDisk={handleCreateDisk}
              onUnloadDisk={handleUnloadDisk}
              currentDisk={currentDisk}
            />
          </div>
        )}

        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Canvas3D />

          {/* Metrics overlay */}
          {metricsPanel?.visible && (
            <div className="absolute top-4 left-4 z-10">
              <Metrics />
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <div className="glass-dark p-4 rounded-lg flex items-center gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-golden border-t-transparent rounded-full" />
                <span>Loading FXD file...</span>
              </div>
            </div>
          )}

          {/* Quick actions overlay */}
          <div className="absolute bottom-4 left-4 flex gap-2 z-10">
            <button
              onClick={() => togglePanel('diskmanager')}
              className="glass-dark p-2 rounded hover:bg-white/10 transition"
              title="Disk Manager (Ctrl+Shift+D)"
            >
              <Database className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('nodebinder')}
              className="glass-dark p-2 rounded hover:bg-white/10 transition"
              title="Node Binder (Ctrl+Shift+B)"
            >
              <Link className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right sidebar - Inspector or Node Binder */}
        {(inspectorPanel?.visible || nodeBinderPanel?.visible) && (
          <div
            className="glass-dark border-l border-white/10 overflow-auto"
            style={{ width: (inspectorPanel?.visible ? inspectorPanel.width : nodeBinderPanel?.width) || 400 }}
          >
            {nodeBinderPanel?.visible ? (
              <NodeBinder
                nodes={getNodesArray()}
                onBind={handleBindNodes}
                onUnbind={handleUnbindNodes}
                selectedNodes={selection.selectedNodes}
              />
            ) : (
              <Inspector />
            )}
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
        FX Visualizer v1.0.0 + FXD Integration - The Matrix Meets Developer Tools
      </div>

      <style>{`
        .glass-dark {
          background: rgba(20, 20, 20, 0.8);
          backdrop-filter: blur(10px);
        }

        .border-golden {
          border-color: #d4af37;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default App;
