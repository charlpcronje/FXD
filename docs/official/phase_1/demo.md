# Demo Application

## Overview

This demo showcases a complete FXD application that implements a simple code editor with round-trip editing capabilities. The demo includes snippet management, view composition, file system mapping, and a web interface.

## Demo Architecture

```
┌─────────────────────────────────────────────────┐
│                   Web Interface                  │
│  (Editor with syntax highlighting and markers)   │
└─────────────────────────────────────────────────┘
                          │
                    HTTP API Layer
                          │
┌─────────────────────────────────────────────────┐
│                   FXD Server                     │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐ │
│  │ Snippets  │  │   Views   │  │   Bridge   │ │
│  └───────────┘  └───────────┘  └────────────┘ │
└─────────────────────────────────────────────────┘
                          │
                      FX Framework
```

## Complete Demo Implementation

### 1. Server Setup (server/demo-app.ts)

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createSnippet, findBySnippetId } from "../modules/fx-snippets.ts";
import { renderView } from "../modules/fx-view.ts";
import { bridge } from "../modules/fx-bridge.ts";
import { toPatches, applyPatches } from "../modules/fx-parsing.ts";

// Initialize FX
const fx = new FX();
globalThis.fx = fx;
globalThis.$$ = fx.use$();

// Load sample project
loadSampleProject();

// Set up HTTP server
const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  
  // Serve static files
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(INDEX_HTML, {
      headers: { "content-type": "text/html" }
    });
  }
  
  // API routes
  if (url.pathname.startsWith("/api/")) {
    return handleAPI(req, url);
  }
  
  // Virtual file system
  if (url.pathname.startsWith("/files/")) {
    return handleFiles(req, url);
  }
  
  return new Response("Not Found", { status: 404 });
};

async function handleAPI(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.substring(5); // Remove /api/
  
  switch (path) {
    case "snippets":
      return handleSnippets(req);
    case "views":
      return handleViews(req);
    case "round-trip":
      return handleRoundTrip(req);
    case "tree":
      return handleTree(req);
    default:
      return new Response("Not Found", { status: 404 });
  }
}

async function handleSnippets(req: Request): Promise<Response> {
  if (req.method === "GET") {
    // List all snippets
    const snippets = $$("snippets")
      .select(".snippet")
      .list()
      .map(s => ({
        id: s.node().__meta?.id,
        path: s.path(),
        meta: s.node().__meta,
        preview: s.val().substring(0, 100)
      }));
    
    return Response.json(snippets);
  }
  
  if (req.method === "POST") {
    // Create new snippet
    const data = await req.json();
    createSnippet(data.path, data.content, data.meta);
    return Response.json({ success: true });
  }
  
  return new Response("Method Not Allowed", { status: 405 });
}

async function handleViews(req: Request): Promise<Response> {
  if (req.method === "GET") {
    // List all views
    const views = $$("views")
      .select(".group")
      .list()
      .map(v => ({
        path: v.path(),
        snippetCount: v.list().length,
        snippets: v.list().map(s => s.node().__meta?.id)
      }));
    
    return Response.json(views);
  }
  
  if (req.method === "POST") {
    // Create/update view
    const data = await req.json();
    const view = $$(data.path).group([]);
    
    // Apply selectors
    for (const selector of data.selectors) {
      if (selector.startsWith("!")) {
        view.exclude(selector.substring(1));
      } else {
        view.include(selector);
      }
    }
    
    // Make reactive if requested
    if (data.reactive) {
      view.reactive(true);
    }
    
    return Response.json({ success: true });
  }
  
  return new Response("Method Not Allowed", { status: 405 });
}

