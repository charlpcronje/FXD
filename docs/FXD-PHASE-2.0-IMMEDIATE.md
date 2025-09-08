# FXD Phase 2.0: Immediate Production Use - "The Office Release"

## Executive Summary
This is a focused implementation plan to get FXD ready for office use with visual project management, RAMDisk mounting, and intuitive 3D visualization. The goal is to create a production-ready tool that provides immediate value while gathering real-world feedback.

## Core Requirements
1. **RAMDisk Mounting**: Cross-platform RAMDisk creation and `.fxd` file association
2. **3D Visualization**: Interactive node graph with semantic understanding
3. **Visual Editing**: Direct manipulation of nodes with VS Code integration
4. **Smart Clustering**: Intelligent grouping at different zoom levels
5. **Version Control**: Automatic versioning on every save

---

## Section 1: RAMDisk Implementation

### 1.1 Cross-Platform RAMDisk Module
Create `modules/fx-ramdisk.ts` with platform-specific implementations:

```typescript
interface RAMDiskOptions {
  size: string;        // "256M", "1G", etc.
  mountPoint: string;  // "R:", "/mnt/fxd", etc.
  label?: string;      // Volume label
}
```

#### Windows Implementation
- `1.1.1` Use `imdisk` utility (bundled with installer)
- `1.1.2` Command: `imdisk -a -s {size} -m {drive}: -p "/fs:ntfs /q /y"`
- `1.1.3` Format with NTFS for performance
- `1.1.4` Auto-assign drive letter if not specified

#### macOS Implementation
- `1.1.5` Use built-in `hdiutil` and `diskutil`
- `1.1.6` Command: `hdiutil attach -nomount ram://{sectors}`
- `1.1.7` Format: `diskutil erasevolume HFS+ {label} {device}`
- `1.1.8` Mount to `/Volumes/FXD-{project}`

#### Linux Implementation
- `1.1.9` Use `mount -t tmpfs` with size option
- `1.1.10` Command: `mount -t tmpfs -o size={size} tmpfs {mountpoint}`
- `1.1.11` Add to `/etc/fstab` for persistence option
- `1.1.12` Support both tmpfs and ramfs

### 1.2 .fxd File Association
- `1.2.1` Windows: Registry entries for `.fxd` extension
- `1.2.2` macOS: Info.plist CFBundleDocumentTypes
- `1.2.3` Linux: .desktop file with MimeType
- `1.2.4` Double-click handler that:
  - Prompts for mount location (with smart defaults)
  - Creates RAMDisk of appropriate size
  - Loads project into memory
  - Opens visualizer automatically

### 1.3 Mount Manager UI
- `1.3.1` System tray icon showing mounted projects
- `1.3.2` Quick mount/unmount operations
- `1.3.3` Auto-save before unmount
- `1.3.4` Size recommendations based on project

---

## Section 2: 3D Node Visualization

### 2.1 Three.js Scene Setup
Create `modules/fx-visualizer.ts`:

```typescript
interface NodeVisualization {
  id: string;
  type: 'function' | 'class' | 'variable' | 'snippet' | 'view';
  position: THREE.Vector3;
  connections: string[];
  metadata: {
    name: string;
    size: number;
    complexity: number;
    lastModified: Date;
  };
}
```

### 2.2 Node Representation
- `2.2.1` **Functions**: Blue spheres with size based on LOC
- `2.2.2` **Classes**: Red cubes with size based on methods
- `2.2.3` **Variables**: Green tetrahedrons
- `2.2.4` **Snippets**: Purple cylinders
- `2.2.5` **Views**: Golden toruses (containing other nodes)

### 2.3 Visual Features
- `2.3.1` Glowing edges for dependencies
- `2.3.2` Pulsing animation for recently modified
- `2.3.3` Transparency for archived/old code
- `2.3.4` Color intensity for usage frequency
- `2.3.5` Particle effects for active connections

### 2.4 Node Type Detection
Implement AST analysis in `modules/fx-ast-analyzer.ts`:

```typescript
function detectNodeType(code: string, lang: string): NodeType {
  // Use @babel/parser for JS/TS
  // Use tree-sitter for other languages
  // Return: function | class | variable | module | component
}

function extractMetadata(ast: any): NodeMetadata {
  // Extract: name, parameters, return type, complexity
  // Calculate: cyclomatic complexity, dependencies
}
```

---

## Section 3: Interactive Features

