# FXD - The Future of Code Organization

**Transform how you think about code. FXD turns your entire codebase into a living, breathing graph where every piece of code is a node you can version, visualize, and virtualize.**

## 🎯 What is FXD?

FXD (FX Disk) is a revolutionary code organization system that treats code as data nodes in a reactive graph. Instead of files and folders, you have **snippets** - stable, versioned pieces of code that can be:

- **Visualized** in 3D space
- **Versioned** individually with time-travel
- **Virtualized** as a filesystem
- **Collaborated** on in real-time

## 🚀 Quick Start

```bash
# Install FXD
deno install -A -n fxd https://fxd.dev/install.ts

# Create a new FXD project
fxd init my-project

# Mount as virtual drive (Windows: F:, Mac/Linux: /mnt/fxd)
fxd mount my-project.fxd

# Launch 3D visualizer
fxd visualize
```

## 🌟 Key Features

### 📦 Snippet-Based Architecture
Every piece of code is a **snippet** with:
- Stable ID that never changes
- Individual version history
- Rich metadata (tags, categories, language)
- Smart search and discovery
- Compilation and testing support

### 🎨 3D Visualization
See your entire codebase in 3D space:
- Nodes appear as shapes (spheres for functions, cubes for classes)
- Version history spirals around each node
- Drag to create groups and views
- Double-click to edit in VS Code
- Real-time collaboration with other users

### 💾 Virtual Filesystem
FXD files (.fxd) are SQLite databases that mount as drives:
- Windows: Choose any drive letter (F:, X:, etc.)
- macOS: Mounts to /Volumes/
- Linux: Mounts to /mnt/

Your code appears as normal files but is actually views over the node graph!

### ⏰ Time Travel & Versioning
Every node has its own Git-like history:
- Create branches per node
- Undo/redo changes
- Compare versions
- Merge branches
- Visual timeline in 3D space

### 👥 Real-Time Collaboration
Multiple users can edit the same project:
- See other users' cursors and selections
- Automatic conflict resolution
- Vector clocks for consistency
- Push changes to fxd.dev

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           3D Visualizer                 │
│  (Three.js + Version Timelines)         │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│           FXD Core                      │
│  (Snippets + Views + Groups)            │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│        FX Framework                     │
│  (Reactive Graph + Nodes)               │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     SQLite (.fxd files)                 │
│  RAMDisk ←→ Persistence                 │
└─────────────────────────────────────────┘
```

## 📚 Core Concepts

### Snippets
The atomic unit of code in FXD:
```typescript
const snippet = createSnippet({
    name: 'calculate-fibonacci',
    code: 'function fib(n) { ... }',
    tags: ['algorithm', 'math'],
    language: 'javascript'
});
```

### Views
Virtual files composed from snippets:
```typescript
const view = createView({
    name: 'math-utils.js',
    snippets: ['fibonacci', 'factorial', 'prime-check'],
    layout: 'sequential'
});
```

### Groups
Collections of related snippets:
```typescript
const group = createGroup({
    name: 'Authentication',
    selector: '.snippet[category="auth"]',
    sortBy: 'name'
});
```

### Markers
Language-agnostic snippet boundaries:
```javascript
/* FX:BEGIN id=abc123 lang=js */
function hello() {
    return "world";
}
/* FX:END id=abc123 */
```

## 🛠️ Advanced Features

### 🔧 VS Code Integration
- Double-click any node to edit in VS Code
- Automatic file watching and sync
- Project settings and tasks
- Debug configurations

### 🌐 Collaboration
- WebSocket-based real-time sync
- Vector clocks for consistency
- Automatic conflict resolution
- Push to fxd.dev for sharing

### 🏭 Compilation & Testing
- TypeScript, Rust, Go compilation
- Multi-language test runner
- Performance metrics
- Code coverage

### 📄 PDF Composition
Perfect for document generation:
- Dynamic pagination
- Component reusability
- Smart content flow
- Bank statement example included

## 💡 Use Cases

### 1. **Microservices Development**
Each service is a group of snippets that can be versioned and deployed independently.

### 2. **Component Libraries**
Every component is a versioned snippet with its own timeline, making A/B testing trivial.

### 3. **Educational Platforms**
Students can see code evolution visually and branch from any point in history.

### 4. **Document Generation**
Compose PDFs from reusable components with smart pagination (bank statements, reports).

### 5. **Code Reviews**
Visualize changes in 3D space, see version timelines, and collaborate in real-time.

## 🔌 Plugin System

FXD is built on the FX framework's plugin architecture:

- **fx-time-travel**: Snapshots and branching
- **fx-safe**: Resilient operations with circuit breakers
- **fx-atomics**: Node entanglement and synchronization
- **fx-flow**: Visual programming and data flow
- **fx-orm**: Database-backed nodes

## 📖 Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Snippet System](docs/snippets.md)
- [View System](docs/views.md)
- [3D Visualizer](docs/visualizer.md)
- [Collaboration](docs/collaboration.md)
- [API Reference](docs/api.md)

## 🚧 Roadmap

### Phase 1 ✅ (Complete)
- Core snippet system
- Marker system
- View rendering
- Parse/patch cycle
- Basic visualizer

### Phase 2 🚀 (Current)
- 3D visualization with Three.js
- RAMDisk mounting
- Version control integration
- Real-time collaboration
- VS Code integration

### Phase 3 📅 (Planned)
- AI-powered code suggestions
- Cloud sync to fxd.dev
- Mobile apps
- FX-OS integration
- Quantum entanglement features

## 🤝 Contributing

FXD is open source and we welcome contributions!

```bash
# Clone the repository
git clone https://github.com/fxd/fxd

