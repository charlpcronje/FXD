/**
 * FX Visualizer - Central State Store (Zustand)
 * Manages all visualizer state with reactive updates
 */

import { create } from 'zustand';
import type {
  VisualizerStore,
  GraphData,
  VisualizerNode,
  VisualizerConnection,
  SelectionState,
  FilterOptions,
  LayoutOptions,
  CameraState,
  CameraPreset,
  Timeline,
  Snapshot,
  PerformanceMetrics,
  InspectorData,
  ToolbarState,
  PanelState,
  VisualizerSettings,
  NodeType,
  LayerType,
  NodeState,
} from '@/types';
import * as THREE from 'three';

const initialGraph: GraphData = {
  nodes: new Map(),
  connections: new Map(),
  layers: new Map([
    ['core', new Set()],
    ['dom', new Set()],
    ['component', new Set()],
    ['worker', new Set()],
    ['network', new Set()],
    ['server', new Set()],
    ['wasm', new Set()],
    ['timetravel', new Set()],
  ]),
};

const initialSelection: SelectionState = {
  selectedNodes: new Set(),
  hoveredNode: null,
  selectionBox: null,
};

const initialFilters: FilterOptions = {
  nodeTypes: new Set<NodeType>([
    'data',
    'effect',
    'component',
    'event',
    'computed',
    'async',
    'worker',
    'http',
    'websocket',
    'wasm',
  ]),
  layers: new Set<LayerType>([
    'core',
    'dom',
    'component',
    'worker',
    'network',
    'server',
    'wasm',
    'timetravel',
  ]),
  states: new Set<NodeState>(['idle', 'active', 'success', 'error', 'warning', 'suspended', 'cached']),
  search: '',
};

const initialLayout: LayoutOptions = {
  algorithm: 'force',
  spacing: 100,
  layerSpacing: 200,
  iterations: 300,
  enablePhysics: true,
};

const initialCamera: CameraState = {
  position: new THREE.Vector3(0, 500, 1000),
  target: new THREE.Vector3(0, 0, 0),
  zoom: 1,
  rotation: new THREE.Euler(0, 0, 0),
};

const defaultCameraPresets: CameraPreset[] = [
  {
    name: 'Default',
    position: new THREE.Vector3(0, 500, 1000),
    target: new THREE.Vector3(0, 0, 0),
    description: 'Default isometric view',
  },
  {
    name: 'Top',
    position: new THREE.Vector3(0, 1500, 0),
    target: new THREE.Vector3(0, 0, 0),
    description: 'Top-down view',
  },
  {
    name: 'Side',
    position: new THREE.Vector3(1500, 0, 0),
    target: new THREE.Vector3(0, 0, 0),
    description: 'Side view',
  },
  {
    name: 'Front',
    position: new THREE.Vector3(0, 0, 1500),
    target: new THREE.Vector3(0, 0, 0),
    description: 'Front view',
  },
  {
    name: 'Layers',
    position: new THREE.Vector3(500, 300, 800),
    target: new THREE.Vector3(0, 300, 0),
    description: 'View all layers',
  },
];

const initialTimeline: Timeline = {
  snapshots: [],
  currentIndex: 0,
  playing: false,
  playbackSpeed: 1,
};

const initialMetrics: PerformanceMetrics = {
  fps: 60,
  nodeCount: 0,
  connectionCount: 0,
  updateRate: 0,
  memoryUsage: 0,
  renderTime: 0,
  updateTime: 0,
};

const initialInspector: InspectorData = {
  node: null,
  expanded: new Set(),
};

const initialToolbar: ToolbarState = {
  selectedTool: 'select',
  tools: new Map(),
};

const initialSettings: VisualizerSettings = {
  theme: 'dark',
  showGrid: true,
  showLabels: true,
  showStats: true,
  enablePhysics: true,
  enableAnimations: true,
  particleEffects: true,
  lodEnabled: true,
  maxNodes: 10000,
  renderQuality: 'high',
};

/**
 * Main visualizer store
 */
