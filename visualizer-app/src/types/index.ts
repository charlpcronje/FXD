/**
 * FX Visualizer - Type Definitions
 * Complete type system for the visualizer
 */

import type * as THREE from 'three';

// ============================================================================
// FX Core Types
// ============================================================================

export interface FXNode {
  __id: string;
  __parent_id: string | null;
  __type: string | null;
  __proto: string[];
  __value?: any;
  __nodes?: Record<string, FXNode>;
  __effects?: Function[];
  __watchers?: Set<(value: any) => void>;
  __behaviors?: Map<string, any>;
  __instances?: Map<string, any>;
}

export interface FXCore {
  root: FXNode;
  createNode(parentId: string): FXNode;
  resolvePath(path: string, root: FXNode): FXNode | null;
  setPath(path: string, value: any, root: FXNode): FXNode;
  val(node: FXNode, defaultValue?: any): any;
  set(node: FXNode, value: any): void;
  createNodeProxy(node: FXNode): any;
}

// ============================================================================
// Visualizer Node Types
// ============================================================================

export type NodeType =
  | 'data'
  | 'effect'
  | 'component'
  | 'event'
  | 'computed'
  | 'async'
  | 'worker'
  | 'http'
  | 'websocket'
  | 'wasm';

export type NodeState =
  | 'idle'
  | 'active'
  | 'success'
  | 'error'
  | 'warning'
  | 'suspended'
  | 'cached';

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'function'
  | 'null'
  | 'undefined';

export type LayerType =
  | 'core'          // Layer 0: Core FX Nodes
  | 'dom'           // Layer 1: DOM / UI Layer
  | 'component'     // Layer 2: React/Component Layer
  | 'worker'        // Layer 3: Web Workers
  | 'network'       // Layer 4: Network (HTTP/WS)
  | 'server'        // Layer 5: Server / Backend
  | 'wasm'          // Layer 6: WASM / Native
  | 'timetravel';   // Layer 7: Time Travel / Recording

// ============================================================================
// Graph Types
// ============================================================================

export interface VisualizerNode {
  id: string;
  fxNode: FXNode;
  type: NodeType;
  state: NodeState;
  dataType: DataType;
  layer: LayerType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  value: any;
  updateCount: number;
  updateFrequency: number;
  lastUpdate: number;
  errors: Error[];
  isWatched: boolean;
  isFrozen: boolean;
  metadata: Record<string, any>;
}

export interface VisualizerConnection {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'data' | 'event' | 'http' | 'websocket';
  strength: number;
  dataFlow: any[];
  lastTransfer: number;
  color: string;
}

export interface GraphData {
  nodes: Map<string, VisualizerNode>;
  connections: Map<string, VisualizerConnection>;
  layers: Map<LayerType, Set<string>>;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface LayoutOptions {
  algorithm: 'force' | 'dagre' | 'hierarchical' | 'circular' | 'custom';
  spacing: number;
  layerSpacing: number;
  iterations: number;
  enablePhysics: boolean;
}

export interface ForceConfig {
  charge: number;
  link: number;
  collision: number;
  center: number;
}

// ============================================================================
// Rendering Types
// ============================================================================

export interface NodeGeometry {
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'octahedron' | 'custom';
  size: number;
  color: string;
  opacity: number;
  wireframe: boolean;
  emissive: string;
  emissiveIntensity: number;
}

export interface ConnectionGeometry {
  type: 'line' | 'curve' | 'tube' | 'custom';
  width: number;
  color: string;
  opacity: number;
  animated: boolean;
  particleCount: number;
}

// ============================================================================
// Time Travel Types
// ============================================================================

export interface Snapshot {
  id: string;
  timestamp: number;
  description: string;
  state: any;
  metadata: Record<string, any>;
}

export interface Timeline {
  snapshots: Snapshot[];
  currentIndex: number;
  playing: boolean;
  playbackSpeed: number;
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  nodeCount: number;
  connectionCount: number;
  updateRate: number;
  memoryUsage: number;
  renderTime: number;
  updateTime: number;
}

export interface NodePerformance {
  nodeId: string;
  executionTime: number;
  memoryUsage: number;
  updateCount: number;
  errorCount: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface FilterOptions {
  nodeTypes: Set<NodeType>;
  layers: Set<LayerType>;
  states: Set<NodeState>;
  search: string;
  customFilter?: (node: VisualizerNode) => boolean;
}

// ============================================================================
// Camera Types
// ============================================================================

export interface CameraPreset {
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
  description: string;
}

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  rotation: THREE.Euler;
}

// ============================================================================
// UI Types
// ============================================================================

export interface InspectorData {
  node: VisualizerNode | null;
  expanded: Set<string>;
}

export interface ToolbarState {
  selectedTool: string;
  tools: Map<string, ToolConfig>;
}

export interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  action: () => void;
}

