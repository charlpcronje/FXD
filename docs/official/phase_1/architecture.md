# System Architecture

## Overview

FXD is built as a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         Application Layer           │
│     (Demo Server, CLI, Web UI)      │
├─────────────────────────────────────┤
│       Filesystem Bridge Layer       │
│    (Virtual FS, Read/Write Ops)     │
├─────────────────────────────────────┤
│         FXD Core Layer              │
│  (Snippets, Views, Markers, Parse)  │
├─────────────────────────────────────┤
│       FX Framework Layer            │
│  (Reactive Nodes, Groups, Proxies)  │
└─────────────────────────────────────┘
```

## Layer Details

### FX Framework Layer

The foundation providing reactive data management.

#### Components
- **FXCore**: Central orchestrator
- **Nodes**: Tree-structured data containers
- **Proxies**: Synchronous-looking async API
- **Groups**: Dynamic collections with selectors
- **Effects**: Reactive computations

#### Key Interfaces
```typescript
interface FXNode {
  __id: string;
  __parent_id: string;
  __nodes: Record<string, FXNode>;
  __value: FXValue;
  __type: string | null;
  __meta: any;
  __effects: Effect[];
  __watchers: Set<Watcher>;
}

interface FXNodeProxy<T> {
  val(): T;
  val(value: T): this;
  node(): FXNode;
  watch(cb: Watcher): () => void;
}
```

### FXD Core Layer

The snippet and view management system.

#### Modules

##### fx-snippets.ts
- Snippet creation and indexing
- Metadata management
- ID-based retrieval
- Checksum calculation

##### fx-view.ts
- View composition from snippets
- Rendering with markers
- Import hoisting
- Order management

##### fx-parse.ts
- Marker extraction
- Patch generation
- Round-trip processing
- Checksum validation

#### Data Flow
```
Create Snippet → Index by ID → Add to View → Render with Markers
       ↑                                            ↓
       └──────── Apply Patches ← Parse Edits ←─────┘
```

### Filesystem Bridge Layer

Virtual filesystem operations mapping to views.

#### Components
- **Registration System**: Maps paths to views
- **Render Pipeline**: View to file transformation
- **Parse Pipeline**: File to patch transformation
- **Directory Emulation**: Virtual folder structure

#### Operations
```typescript
interface FxFsBridge {
  register(mapping: Registration): void;
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  readdir(path: string): string[];
  exists(path: string): boolean;
}
```

### Application Layer

User-facing interfaces and tools.

#### Components
- **HTTP Server**: REST API for file operations
- **CLI Tools**: Command-line interface
- **Web UI**: Visual management (future)
- **Editor Plugins**: IDE integration (future)

## Data Structures

### Snippet Structure
```typescript
{
  // In FX Node
  __type: "snippet",
  __value: {
    raw: "actual code content",
    parsed: "actual code content",
    stringified: "actual code content",
    boolean: true
  },
  __meta: {
    id: "unique-id-001",
    lang: "js",
    file: "path/to/file.js",
    order: 0,
    version: 1,
    checksum: "abc123",
    // Custom metadata
    author: "developer",
    created: "2024-01-01",
    tags: ["feature", "auth"]
  }
}
```

### View Structure
```typescript
{
  // Group configuration
  __type: "group",
  __group: Group {
    members: Set<FXNode>,
    includeSelectors: SelList[],
    excludeSelectors: SelList[],
    manualOrder: string[],
    reactive: boolean
  }
}
```

### Marker Structure
```
/* FX:BEGIN id=snippet-001 lang=js file=app.js checksum=abc123 order=0 version=1 */
// Content
/* FX:END id=snippet-001 */
```

## Processing Pipelines

### Render Pipeline

```
1. Get View Group
   ↓
2. List Snippets (sorted by order)
   ↓
3. For Each Snippet:
   - Get content via fx.val()
   - Wrap with markers
   - Add to output
   ↓
4. Optional: Hoist Imports
   ↓
5. Return Complete File
```

### Parse Pipeline

```
1. Extract Marked Sections
   ↓
2. Compare with Original
   ↓
3. Generate Patches:
   - ID
   - New content
   - Checksum
   ↓
4. Apply to Snippets:
   - Find by ID
   - Update value
   - Update metadata
```

### Selection Pipeline

```
1. Parse CSS Selector
   ↓
2. Walk Node Tree
   ↓
