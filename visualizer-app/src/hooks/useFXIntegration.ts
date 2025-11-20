/**
 * FX Integration Hook
 * Connects the visualizer to the FX framework and syncs reactive state
 */

import { useEffect, useRef, useCallback } from 'react';
import { useVisualizerStore } from '@/core/store';
import type {
  FXCore,
  FXNode,
  VisualizerNode,
  VisualizerConnection,
  NodeType,
  NodeState,
  DataType,
  LayerType,
} from '@/types';
import * as THREE from 'three';
import { nanoid } from 'nanoid';

interface FXIntegrationOptions {
  autoSync?: boolean;
  syncInterval?: number;
  maxNodes?: number;
  trackPerformance?: boolean;
}

const defaultOptions: FXIntegrationOptions = {
  autoSync: true,
  syncInterval: 100,
  maxNodes: 10000,
  trackPerformance: true,
};

/**
 * Determine node type from FX node
 */
function getNodeType(fxNode: FXNode): NodeType {
  // Check for specific patterns
  if (fxNode.__effects && fxNode.__effects.length > 0) return 'effect';
  if (fxNode.__watchers && fxNode.__watchers.size > 0) return 'computed';
  if (fxNode.__id.includes('component')) return 'component';
  if (fxNode.__id.includes('worker')) return 'worker';
  if (fxNode.__id.includes('http') || fxNode.__id.includes('api')) return 'http';
  if (fxNode.__id.includes('ws') || fxNode.__id.includes('socket')) return 'websocket';
  if (fxNode.__id.includes('wasm')) return 'wasm';

  return 'data';
}

/**
 * Determine layer from FX node
 */
function getNodeLayer(fxNode: FXNode): LayerType {
  const id = fxNode.__id.toLowerCase();

  if (id.includes('time') || id.includes('snapshot')) return 'timetravel';
  if (id.includes('wasm')) return 'wasm';
  if (id.includes('server') || id.includes('api')) return 'server';
  if (id.includes('http') || id.includes('ws') || id.includes('socket')) return 'network';
  if (id.includes('worker')) return 'worker';
  if (id.includes('component') || id.includes('react')) return 'component';
  if (id.includes('dom') || id.includes('ui')) return 'dom';

  return 'core';
}

/**
 * Get data type from value
 */
function getDataType(value: any): DataType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';

  const type = typeof value;
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'function':
      return 'function';
    case 'object':
      return 'object';
    default:
      return 'undefined';
  }
}

/**
 * Convert FX node to visualizer node
 */
function fxNodeToVisualizerNode(fxNode: FXNode, index: number): VisualizerNode {
  const type = getNodeType(fxNode);
  const layer = getNodeLayer(fxNode);
  const layerIndex = ['core', 'dom', 'component', 'worker', 'network', 'server', 'wasm', 'timetravel'].indexOf(layer);

  return {
    id: fxNode.__id,
    fxNode,
    type,
    state: 'idle',
    dataType: getDataType(fxNode.__value),
    layer,
    position: new THREE.Vector3(
      Math.random() * 1000 - 500,
      layerIndex * 100,
      Math.random() * 1000 - 500
    ),
    velocity: new THREE.Vector3(0, 0, 0),
    value: fxNode.__value,
    updateCount: 0,
    updateFrequency: 0,
    lastUpdate: Date.now(),
    errors: [],
    isWatched: (fxNode.__watchers?.size || 0) > 0,
    isFrozen: false,
    metadata: {
      hasEffects: (fxNode.__effects?.length || 0) > 0,
      effectCount: fxNode.__effects?.length || 0,
      watcherCount: fxNode.__watchers?.size || 0,
      childCount: fxNode.__nodes ? Object.keys(fxNode.__nodes).length : 0,
    },
  };
}

/**
 * Main FX integration hook
 */