# Install dependencies
deno task install

# Run tests
deno task test

# Start development server
deno task dev
```

## 📝 License

MIT License - See [LICENSE](LICENSE) file

## 🌍 Community

- Website: [fxd.dev](https://fxd.dev)
- GitHub: [github.com/fxd/fxd](https://github.com/fxd/fxd)
- Discord: [discord.gg/fxd](https://discord.gg/fxd)
- Twitter: [@fxdisk](https://twitter.com/fxdisk)

## 🎉 Examples

### Create and Visualize a Project
```typescript
// Create snippets
const auth = createSnippet({
    name: 'authenticate',
    code: 'async function authenticate(user, pass) { ... }',
    tags: ['auth', 'async', 'security']
});

// Create views
const authView = createView({
    name: 'auth.js',
    snippets: ['authenticate', 'authorize', 'validateToken']
});

// Launch visualizer
const visualizer = new FX3DVisualizer(fx);
visualizer.addNode(auth);
visualizer.showVersionTimeline('authenticate');
```

### Collaborate in Real-Time
```typescript
// Connect to collaboration server
const client = new CollaborationClient(fx, {
    projectId: 'my-project',
    serverUrl: 'wss://collab.fxd.dev'
});

await client.connect();

// See other users
client.on('presence', (user) => {
    console.log(`${user.name} is editing ${user.cursor.nodeId}`);
});

// Handle conflicts
client.on('conflict', ({ local, remote, resolve }) => {
    resolve(local.value); // Keep local changes
});
```

### Time Travel Through Code
```typescript
// Create versioned node
const node = new VersionedNode(fx, 'app.config', {
    enableTimeTravel: true,
    maxSnapshots: 100
});

// Make changes
node.set({ apiUrl: 'https://api.v1.com' }, 'Initial config');
node.set({ apiUrl: 'https://api.v2.com' }, 'Update API');

// Branch for testing
node.branch('experiment');
node.set({ apiUrl: 'https://api.test.com' }, 'Test endpoint');

// Compare branches
const diff = node.compare('main', 'experiment');

// Undo if needed
node.undo();
```

---

**Welcome to the future of code organization. Welcome to FXD.**

*Where every line of code has a history, every function has a version, and every project is a living graph.*