3. For Each Node:
   - Match type (.class)
   - Match attributes ([key=value])
   - Apply combinators
   ↓
4. Collect Matches
   ↓
5. Apply Include/Exclude Rules
```

## Memory Model

### Node Storage
```
fx.root
├── config
│   └── fx (configuration)
├── snippets
│   ├── user
│   │   ├── model (snippet)
│   │   └── validation (snippet)
│   └── auth
│       └── login (snippet)
├── views
│   ├── UserFile (group)
│   └── AuthModule (group)
└── system
    └── fx (runtime data)
```

### Index Structures
```typescript
// ID to Path mapping
snippetIndex: Map<string, string> = {
  "user-001" → "snippets.user.model",
  "auth-001" → "snippets.auth.login"
}

// File to View mapping
fileRegistry: Map<string, Registration> = {
  "src/User.js" → { viewId: "views.UserFile", ... }
}
```

## Reactive Flow

### Change Propagation
```
Snippet Change
    ↓
Watchers Notified
    ↓
Groups Updated (if reactive)
    ↓
Views Re-rendered
    ↓
File System Updated
    ↓
Subscribers Notified
```

### Event System
```typescript
// Snippet level
$$(snippetPath).watch((newVal, oldVal) => {
  console.log('Snippet changed');
});

// Group level
group.on('change', (items) => {
  console.log('Group membership changed');
});

// View level
$$("views.file").on('render', (content) => {
  console.log('View rendered');
});
```

## Performance Characteristics

### Time Complexity
- Snippet creation: O(1)
- ID lookup: O(1) via Map
- CSS selection: O(n) where n = tree nodes
- Rendering: O(m) where m = snippets in view
- Parsing: O(c) where c = content length

### Space Complexity
- Per snippet: ~1KB metadata + content size
- Index overhead: ~100 bytes per snippet
- View overhead: ~500 bytes + selector storage

### Optimization Strategies
1. **Lazy Rendering**: Only render on request
2. **Incremental Parsing**: Parse only changed sections
3. **Selector Caching**: Cache selector results
4. **Debounced Updates**: Batch reactive updates

## Security Considerations

### Input Validation
- Sanitize snippet IDs (alphanumeric + dash)
- Validate marker format
- Check checksum integrity
- Limit snippet size

### Access Control
```typescript
// Future: Permission system
interface Permissions {
  read: string[];   // Allowed read paths
  write: string[];  // Allowed write paths
  execute: string[]; // Allowed operations
}
```

### Isolation
- Snippets isolated by path
- Views can't access outside scope
- Bridge validates all paths

## Extensibility Points

### Custom Snippet Types
```typescript
// Register custom type
fx.registerSnippetType("sql", {
  validator: (content) => validateSQL(content),
  wrapper: (id, content) => wrapSQL(id, content),
  parser: (marked) => parseSQL(marked)
});
```

### Custom Selectors
```typescript
// Add custom selector
fx.addSelector(":deprecated", (node) => {
  return node.__meta?.deprecated === true;
});
```

### Transform Hooks
```typescript
// Add transform
bridge.addTransform({
  beforeRender: (snippets) => preprocessSnippets(snippets),
  afterParse: (patches) => validatePatches(patches)
});
```

## Deployment Architecture

### Standalone Mode
```
Single Process
├── FX Runtime
├── FXD Core
└── HTTP Server
```

### Distributed Mode
```
Frontend Service → API Gateway → FXD Service
                                 ├── Worker 1
                                 ├── Worker 2
                                 └── Worker N
                                 
Shared Storage (Redis/DB)
```

### Embedded Mode
```
Host Application
├── FXD Library
└── Custom Integration
```

## Future Architecture

### Phase 2: Git Integration
```
FXD Core
├── Git Adapter
│   ├── Commit Snippets
│   └── Merge at Snippet Level
└── Conflict Resolver
```

### Phase 3: Web UI
```
React Frontend
├── Snippet Editor
├── View Designer
└── File Explorer
    ↓
WebSocket/REST API
    ↓
FXD Backend
```

### Phase 4: Collaboration
```
Multiple Clients
    ↓
CRDT/OT Layer
    ↓
FXD Core with Sync
    ↓
Shared State Store
```

## See Also

- [FX Framework Integration](fx-integration.md) - Deep dive into FX
- [Marker System](markers.md) - Marker implementation details
- [Performance Guide](guide-performance.md) - Optimization techniques
- [Security Guide](guide-security.md) - Security best practices