export function useFXIntegration(fx: FXCore, options: FXIntegrationOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nodeMapRef = useRef<Map<string, VisualizerNode>>(new Map());
  const updateCountsRef = useRef<Map<string, number[]>>(new Map());

  const {
    setGraph,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    updateMetrics,
  } = useVisualizerStore();

  /**
   * Scan FX tree and build graph
   */
  const scanFXTree = useCallback((node: FXNode, visited: Set<string> = new Set()): void => {
    if (visited.has(node.__id)) return;
    visited.add(node.__id);

    if (nodeMapRef.current.size >= opts.maxNodes!) {
      console.warn('[FX Visualizer] Max nodes reached, stopping scan');
      return;
    }

    // Create or update visualizer node
    let vizNode = nodeMapRef.current.get(node.__id);
    if (!vizNode) {
      vizNode = fxNodeToVisualizerNode(node, nodeMapRef.current.size);
      nodeMapRef.current.set(node.__id, vizNode);
      addNode(vizNode);
    } else {
      // Update existing node
      const currentValue = fx.val(node);
      if (currentValue !== vizNode.value) {
        const now = Date.now();
        const timeDiff = (now - vizNode.lastUpdate) / 1000; // in seconds

        // Update frequency tracking
        const counts = updateCountsRef.current.get(node.__id) || [];
        counts.push(now);
        // Keep only last 10 seconds of updates
        const recentCounts = counts.filter((t) => now - t < 10000);
        updateCountsRef.current.set(node.__id, recentCounts);

        const updateFrequency = recentCounts.length / 10; // updates per second

        updateNode(node.__id, {
          value: currentValue,
          dataType: getDataType(currentValue),
          updateCount: vizNode.updateCount + 1,
          updateFrequency,
          lastUpdate: now,
          state: 'active',
        });

        // Reset to idle after animation
        setTimeout(() => {
          updateNode(node.__id, { state: 'idle' });
        }, 500);
      }
    }

    // Create connections to children
    if (node.__nodes) {
      Object.entries(node.__nodes).forEach(([key, childNode]) => {
        const connId = `${node.__id}--${childNode.__id}`;

        // Check if connection exists
        const { connections } = useVisualizerStore.getState().graph;
        if (!connections.has(connId)) {
          const connection: VisualizerConnection = {
            id: connId,
            source: node.__id,
            target: childNode.__id,
            type: 'dependency',
            strength: 1,
            dataFlow: [],
            lastTransfer: Date.now(),
            color: '#3498db',
          };
          addConnection(connection);
        }

        // Recursively scan children
        scanFXTree(childNode, visited);
      });
    }
  }, [fx, addNode, updateNode, addConnection, opts.maxNodes]);

  /**
   * Sync FX tree with visualizer
   */
  const sync = useCallback(() => {
    try {
      const startTime = performance.now();

      scanFXTree(fx.root);

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Update metrics
      const { nodes, connections } = useVisualizerStore.getState().graph;
      updateMetrics({
        nodeCount: nodes.size,
        connectionCount: connections.size,
        updateTime,
      });
    } catch (error) {
      console.error('[FX Visualizer] Sync error:', error);
    }
  }, [fx, scanFXTree, updateMetrics]);

  /**
   * Watch FX node for changes
   */
  const watchNode = useCallback((nodeId: string) => {
    const node = fx.resolvePath(nodeId, fx.root);
    if (!node) return;

    const proxy = fx.createNodeProxy(node);
    if (proxy && typeof proxy.watch === 'function') {
      return proxy.watch((newValue: any) => {
        updateNode(nodeId, {
          value: newValue,
          dataType: getDataType(newValue),
          lastUpdate: Date.now(),
          state: 'active',
        });

        setTimeout(() => {
          updateNode(nodeId, { state: 'idle' });
        }, 500);
      });
    }
  }, [fx, updateNode]);

  /**
   * Initial sync and setup
   */
  useEffect(() => {
    console.log('[FX Visualizer] Initializing FX integration');

    // Initial sync
    sync();

    // Setup auto-sync
    if (opts.autoSync) {
      syncIntervalRef.current = setInterval(sync, opts.syncInterval!);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [fx, sync, opts.autoSync, opts.syncInterval]);

  /**
   * Performance tracking
   */
  useEffect(() => {
    if (!opts.trackPerformance) return;

    let frameCount = 0;
    let lastTime = performance.now();

    const updateFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        const fps = Math.round((frameCount * 1000) / delta);
        updateMetrics({ fps });

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(updateFPS);
    };

    const rafId = requestAnimationFrame(updateFPS);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [opts.trackPerformance, updateMetrics]);

  return {
    sync,
    watchNode,
    nodeMap: nodeMapRef.current,
  };
}