async function handleRoundTrip(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  
  const { content, original, viewPath } = await req.json();
  
  try {
    // Parse changes
    const patches = toPatches(content, original);
    
    // Apply patches
    const results = applyPatches(patches);
    
    // Get updated content
    const updated = renderView(viewPath);
    
    return Response.json({
      success: true,
      patches: patches.length,
      updated,
      results
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
}

async function handleFiles(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.substring(7); // Remove /files/
  
  if (req.method === "GET") {
    try {
      const content = bridge.readFile(path);
      return new Response(content, {
        headers: { "content-type": getMimeType(path) }
      });
    } catch {
      return new Response("File Not Found", { status: 404 });
    }
  }
  
  if (req.method === "PUT") {
    const content = await req.text();
    bridge.writeFile(path, content);
    return Response.json({ success: true });
  }
  
  return new Response("Method Not Allowed", { status: 405 });
}

async function handleTree(req: Request): Promise<Response> {
  const tree = bridge.getDirectoryTree("/");
  return Response.json(tree);
}

// Load sample project
function loadSampleProject() {
  // Create snippets for a Todo app
  createSnippet("snippets.models.todo", `
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}`, {
    id: "todo-model",
    lang: "ts",
    file: "models/Todo.ts",
    order: 0
  });
  
  createSnippet("snippets.components.TodoItem", `
export function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className="todo-item">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span className={todo.completed ? 'completed' : ''}>
        {todo.title}
      </span>
      <button onClick={() => onDelete(todo.id)}>Delete</button>
    </div>
  );
}`, {
    id: "todo-item-component",
    lang: "tsx",
    file: "components/TodoItem.tsx",
    order: 0
  });
  
  createSnippet("snippets.components.TodoList", `
export function TodoList({ todos, onToggle, onDelete }) {
  return (
    <div className="todo-list">
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}`, {
    id: "todo-list-component",
    lang: "tsx",
    file: "components/TodoList.tsx",
    order: 1
  });
  
  createSnippet("snippets.hooks.useTodos", `
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const addTodo = (title: string) => {
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date()
    };
    setTodos([...todos, newTodo]);
  };
  
  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };
  
  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };
  
  return { todos, addTodo, toggleTodo, deleteTodo };
}`, {
    id: "use-todos-hook",
    lang: "ts",
    file: "hooks/useTodos.ts",
    order: 0
  });
  
  // Create views
  $$("views.models").group([])
    .include('.snippet[file^="models/"]');
  
  $$("views.components").group([])
    .include('.snippet[file^="components/"]');
  
  $$("views.hooks").group([])
    .include('.snippet[file^="hooks/"]');
  
  $$("views.app").group([])
    .include('.snippet')
    .reactive(true);
  
  // Map to file system
  bridge.mapViewToFile("views.models", "src/models/index.ts");
  bridge.mapViewToFile("views.components", "src/components/index.tsx");
  bridge.mapViewToFile("views.hooks", "src/hooks/index.ts");
  bridge.mapViewToFile("views.app", "src/app.tsx");
}

// Start server
console.log("Demo server running on http://localhost:8080");
await serve(handler, { port: 8080 });
```

### 2. Web Interface (public/index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <title>FXD Demo - Round-Trip Editor</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Monaco', 'Menlo', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      height: 100vh;
      display: flex;
    }
    
    .sidebar {
      width: 250px;
      background: #252526;
      border-right: 1px solid #3e3e42;
      overflow-y: auto;
    }
    
    .sidebar h3 {
      padding: 10px;
      background: #2d2d30;
      border-bottom: 1px solid #3e3e42;
      font-size: 12px;
      text-transform: uppercase;
      color: #969696;
    }
    
    .tree-item {
      padding: 5px 10px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
    }
    
    .tree-item:hover {
      background: #2a2d2e;
    }
    
    .tree-item.selected {
      background: #094771;
    }
    
    .tree-item .icon {
      margin-right: 5px;
      width: 16px;
      text-align: center;
    }
    
    .editor-container {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .toolbar {
      height: 40px;
      background: #2d2d30;
      border-bottom: 1px solid #3e3e42;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 10px;
    }
    
    .toolbar button {
      padding: 5px 15px;
      background: #0e639c;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .toolbar button:hover {
      background: #1177bb;
    }
    
    .toolbar button:disabled {
      background: #3e3e42;
      cursor: not-allowed;
    }
    
    .editor {
      flex: 1;
      padding: 10px;
      overflow-y: auto;
    }
    
    .editor textarea {
      width: 100%;
      height: 100%;
      background: transparent;
      color: #d4d4d4;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      resize: none;
    }
    
    .marker {
      color: #608b4e;
      font-style: italic;
      opacity: 0.7;
    }
    
    .marker-begin {
      background: rgba(96, 139, 78, 0.1);
      border-top: 1px solid #608b4e;
    }
    
    .marker-end {
      background: rgba(96, 139, 78, 0.1);
      border-bottom: 1px solid #608b4e;
    }
    
    .status-bar {
      height: 22px;
      background: #007acc;
      color: white;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 12px;
    }
    
    .status-bar .item {
      margin-right: 20px;
    }
    
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
    }
    
    .modal.show {
      display: flex;
    }
    
    .modal-content {
      background: #252526;
      padding: 20px;
      border-radius: 5px;
      min-width: 400px;
      max-width: 600px;
    }
    
    .modal h2 {
      margin-bottom: 15px;
      color: #cccccc;
    }
    
    .modal pre {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
      margin: 10px 0;
    }
    
    .modal button {
      margin-top: 15px;
      padding: 5px 15px;
      background: #0e639c;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <h3>Files</h3>
    <div id="file-tree"></div>
    
    <h3>Snippets</h3>
    <div id="snippet-list"></div>
    
    <h3>Views</h3>
    <div id="view-list"></div>
  </div>
  
  <div class="editor-container">
    <div class="toolbar">
      <button onclick="saveFile()">Save</button>
      <button onclick="applyRoundTrip()">Apply Round-Trip</button>
      <button onclick="refreshView()">Refresh View</button>
      <button onclick="showInfo()">Info</button>
      <span style="margin-left: auto; font-size: 12px; color: #969696;">
        <span id="current-file">No file selected</span>
      </span>
    </div>
    
    <div class="editor">
      <textarea id="editor-content" placeholder="Select a file to edit..."></textarea>
    </div>
    
    <div class="status-bar">
      <span class="item">FXD Demo v1.0</span>
      <span class="item" id="status-snippets">0 snippets</span>
      <span class="item" id="status-changes">No changes</span>
      <span class="item" id="status-mode">Round-Trip Enabled</span>
    </div>
  </div>
  
  <div class="modal" id="info-modal">
    <div class="modal-content">
      <h2>Round-Trip Information</h2>
      <div id="info-content"></div>
      <button onclick="closeInfo()">Close</button>
    </div>
  </div>
  
  <script>
    let currentFile = null;
    let originalContent = null;
    let currentView = null;
    
    // Initialize
    async function init() {
      await loadFileTree();
      await loadSnippets();
      await loadViews();
      
      // Set up auto-save
      document.getElementById('editor-content').addEventListener('input', () => {
        if (originalContent !== null) {
          const hasChanges = document.getElementById('editor-content').value !== originalContent;
          document.getElementById('status-changes').textContent = 
            hasChanges ? 'Modified' : 'No changes';
        }
      });
    }
    
    async function loadFileTree() {
      const response = await fetch('/api/tree');
      const tree = await response.json();
      renderTree(tree, document.getElementById('file-tree'));
    }
    
    async function loadSnippets() {
      const response = await fetch('/api/snippets');
      const snippets = await response.json();
      
      const container = document.getElementById('snippet-list');
      container.innerHTML = '';
      
      snippets.forEach(snippet => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.innerHTML = `
          <span class="icon">📄</span>
          <span>${snippet.id || snippet.path}</span>
        `;
        item.onclick = () => selectSnippet(snippet);
        container.appendChild(item);
      });
      
      document.getElementById('status-snippets').textContent = 
        `${snippets.length} snippets`;
    }
    
    async function loadViews() {
      const response = await fetch('/api/views');
      const views = await response.json();
      
      const container = document.getElementById('view-list');
      container.innerHTML = '';
      
      views.forEach(view => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.innerHTML = `
          <span class="icon">📦</span>
          <span>${view.path} (${view.snippetCount})</span>
        `;
        item.onclick = () => selectView(view);
        container.appendChild(item);
      });
    }
    
    function renderTree(tree, container, level = 0) {
      for (const [name, value] of Object.entries(tree)) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = `${10 + level * 15}px`;
        
        if (typeof value === 'object' && !value.size) {
          // Directory
          item.innerHTML = `
            <span class="icon">📁</span>
            <span>${name}/</span>
          `;
          container.appendChild(item);
          renderTree(value, container, level + 1);
        } else {
          // File
          item.innerHTML = `
            <span class="icon">📄</span>
            <span>${name}</span>
          `;
          item.onclick = () => selectFile(name, value);
          container.appendChild(item);
        }
      }
    }
    
    async function selectFile(name, info) {
      currentFile = name;
      document.getElementById('current-file').textContent = name;
      
      const response = await fetch(`/files/${name}`);
      const content = await response.text();
      
      originalContent = content;
      document.getElementById('editor-content').value = content;
      highlightMarkers();
      
      // Clear selection
      document.querySelectorAll('.tree-item').forEach(item => {
        item.classList.remove('selected');
      });
      event.target.closest('.tree-item').classList.add('selected');
    }
    
    function selectSnippet(snippet) {
      // Show snippet info
      const info = document.getElementById('info-content');
      info.innerHTML = `
        <h3>Snippet: ${snippet.id}</h3>
        <p>Path: ${snippet.path}</p>
        <pre>${JSON.stringify(snippet.meta, null, 2)}</pre>
        <h4>Preview:</h4>
        <pre>${snippet.preview}...</pre>
      `;
      document.getElementById('info-modal').classList.add('show');
    }
    
    function selectView(view) {
      currentView = view.path;
      
      // Show view info
      const info = document.getElementById('info-content');
      info.innerHTML = `
        <h3>View: ${view.path}</h3>
        <p>Snippets: ${view.snippetCount}</p>
        <h4>Included Snippets:</h4>
        <ul>
          ${view.snippets.map(s => `<li>${s}</li>`).join('')}
        </ul>
      `;
      document.getElementById('info-modal').classList.add('show');
    }
    
    function highlightMarkers() {
      const content = document.getElementById('editor-content').value;
      const lines = content.split('\n');
      
      // Simple marker highlighting (in real app, use CodeMirror or Monaco)
      const highlighted = lines.map(line => {
        if (line.includes('FX:BEGIN')) {
          return `<span class="marker marker-begin">${line}</span>`;
        } else if (line.includes('FX:END')) {
          return `<span class="marker marker-end">${line}</span>`;
        }
        return line;
      });
      
      // Note: This is simplified - real implementation would use proper editor
    }
    
    async function saveFile() {
      if (!currentFile) {
        alert('No file selected');
        return;
      }
      
      const content = document.getElementById('editor-content').value;
      const response = await fetch(`/files/${currentFile}`, {
        method: 'PUT',
        body: content
      });
      
      if (response.ok) {
        originalContent = content;
        document.getElementById('status-changes').textContent = 'Saved';
        
        // Reload snippets/views if changed
        await loadSnippets();
        await loadViews();
      }
    }
    
    async function applyRoundTrip() {
      if (!currentFile || !originalContent) {
        alert('No file selected');
        return;
      }
      
      const content = document.getElementById('editor-content').value;
      
      const response = await fetch('/api/round-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          original: originalContent,
          viewPath: currentView || 'views.app'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update editor with new content
        document.getElementById('editor-content').value = result.updated;
        originalContent = result.updated;
        
        // Show results
        const info = document.getElementById('info-content');
        info.innerHTML = `
          <h3>Round-Trip Applied</h3>
          <p>Patches applied: ${result.patches}</p>
          <pre>${JSON.stringify(result.results, null, 2)}</pre>
        `;
        document.getElementById('info-modal').classList.add('show');
        
        // Reload
        await loadSnippets();
      } else {
        alert(`Round-trip failed: ${result.error}`);
      }
    }
    
    async function refreshView() {
      if (!currentView) {
        alert('No view selected');
        return;
      }
      
      // Re-render view
      const response = await fetch(`/files/${currentFile}`);
      const content = await response.text();
      
      document.getElementById('editor-content').value = content;
      originalContent = content;
      highlightMarkers();
    }
    
    function showInfo() {
      const info = document.getElementById('info-content');
      info.innerHTML = `
        <h3>FXD Demo Information</h3>
        <p>This demo showcases the round-trip editing capability of FXD.</p>
        <h4>How to use:</h4>
        <ol>
          <li>Select a file from the tree</li>
          <li>Edit the content between FX:BEGIN and FX:END markers</li>
          <li>Click "Apply Round-Trip" to apply changes back to snippets</li>
          <li>Changes persist across view re-renders</li>
        </ol>
        <h4>Features:</h4>
        <ul>
          <li>Live snippet editing</li>
          <li>Automatic marker preservation</li>
          <li>View composition</li>
          <li>Virtual file system</li>
        </ul>
      `;
      document.getElementById('info-modal').classList.add('show');
    }
    
    function closeInfo() {
      document.getElementById('info-modal').classList.remove('show');
    }
    
    // Initialize on load
    init();
  </script>
</body>
</html>
```

### 3. Running the Demo

```bash
# Install dependencies (if needed)
deno cache server/demo-app.ts

# Run the demo server
deno run --allow-net --allow-read server/demo-app.ts

# Open browser to http://localhost:8080
```

## Demo Features

### 1. Snippet Management
- Create, read, update snippets via UI
- View snippet metadata and relationships
- Search and filter snippets

### 2. View Composition
- Create views with CSS-like selectors
- Dynamic snippet inclusion/exclusion
- Reactive view updates

### 3. Round-Trip Editing
- Edit rendered files with markers
- Automatic change detection
- Patch generation and application
- Conflict resolution

### 4. Virtual File System
- Map views to file paths
- Directory tree navigation
- File read/write operations

### 5. Live Updates
- Real-time snippet updates
- Reactive view re-rendering
- Automatic UI synchronization

## Demo Walkthrough

### Step 1: Initial Setup
When the demo starts, it creates a sample Todo application with:
- Model definitions (Todo interface)
- React components (TodoItem, TodoList)
- Custom hooks (useTodos)
- Views for each module

### Step 2: Exploring Files
1. Click on files in the sidebar to view their content
2. Notice the FX:BEGIN/END markers preserving snippet boundaries
3. See how multiple snippets are combined in each file

### Step 3: Making Edits
1. Select a file (e.g., "src/components/index.tsx")
2. Edit content between markers (e.g., change button text)
3. Click "Apply Round-Trip" to save changes

### Step 4: Verifying Persistence
1. Click "Refresh View" to re-render from snippets
2. Notice your changes are preserved
3. Check snippet list to see updated content

### Step 5: Creating New Content
1. Use the API to create new snippets
2. Add them to existing views
3. See them appear in the virtual file system

## Extending the Demo

### Adding New Features

```typescript
// Add syntax highlighting
import { highlight } from "https://esm.sh/prismjs@1.29.0";

function syntaxHighlight(code: string, lang: string): string {
  return highlight(code, Prism.languages[lang], lang);
}

// Add version control
class VersionControl {
  private history: Map<string, Version[]> = new Map();
  
  commit(snippetId: string, content: string, message: string) {
    const versions = this.history.get(snippetId) || [];
    versions.push({
      content,
      message,
      timestamp: Date.now(),
      hash: this.hash(content)
    });
    this.history.set(snippetId, versions);
  }
  
  diff(snippetId: string, v1: number, v2: number): Diff {
    const versions = this.history.get(snippetId);
    if (!versions) return null;
    
    return this.computeDiff(
      versions[v1].content,
      versions[v2].content
    );
  }
}

// Add collaborative editing
class CollaborativeEdit {
  private websockets: Set<WebSocket> = new Set();
  
  broadcast(event: EditEvent) {
    for (const ws of this.websockets) {
      ws.send(JSON.stringify(event));
    }
  }
  
  handleEdit(snippetId: string, patch: Patch, userId: string) {
    // Apply patch
    applyPatches([patch]);
    
    // Broadcast to other users
    this.broadcast({
      type: 'edit',
      snippetId,
      patch,
      userId,
      timestamp: Date.now()
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Use a different port
   deno run --allow-net server/demo-app.ts --port 8081
   ```

2. **Markers not preserved**
   - Ensure you're editing only between FX:BEGIN and FX:END
   - Don't modify the marker lines themselves

3. **Changes not persisting**
   - Check that patches are being generated correctly
   - Verify snippet IDs match between markers and storage

4. **View not updating**
   - Ensure view is set to reactive
   - Check that selectors match snippet metadata

## See Also

- [Quickstart Guide](quickstart.md) - Getting started with FXD
- [Examples](examples-basic.md) - More code examples
- [API Reference](api-snippets.md) - Complete API documentation
- [Architecture](architecture.md) - System design details