### 3.1 Navigation Controls
- `3.1.1` **Orbit**: Right-click drag
- `3.1.2` **Pan**: Middle-click drag
- `3.1.3` **Zoom**: Scroll wheel
- `3.1.4` **Select**: Left-click
- `3.1.5` **Multi-select**: Ctrl+click or box select
- `3.1.6` **Focus**: Double-click to center
- `3.1.7` **Search**: Ctrl+F with visual highlighting

### 3.2 Node Interactions
- `3.2.1` **Hover**: Show tooltip with metadata
  ```typescript
  interface NodeTooltip {
    name: string;
    type: string;
    path: string;
    loc: number;
    lastModified: string;
    author: string;
    description?: string;
  }
  ```
- `3.2.2` **Click**: Select and show properties panel
- `3.2.3` **Double-click**: Open in VS Code
- `3.2.4` **Drag**: Reposition in 3D space
- `3.2.5` **Ctrl+Drag**: Copy node
- `3.2.6` **Drop on View**: Add to view group

### 3.3 View Creation by Grouping
- `3.3.1` Select multiple nodes
- `3.3.2` Right-click → "Create View"
- `3.3.3` Name the view
- `3.3.4` Visual group boundary appears
- `3.3.5` Nodes snap to group grid
- `3.3.6` Group can be collapsed/expanded

---

## Section 4: Intelligent Clustering

### 4.1 Zoom-Level Clustering
Implement LOD (Level of Detail) system:

```typescript
interface ZoomLevel {
  minZoom: number;
  maxZoom: number;
  clustering: 'none' | 'semantic' | 'spatial' | 'temporal';
  nodeVisibility: 'all' | 'important' | 'summary';
}

const zoomLevels: ZoomLevel[] = [
  { minZoom: 0, maxZoom: 10, clustering: 'semantic', nodeVisibility: 'summary' },
  { minZoom: 10, maxZoom: 50, clustering: 'spatial', nodeVisibility: 'important' },
  { minZoom: 50, maxZoom: Infinity, clustering: 'none', nodeVisibility: 'all' }
];
```

### 4.2 Clustering Algorithms

#### Semantic Clustering
- `4.2.1` Group by module/namespace
- `4.2.2` Group by functionality (auth, db, ui)
- `4.2.3` Group by file origin
- `4.2.4` Show as nested spheres

#### Spatial Clustering
- `4.2.5` Use force-directed layout
- `4.2.6` K-means clustering for nearby nodes
- `4.2.7` Maintain cluster cohesion
- `4.2.8` Show cluster boundaries

#### Temporal Clustering
- `4.2.9` Group by creation time
- `4.2.10` Group by last modified
- `4.2.11` Show timeline visualization

### 4.3 Performance Optimization
- `4.3.1` Use THREE.InstancedMesh for large node counts
- `4.3.2` Frustum culling for off-screen nodes
- `4.3.3` Progressive loading based on viewport
- `4.3.4` WebGL shader-based rendering
- `4.3.5` Worker thread for layout calculations

---

## Section 5: VS Code Integration

### 5.1 Editor Bridge
Create `modules/fx-vscode-bridge.ts`:

```typescript
interface EditorBridge {
  openFile(nodeId: string): Promise<void>;
  saveFile(nodeId: string, content: string): Promise<void>;
  onSave(callback: (nodeId: string) => void): void;
}
```

### 5.2 Implementation Options

#### Option A: VS Code Extension
- `5.2.1` Create `fxd-vscode` extension
- `5.2.2` Custom URI scheme: `fxd://node/{id}`
- `5.2.3` Virtual file system provider
- `5.2.4` Two-way sync with FXD

#### Option B: Monaco Editor Embedded
- `5.2.5` Embed Monaco in Electron window
- `5.2.6` Split view with visualizer
- `5.2.7` Synchronized scrolling
- `5.2.8` Shared theme and settings

#### Option C: External VS Code Launch
- `5.2.9` Create temp file from node
- `5.2.10` Launch VS Code with file
- `5.2.11` Watch file for changes
- `5.2.12` Sync back on save

### 5.3 Save Hook Integration
- `5.3.1` Detect file save event
- `5.3.2` Parse changes with diff algorithm
- `5.3.3` Update node in FX graph
- `5.3.4` Trigger auto-commit in version control
- `5.3.5` Update visualization immediately

---

## Section 6: Version Control Integration