export const useVisualizerStore = create<VisualizerStore>((set, get) => ({
  // Graph state
  graph: initialGraph,

  setGraph: (graph) => set({ graph }),

  updateNode: (id, updates) =>
    set((state) => {
      const node = state.graph.nodes.get(id);
      if (!node) return state;

      const updatedNode = { ...node, ...updates };
      const newNodes = new Map(state.graph.nodes);
      newNodes.set(id, updatedNode);

      return {
        graph: {
          ...state.graph,
          nodes: newNodes,
        },
      };
    }),

  addNode: (node) =>
    set((state) => {
      const newNodes = new Map(state.graph.nodes);
      newNodes.set(node.id, node);

      const newLayers = new Map(state.graph.layers);
      const layerSet = new Set(newLayers.get(node.layer) || []);
      layerSet.add(node.id);
      newLayers.set(node.layer, layerSet);

      return {
        graph: {
          ...state.graph,
          nodes: newNodes,
          layers: newLayers,
        },
      };
    }),

  removeNode: (id) =>
    set((state) => {
      const node = state.graph.nodes.get(id);
      if (!node) return state;

      const newNodes = new Map(state.graph.nodes);
      newNodes.delete(id);

      const newLayers = new Map(state.graph.layers);
      const layerSet = new Set(newLayers.get(node.layer) || []);
      layerSet.delete(id);
      newLayers.set(node.layer, layerSet);

      // Remove associated connections
      const newConnections = new Map(state.graph.connections);
      Array.from(newConnections.entries()).forEach(([connId, conn]) => {
        if (conn.source === id || conn.target === id) {
          newConnections.delete(connId);
        }
      });

      return {
        graph: {
          ...state.graph,
          nodes: newNodes,
          layers: newLayers,
          connections: newConnections,
        },
      };
    }),

  addConnection: (connection) =>
    set((state) => {
      const newConnections = new Map(state.graph.connections);
      newConnections.set(connection.id, connection);

      return {
        graph: {
          ...state.graph,
          connections: newConnections,
        },
      };
    }),

  removeConnection: (id) =>
    set((state) => {
      const newConnections = new Map(state.graph.connections);
      newConnections.delete(id);

      return {
        graph: {
          ...state.graph,
          connections: newConnections,
        },
      };
    }),

  // Selection state
  selection: initialSelection,

  selectNode: (id, multi = false) =>
    set((state) => {
      const newSelected = multi
        ? new Set(state.selection.selectedNodes).add(id)
        : new Set([id]);

      return {
        selection: {
          ...state.selection,
          selectedNodes: newSelected,
        },
      };
    }),

  deselectNode: (id) =>
    set((state) => {
      const newSelected = new Set(state.selection.selectedNodes);
      newSelected.delete(id);

      return {
        selection: {
          ...state.selection,
          selectedNodes: newSelected,
        },
      };
    }),

  clearSelection: () =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedNodes: new Set(),
      },
    })),

  setHoveredNode: (id) =>
    set((state) => ({
      selection: {
        ...state.selection,
        hoveredNode: id,
      },
    })),

  // Filter state
  filters: initialFilters,

  setFilters: (filters) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...filters,
      },
    })),

  // Layout state
  layout: initialLayout,

  setLayout: (layout) =>
    set((state) => ({
      layout: {
        ...state.layout,
        ...layout,
      },
    })),

  triggerLayout: () => {
    // Trigger layout recalculation
    // This will be handled by the layout engine
  },

  // Camera state
  camera: initialCamera,
  cameraPresets: defaultCameraPresets,

  setCamera: (camera) =>
    set((state) => ({
      camera: {
        ...state.camera,
        ...camera,
      },
    })),

  applyCameraPreset: (name) =>
    set((state) => {
      const preset = state.cameraPresets.find((p) => p.name === name);
      if (!preset) return state;

      return {
        camera: {
          ...state.camera,
          position: preset.position.clone(),
          target: preset.target.clone(),
        },
      };
    }),

  // Timeline state
  timeline: initialTimeline,

  createSnapshot: (description) =>
    set((state) => {
      const snapshot: Snapshot = {
        id: `snapshot_${Date.now()}`,
        timestamp: Date.now(),
        description,
        state: {
          graph: {
            nodes: Array.from(state.graph.nodes.entries()),
            connections: Array.from(state.graph.connections.entries()),
          },
        },
        metadata: {},
      };

      return {
        timeline: {
          ...state.timeline,
          snapshots: [...state.timeline.snapshots, snapshot],
          currentIndex: state.timeline.snapshots.length,
        },
      };
    }),

  restoreSnapshot: (id) =>
    set((state) => {
      const snapshot = state.timeline.snapshots.find((s) => s.id === id);
      if (!snapshot) return state;

      const restoredGraph: GraphData = {
        nodes: new Map(snapshot.state.graph.nodes),
        connections: new Map(snapshot.state.graph.connections),
        layers: new Map(state.graph.layers),
      };

      return {
        graph: restoredGraph,
        timeline: {
          ...state.timeline,
          currentIndex: state.timeline.snapshots.indexOf(snapshot),
        },
      };
    }),

  playTimeline: () =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        playing: true,
      },
    })),

  pauseTimeline: () =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        playing: false,
      },
    })),

  setPlaybackSpeed: (speed) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        playbackSpeed: speed,
      },
    })),

  // Performance state
  metrics: initialMetrics,

  updateMetrics: (metrics) =>
    set((state) => ({
      metrics: {
        ...state.metrics,
        ...metrics,
      },
    })),

  // UI state
  inspector: initialInspector,

  setInspector: (data) =>
    set((state) => ({
      inspector: {
        ...state.inspector,
        ...data,
      },
    })),

  toolbar: initialToolbar,

  panels: new Map<string, PanelState>([
    ['inspector', { visible: true, width: 400, height: 0, position: 'right' }],
    ['timeline', { visible: true, width: 0, height: 200, position: 'bottom' }],
    ['console', { visible: false, width: 0, height: 300, position: 'bottom' }],
    ['metrics', { visible: true, width: 300, height: 200, position: 'top' }],
  ]),

  togglePanel: (id) =>
    set((state) => {
      const newPanels = new Map(state.panels);
      const panel = newPanels.get(id);
      if (panel) {
        newPanels.set(id, { ...panel, visible: !panel.visible });
      }
      return { panels: newPanels };
    }),

  // Settings
  settings: initialSettings,

  updateSettings: (settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
}));

/**
 * Selector hooks for performance
 */
export const useNodes = () => useVisualizerStore((state) => state.graph.nodes);
export const useConnections = () => useVisualizerStore((state) => state.graph.connections);
export const useSelectedNodes = () => useVisualizerStore((state) => state.selection.selectedNodes);
export const useHoveredNode = () => useVisualizerStore((state) => state.selection.hoveredNode);
export const useFilters = () => useVisualizerStore((state) => state.filters);
export const useLayout = () => useVisualizerStore((state) => state.layout);
export const useCamera = () => useVisualizerStore((state) => state.camera);
export const useTimeline = () => useVisualizerStore((state) => state.timeline);
export const useMetrics = () => useVisualizerStore((state) => state.metrics);
export const useSettings = () => useVisualizerStore((state) => state.settings);