export interface PanelState {
  visible: boolean;
  width: number;
  height: number;
  position: 'left' | 'right' | 'top' | 'bottom';
}

// ============================================================================
// Selection Types
// ============================================================================

export interface SelectionState {
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  selectionBox: {
    start: THREE.Vector2;
    end: THREE.Vector2;
  } | null;
}

// ============================================================================
// Store Types (Zustand)
// ============================================================================

export interface VisualizerStore {
  // Graph state
  graph: GraphData;
  setGraph: (graph: GraphData) => void;
  updateNode: (id: string, updates: Partial<VisualizerNode>) => void;
  addNode: (node: VisualizerNode) => void;
  removeNode: (id: string) => void;
  addConnection: (connection: VisualizerConnection) => void;
  removeConnection: (id: string) => void;

  // Selection state
  selection: SelectionState;
  selectNode: (id: string, multi?: boolean) => void;
  deselectNode: (id: string) => void;
  clearSelection: () => void;
  setHoveredNode: (id: string | null) => void;

  // Filter state
  filters: FilterOptions;
  setFilters: (filters: Partial<FilterOptions>) => void;

  // Layout state
  layout: LayoutOptions;
  setLayout: (layout: Partial<LayoutOptions>) => void;
  triggerLayout: () => void;

  // Camera state
  camera: CameraState;
  setCamera: (camera: Partial<CameraState>) => void;
  cameraPresets: CameraPreset[];
  applyCameraPreset: (name: string) => void;

  // Timeline state
  timeline: Timeline;
  createSnapshot: (description: string) => void;
  restoreSnapshot: (id: string) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
  setPlaybackSpeed: (speed: number) => void;

  // Performance state
  metrics: PerformanceMetrics;
  updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;

  // UI state
  inspector: InspectorData;
  setInspector: (data: Partial<InspectorData>) => void;
  toolbar: ToolbarState;
  panels: Map<string, PanelState>;
  togglePanel: (id: string) => void;

  // Settings
  settings: VisualizerSettings;
  updateSettings: (settings: Partial<VisualizerSettings>) => void;
}

export interface VisualizerSettings {
  theme: 'dark' | 'light' | 'circuit';
  showGrid: boolean;
  showLabels: boolean;
  showStats: boolean;
  enablePhysics: boolean;
  enableAnimations: boolean;
  particleEffects: boolean;
  lodEnabled: boolean;
  maxNodes: number;
  renderQuality: 'low' | 'medium' | 'high' | 'ultra';
}

// ============================================================================
// Event Types
// ============================================================================

export interface NodeEvent {
  type: 'update' | 'create' | 'delete' | 'error';
  nodeId: string;
  timestamp: number;
  data?: any;
}

export interface ConnectionEvent {
  type: 'create' | 'delete' | 'transfer';
  connectionId: string;
  timestamp: number;
  data?: any;
}

// ============================================================================
// Color Scheme
// ============================================================================

export const COLOR_SCHEME = {
  // Node States
  idle: '#2c3e50',
  active: '#3498db',
  success: '#2ecc71',
  error: '#e74c3c',
  warning: '#f39c12',
  suspended: '#9b59b6',
  cached: '#1abc9c',

  // Data Types
  string: '#2ecc71',
  number: '#3498db',
  boolean: '#f39c12',
  object: '#9b59b6',
  array: '#e91e63',
  function: '#00bcd4',
  null: '#95a5a6',
  undefined: '#7f8c8d',

  // Special Nodes
  component: '#e67e22',
  worker: '#34495e',
  socket: '#16a085',
  http: '#8e44ad',
  wasm: '#c0392b',

  // Circuit Board
  board: '#1a3a1a',
  trace: '#d4af37',
  copper: '#b87333',
  solder: '#c0c0c0',
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