### 6.1 Auto-Versioning
Every save triggers:
```typescript
async function onNodeSave(nodeId: string, newContent: string) {
  const oldContent = $$(nodeId).val();
  const diff = createDiff(oldContent, newContent);
  
  // Auto-commit
  await $history.commit({
    message: `Auto-save: ${nodeId}`,
    diff: diff,
    timestamp: Date.now(),
    author: currentUser
  });
  
  // Update node
  $$(nodeId).val(newContent);
  
  // Update visualization
  visualizer.updateNode(nodeId);
}
```

### 6.2 Visual History
- `6.2.1` Timeline slider in UI
- `6.2.2` Hover to preview state
- `6.2.3` Click to restore
- `6.2.4` Visual diff between states
- `6.2.5` Branch visualization

---

## Section 7: Import System Intelligence

### 7.1 Project Scanner
Create `modules/fx-import-scanner.ts`:

```typescript
interface ImportOptions {
  path: string;
  recursive: boolean;
  fileTypes: string[];
  excludePatterns: string[];
  chunkingStrategy: 'file' | 'function' | 'class' | 'auto';
}
```

### 7.2 Smart Chunking
- `7.2.1` Detect natural boundaries (functions, classes)
- `7.2.2` Respect module boundaries
- `7.2.3` Maintain import/export relationships
- `7.2.4` Preserve file structure in metadata

### 7.3 Relationship Detection
- `7.3.1` Parse import/require statements
- `7.3.2` Detect function calls across files
- `7.3.3` Find class inheritance chains
- `7.3.4` Map data flow between modules
- `7.3.5` Create dependency graph

---

## Section 8: Implementation Plan

### Week 1-2: RAMDisk & File Association
- [ ] Implement cross-platform RAMDisk creation
- [ ] Add .fxd file association
- [ ] Create mount/unmount UI
- [ ] Test on all platforms

### Week 3-4: Basic 3D Visualization
- [ ] Set up Three.js scene
- [ ] Implement node rendering
- [ ] Add basic navigation
- [ ] Create node type detection

### Week 5-6: Interaction & Editing
- [ ] Add node selection and dragging
- [ ] Implement VS Code integration
- [ ] Add auto-save and versioning
- [ ] Create view grouping

### Week 7-8: Intelligence & Polish
- [ ] Implement smart clustering
- [ ] Add import scanner
- [ ] Optimize performance
- [ ] Create installer packages

---

## Technical Stack

### Required Dependencies
```json
{
  "dependencies": {
    "three": "^0.160.0",
    "monaco-editor": "^0.45.0",
    "@babel/parser": "^7.23.0",
    "tree-sitter": "^0.20.0",
    "d3-force-3d": "^3.0.0",
    "electron": "^28.0.0",
    "better-sqlite3": "^9.2.0"
  }
}
```

### Platform-Specific Tools
- **Windows**: imdisk (bundled)
- **macOS**: Built-in hdiutil
- **Linux**: tmpfs (kernel module)

---

## User Experience Flow

### First Launch
1. User double-clicks `.fxd` file
2. Prompt: "Choose mount location" (with smart default)
3. RAMDisk created and project loaded
4. 3D visualizer opens with all nodes displayed
5. Tutorial overlay shows basic controls

### Daily Workflow
1. **Morning**: Double-click project file → Auto-mounts to last location
2. **Explore**: Navigate 3D space, see project structure
3. **Edit**: Double-click node → Opens in VS Code
4. **Save**: Ctrl+S → Auto-commits, updates visualization
5. **Group**: Drag nodes together → Create new view
6. **Evening**: Close app → Prompts to save → Unmounts RAMDisk

### Large Project Import
1. Select folder to import
2. Progress bar shows scanning
3. Nodes appear progressively
4. Auto-clustering at high zoom
5. Zoom in to see individual nodes
6. Click cluster to expand

---

## Performance Targets
- **Mount Time**: <2 seconds for 100MB project
- **Load Time**: <5 seconds for 10,000 nodes
- **Frame Rate**: 60 FPS with 1,000 visible nodes
- **Zoom Response**: <100ms clustering update
- **Save Latency**: <50ms per node update

## Success Metrics
- Mount and load a real project in <10 seconds
- Navigate 10,000+ nodes smoothly
- Edit and save with zero data loss
- Visual grouping feels intuitive
- Version history is automatic and reliable

## Next Phase Considerations
- Cloud sync for remote work
- Collaborative editing
- AI-powered code suggestions
- Advanced visualization themes
- Plugin system for extensions