/**
 * FXD Quantum - Main Application Store
 * Zustand store for managing global application state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewType =
  | 'disks'
  | 'nodes'
  | 'files'
  | 'graph'
  | 'editor'
  | 'stats'
  | 'logs'
  | 'share';

export type BottomPanelTab = 'console' | 'terminal' | 'ai';

export type ThemeMode = 'dark' | 'light' | 'system';

export type GraphLayout = 'force' | 'hierarchical' | 'circular';

export interface Disk {
  id: string;
  name: string;
  path: string;
  mountPoint: string | null;
  isMounted: boolean;
  isLocal: boolean;
  nodeCount: number;
  fileCount: number;
  size: number;
  lastModified: Date;
  autoSync: boolean;
  syncInterval: number;
  metadata?: {
    description?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

export interface FXNode {
  id: string;
  path: string;
  type: string;
  value: any;
  parentId: string | null;
  children: string[];
  size: number;
  version: number;
  lastModified: Date;
  connections: Array<{
    targetId: string;
    type: 'parent' | 'reference' | 'entangled' | 'dataFlow';
  }>;
}

export interface FileItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  isModified: boolean;
}

export interface Signal {
  id: string;
  timestamp: Date;
  kind: 'VALUE' | 'CHILDREN' | 'METADATA' | 'PERSIST';
  nodePath: string;
  oldValue?: any;
  newValue?: any;
  changes?: any;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface AppState {
  // UI State
  activeView: ViewType;
  sidebarCollapsed: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  theme: ThemeMode;

  // Disks
  disks: Disk[];
  activeDiskId: string | null;
  mountedDisks: string[];

  // Nodes
  nodes: Map<string, FXNode>;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  expandedNodeIds: string[];

  // Files
  files: FileItem[];
  openFiles: string[];
  activeFilePath: string | null;
  unsavedChanges: Set<string>;

  // Graph
  graphLayout: GraphLayout;
  cameraPosition: [number, number, number];
  graphFilters: {
    showContainers: boolean;
    showData: boolean;
    showCode: boolean;
    showViews: boolean;
    showSignals: boolean;
  };

  // Signals
  signals: Signal[];
  signalFilters: {
    VALUE: boolean;
    CHILDREN: boolean;
    METADATA: boolean;
    PERSIST: boolean;
  };

  // Editor
  editorTheme: 'vs-dark' | 'vs-light';
  editorFontSize: number;

  // User & Auth
  user: User | null;
  isAuthenticated: boolean;

  // Modals
  modals: {
    createDisk: boolean;
    mountDisk: boolean;
    nodeBinding: boolean;
    settings: boolean;
    onboarding: boolean;
  };

  // Quick Switcher
  quickSwitcherOpen: boolean;
  commandPaletteOpen: boolean;

  // Performance
  showPerformanceOverlay: boolean;
  showMinimap: boolean;

  // Settings
  autoSync: boolean;
  syncInterval: number;
  animationSpeed: number;
  enableSounds: boolean;

  // Actions - UI
  setActiveView: (view: ViewType) => void;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setTheme: (theme: ThemeMode) => void;

  // Actions - Disks
  addDisk: (disk: Disk) => void;
  removeDisk: (diskId: string) => void;
  setActiveDisk: (diskId: string | null) => void;
  mountDisk: (diskId: string, mountPoint: string) => void;
  unmountDisk: (diskId: string) => void;
  updateDisk: (diskId: string, updates: Partial<Disk>) => void;

  // Actions - Nodes
  setNodes: (nodes: Map<string, FXNode>) => void;
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  toggleNodeExpanded: (nodeId: string) => void;

  // Actions - Files
  setFiles: (files: FileItem[]) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  markFileAsUnsaved: (path: string) => void;
  markFileAsSaved: (path: string) => void;

  // Actions - Graph
  setGraphLayout: (layout: GraphLayout) => void;
  setCameraPosition: (position: [number, number, number]) => void;
  updateGraphFilters: (filters: Partial<AppState['graphFilters']>) => void;

  // Actions - Signals
  addSignal: (signal: Signal) => void;
  clearSignals: () => void;
  updateSignalFilters: (filters: Partial<AppState['signalFilters']>) => void;

  // Actions - Modals
  openModal: (modal: keyof AppState['modals']) => void;
  closeModal: (modal: keyof AppState['modals']) => void;

  // Actions - Quick Actions
  toggleQuickSwitcher: () => void;
  toggleCommandPalette: () => void;

  // Actions - Settings
  updateSettings: (settings: Partial<Pick<AppState, 'autoSync' | 'syncInterval' | 'animationSpeed' | 'enableSounds'>>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial UI State
      activeView: 'disks',
      sidebarCollapsed: false,
      bottomPanelOpen: false,
      bottomPanelTab: 'console',
      theme: 'dark',

      // Initial Disks
      disks: [],
      activeDiskId: null,
      mountedDisks: [],

      // Initial Nodes
      nodes: new Map(),
      selectedNodeIds: [],
      hoveredNodeId: null,
      expandedNodeIds: [],

      // Initial Files
      files: [],
      openFiles: [],
      activeFilePath: null,
      unsavedChanges: new Set(),

      // Initial Graph
      graphLayout: 'force',
      cameraPosition: [0, 100, 200],
      graphFilters: {
        showContainers: true,
        showData: true,
        showCode: true,
        showViews: true,
        showSignals: true,
      },

      // Initial Signals
      signals: [],
      signalFilters: {
        VALUE: true,
        CHILDREN: true,
        METADATA: false,
        PERSIST: true,
      },

      // Initial Editor
      editorTheme: 'vs-dark',
      editorFontSize: 14,

      // Initial User
      user: null,
      isAuthenticated: false,

      // Initial Modals
      modals: {
        createDisk: false,
        mountDisk: false,
        nodeBinding: false,
        settings: false,
        onboarding: true, // Show on first launch
      },

      // Initial Quick Actions
      quickSwitcherOpen: false,
      commandPaletteOpen: false,

      // Initial Performance
      showPerformanceOverlay: false,
      showMinimap: true,

      // Initial Settings
      autoSync: true,
      syncInterval: 500,
      animationSpeed: 1,
      enableSounds: false,

      // UI Actions
      setActiveView: (view) => set({ activeView: view }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
      setTheme: (theme) => set({ theme }),

      // Disk Actions
      addDisk: (disk) => set((state) => ({ disks: [...state.disks, disk] })),
      removeDisk: (diskId) => set((state) => ({
        disks: state.disks.filter((d) => d.id !== diskId),
        activeDiskId: state.activeDiskId === diskId ? null : state.activeDiskId,
      })),
      setActiveDisk: (diskId) => set({ activeDiskId: diskId }),
      mountDisk: (diskId, mountPoint) => set((state) => ({
        disks: state.disks.map((d) =>
          d.id === diskId ? { ...d, isMounted: true, mountPoint } : d
        ),
        mountedDisks: [...state.mountedDisks, diskId],
      })),
      unmountDisk: (diskId) => set((state) => ({
        disks: state.disks.map((d) =>
          d.id === diskId ? { ...d, isMounted: false, mountPoint: null } : d
        ),
        mountedDisks: state.mountedDisks.filter((id) => id !== diskId),
      })),
      updateDisk: (diskId, updates) => set((state) => ({
        disks: state.disks.map((d) => (d.id === diskId ? { ...d, ...updates } : d)),
      })),

      // Node Actions
      setNodes: (nodes) => set({ nodes }),
      selectNode: (nodeId, multiSelect = false) => set((state) => ({
        selectedNodeIds: multiSelect
          ? [...state.selectedNodeIds, nodeId]
          : [nodeId],
      })),
      deselectNode: (nodeId) => set((state) => ({
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
      })),
      clearSelection: () => set({ selectedNodeIds: [] }),
      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
      toggleNodeExpanded: (nodeId) => set((state) => ({
        expandedNodeIds: state.expandedNodeIds.includes(nodeId)
          ? state.expandedNodeIds.filter((id) => id !== nodeId)
          : [...state.expandedNodeIds, nodeId],
      })),

      // File Actions
      setFiles: (files) => set({ files }),
      openFile: (path) => set((state) => ({
        openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path],
        activeFilePath: path,
      })),
      closeFile: (path) => set((state) => ({
        openFiles: state.openFiles.filter((p) => p !== path),
        activeFilePath: state.activeFilePath === path ? null : state.activeFilePath,
        unsavedChanges: new Set([...state.unsavedChanges].filter((p) => p !== path)),
      })),
      setActiveFile: (path) => set({ activeFilePath: path }),
      markFileAsUnsaved: (path) => set((state) => ({
        unsavedChanges: new Set([...state.unsavedChanges, path]),
      })),
      markFileAsSaved: (path) => set((state) => {
        const newUnsaved = new Set(state.unsavedChanges);
        newUnsaved.delete(path);
        return { unsavedChanges: newUnsaved };
      }),

      // Graph Actions
      setGraphLayout: (layout) => set({ graphLayout: layout }),
      setCameraPosition: (position) => set({ cameraPosition: position }),
      updateGraphFilters: (filters) => set((state) => ({
        graphFilters: { ...state.graphFilters, ...filters },
      })),

      // Signal Actions
      addSignal: (signal) => set((state) => ({
        signals: [signal, ...state.signals].slice(0, 1000), // Keep last 1000
      })),
      clearSignals: () => set({ signals: [] }),
      updateSignalFilters: (filters) => set((state) => ({
        signalFilters: { ...state.signalFilters, ...filters },
      })),

      // Modal Actions
      openModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: true },
      })),
      closeModal: (modal) => set((state) => ({
        modals: { ...state.modals, [modal]: false },
      })),

      // Quick Action Toggles
      toggleQuickSwitcher: () => set((state) => ({ quickSwitcherOpen: !state.quickSwitcherOpen })),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      // Settings Actions
      updateSettings: (settings) => set(settings),
    }),
    {
      name: 'fxd-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        graphLayout: state.graphLayout,
        editorTheme: state.editorTheme,
        editorFontSize: state.editorFontSize,
        autoSync: state.autoSync,
        syncInterval: state.syncInterval,
        animationSpeed: state.animationSpeed,
        enableSounds: state.enableSounds,
        showPerformanceOverlay: state.showPerformanceOverlay,
        showMinimap: state.showMinimap,
      }),
    }
  )
);
