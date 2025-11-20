/**
 * FX Visualizer Demo Application
 * Interactive demonstration of the visualizer capabilities
 */

import type { FXCore, FXNode } from '../../src/types';

// Create mock FX instance for demo
const createDemoFX = (): FXCore => {
  const createNode = (parentId: string): FXNode => ({
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

  return {
    root,
    createNode,
    resolvePath: (path: string, root: FXNode) => {
      if (path === 'root') return root;
      const parts = path.split('.');
      let current: FXNode = root;

      for (const part of parts) {
        if (!current.__nodes || !current.__nodes[part]) return null;
        current = current.__nodes[part];
      }

      return current;
    },
    setPath: (path: string, value: any, root: FXNode) => {
      const parts = path.split('.');
      let current = root;

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
      if (!current.__nodes[lastPart]) {
        current.__nodes[lastPart] = createNode(current.__id);
        current.__nodes[lastPart].__id = path;
      }

      current.__nodes[lastPart].__value = value;
      return current.__nodes[lastPart];
    },
    val: (node: FXNode, defaultValue?: any) => {
      return node.__value !== undefined ? node.__value : defaultValue;
    },
    set: (node: FXNode, value: any) => {
      node.__value = value;
    },
    createNodeProxy: (node: FXNode) => ({
      __id: node.__id,
      val: () => node.__value,
      watch: (callback: Function) => {
        return () => {};
      },
    }),
  };
};

// Initialize demo
const fx = createDemoFX();

// Create initial demo nodes
const initializeDemoData = () => {
  // Application state
  fx.setPath('app.state.count', 0, fx.root);
  fx.setPath('app.state.user', { name: 'Demo User', id: 1 }, fx.root);
  fx.setPath('app.state.items', ['item1', 'item2', 'item3'], fx.root);

  // Components
  fx.setPath('app.components.header', { mounted: true }, fx.root);
  fx.setPath('app.components.sidebar', { mounted: true }, fx.root);
  fx.setPath('app.components.content', { mounted: true }, fx.root);

  // Actions
  fx.setPath('app.actions.increment', () => {}, fx.root);
  fx.setPath('app.actions.decrement', () => {}, fx.root);
  fx.setPath('app.actions.reset', () => {}, fx.root);

  // API endpoints
  fx.setPath('app.api.users', { endpoint: '/api/users' }, fx.root);
  fx.setPath('app.api.posts', { endpoint: '/api/posts' }, fx.root);

  console.log('[Demo] Initial data loaded');
};

initializeDemoData();

// Demo control functions
let nodeCounter = 0;

const addRandomNode = () => {
  nodeCounter++;
  const types = ['state', 'component', 'action', 'api', 'worker'];
  const type = types[Math.floor(Math.random() * types.length)];
  const path = `app.${type}.random${nodeCounter}`;

  const values: Record<string, any> = {
    state: Math.random() * 100,
    component: { mounted: true, props: {} },
    action: () => {},
    api: { endpoint: `/api/random${nodeCounter}` },
    worker: { status: 'idle' },
  };

  fx.setPath(path, values[type], fx.root);
  console.log('[Demo] Added node:', path);

  // Update UI
  document.getElementById('node-count')!.textContent = String(nodeCounter);
};

const updateRandomNode = () => {
  const paths = getAllNodePaths(fx.root);
  if (paths.length === 0) return;

  const randomPath = paths[Math.floor(Math.random() * paths.length)];
  const node = fx.resolvePath(randomPath, fx.root);

  if (node) {
    const newValue = Math.random() * 100;
    fx.set(node, newValue);
    console.log('[Demo] Updated node:', randomPath, '=', newValue);
  }
};

const getAllNodePaths = (node: FXNode, prefix = ''): string[] => {
  const paths: string[] = [];

  if (prefix && node.__id !== 'root') {
    paths.push(node.__id);
  }

  if (node.__nodes) {
    Object.keys(node.__nodes).forEach((key) => {
      paths.push(...getAllNodePaths(node.__nodes![key], prefix ? `${prefix}.${key}` : key));
    });
  }

  return paths;
};

const createSnapshot = () => {
  console.log('[Demo] Creating snapshot...');
  // This will be implemented by the visualizer
  alert('Snapshot created! (Feature coming in visualizer integration)');
};

const clearGraph = () => {
  if (confirm('Clear all nodes?')) {
    fx.root.__nodes = {};
    nodeCounter = 0;
    initializeDemoData();
    console.log('[Demo] Graph cleared and reset');
  }
};

const applyPreset = (index: string) => {
  const presets = ['Default', 'Top', 'Side', 'Front', 'Layers'];
  console.log('[Demo] Applying camera preset:', presets[parseInt(index)]);
};

const changeLayout = (algorithm: string) => {
  console.log('[Demo] Changing layout algorithm to:', algorithm);
};

const setNodeCount = (count: string) => {
  const target = parseInt(count);
  const current = getAllNodePaths(fx.root).length;

  if (target > current) {
    // Add nodes
    for (let i = current; i < target; i++) {
      addRandomNode();
    }
  } else if (target < current) {
    // Remove nodes (simplified for demo)
    console.log('[Demo] Removing nodes to reach target:', target);
  }

  document.getElementById('node-count')!.textContent = count;
};

// Expose functions globally for HTML onclick handlers
(window as any).addRandomNode = addRandomNode;
(window as any).updateRandomNode = updateRandomNode;
(window as any).createSnapshot = createSnapshot;
(window as any).clearGraph = clearGraph;
(window as any).applyPreset = applyPreset;
(window as any).changeLayout = changeLayout;
(window as any).setNodeCount = setNodeCount;

// Simulate live updates
setInterval(() => {
  if (Math.random() > 0.7) {
    updateRandomNode();
  }
}, 2000);

// Update stats (mock)
setInterval(() => {
  const fps = 55 + Math.random() * 10;
  const nodes = getAllNodePaths(fx.root).length;
  const updates = Math.floor(Math.random() * 20);

  document.getElementById('fps')!.textContent = Math.round(fps).toString();
  document.getElementById('nodes')!.textContent = nodes.toString();
  document.getElementById('connections')!.textContent = Math.max(0, nodes - 1).toString();
  document.getElementById('updates')!.textContent = updates.toString();
}, 1000);

console.log('[Demo] FX Visualizer demo initialized');
console.log('[Demo] Try the controls or use keyboard shortcuts!');
