# FX Framework Integration

## Overview

FXD is built on top of FX, a reactive node framework that provides the foundational data management and reactivity system. Understanding FX is crucial for working with FXD.

## FX Core Concepts

### Reactive Nodes

FX organizes data in a tree of reactive nodes:

```typescript
// Node structure
interface FXNode {
  __id: string;                        // Unique identifier
  __parent_id: string;                 // Parent node ID
  __nodes: Record<string, FXNode>;     // Child nodes
  __value: FXValue;                    // Stored value
  __type: string | null;               // Node type
  __meta: any;                         // Metadata
  __effects: Effect[];                 // Side effects
  __watchers: Set<Watcher>;           // Change listeners
}
```

### Node Paths

Nodes are accessed via dot-notation paths:

```typescript
// Access nodes by path
$$("app.users.alice").val("Alice");
$$("app.users.bob").val("Bob");

// Nested access
$$("app.settings.theme.dark").val(true);
```

### Proxy System

FX provides a proxy layer for synchronous-looking API:

```typescript
// The $$ function returns a proxy
const proxy = $$("path.to.node");

// Proxy methods
proxy.val();           // Get value
proxy.val("new");      // Set value
proxy.node();          // Get underlying node
proxy.watch(cb);       // Watch for changes
```

## FX Features Used by FXD

### 1. Type System

FXD uses node types to identify snippets:

```typescript
// Setting type on a node
const node = $$("snippets.example").node();
node.__type = "snippet";

// Selecting by type
$$("views.all").group([]).select("snippet");
```

### 2. Metadata Storage

Snippet metadata stored in __meta:

```typescript
node.__meta = {
  id: "snippet-001",
  lang: "js",
  file: "app.js",
  order: 0,
  version: 1
};
```

### 3. CSS-Like Selectors

FX provides powerful selection capabilities:

```typescript
// Class selector (matches __type)
.select(".snippet")

// Attribute selector (matches __meta)
.select('[file="app.js"]')

// Combined selectors
.select('.snippet[lang="js"][order>=0]')
```

### 4. Reactive Groups

Groups that auto-update on changes:

```typescript
const group = $$("views.active")
  .group([])
  .include('.snippet[active=true]')
  .reactive(true);

// Group auto-updates when snippets change
group.on('change', () => {
  console.log('Active snippets changed');
});
```

## FX Configuration

### System Configuration

FX configuration affects FXD behavior:

```typescript
// Configure selectors
$$("config.fx.selectors").val({
  attrResolution: ["meta", "type", "raw", "child"],
  classMatchesType: true,
  enableHas: false
});

// Configure groups
$$("config.fx.groups").val({
  reactiveDefault: true,
  debounceMs: 20
});
```

### Important Settings

```typescript
// Attribute resolution order (CRITICAL for FXD)
$$("config.fx.selectors.attrResolution").val([
  "meta",    // Check __meta first (for snippets)
  "type",    // Then type surface
  "raw",     // Then raw value
  "child"    // Finally child nodes
]);
```

## FX Patterns in FXD

### Snippet Storage Pattern

```typescript
// Snippets stored as nodes with specific structure
function createSnippetNode(path: string, content: string, meta: any) {
  const node = $$(path).node();
  
  // Set value
  $$(path).val(content);
  
  // Set type for selection
  node.__type = "snippet";
  
  // Store metadata
  node.__meta = meta;
  
  return $$(path);
}
```

### View Composition Pattern

```typescript
// Views are groups with persistence
function createView(viewPath: string, selector: string) {
  // Create group
  const group = $$

(viewPath)
    .group([])
    .include(selector);
  
  // Store group on node for retrieval
  const node = $$(viewPath).node();
  node.__group = group._group;
  
  return group;
}
```

### Reactive Update Pattern

```typescript
// Set up reactive chain
$$("snippets.source").watch((newVal) => {
  // Update dependent snippets
  updateDependents(newVal);
  
  // Trigger view re-render
  rerenderViews();
});
```

## FX Internals Important for FXD

### Value Storage

Understanding how FX stores values:

```typescript
// Values stored in __value with multiple representations
node.__value = {
  raw: originalValue,
  parsed: parsedValue,
  stringified: String(originalValue),
  boolean: Boolean(originalValue)
};

// Access via fx.val()
const value = fx.val(node); // Returns raw
```

### Group Persistence

Groups must be stored to persist:

```typescript
// WRONG: Creates new group each time
function getGroup() {
  return $$("view").group([]);
}

// RIGHT: Stores and retrieves group
function getGroup() {
  const node = $$("view").node();
  if (!node.__group) {
    const g = new Group(fx, fx.root);
    node.__group = g;
  }
  return wrapGroup(node.__group);
}
```

### Proxy Behavior

Understanding proxy method behavior:

```typescript
// val() behavior
const proxy = $$("path");
proxy.val("set");         // Sets value
const v = proxy.val();    // Gets value (NOT a function)

// GOTCHA: Arrow functions broke arguments.length
// Fixed by using regular function:
return function(a?: any) {  // Instead of arrow function
  if (arguments.length >= 1) {
    // Setter logic
  } else {
    // Getter logic
  }
};
```

## FX Limitations and Workarounds

### 1. No Built-in Persistence

FX doesn't persist data:

```typescript
// Workaround: Manual serialization
function saveFX() {
  const state = fx.serialize();
  localStorage.setItem('fx-state', JSON.stringify(state));
}

function loadFX() {
  const state = JSON.parse(localStorage.getItem('fx-state'));
  fx.deserialize(state);
}
```

### 2. No Type Safety

FX is dynamically typed:

```typescript
// Workaround: Type guards
function isSnippet(node: FXNode): boolean {
  return node.__type === "snippet" && 
         node.__meta?.id !== undefined;
}
```

### 3. Circular References

FX can have circular reference issues:

```typescript
// Problem: Using $_$$ during initialization
function installDefaults() {
  $_$$("config").val({...}); // Circular!
}

// Solution: Direct node access
function installDefaults() {
  const node = this.setPath('config', {}, this.root);
  this.set(node, {...});
}
```

## FX Debugging

### Inspect Node Structure

```typescript
function inspectNode(path: string) {
  const node = $$(path).node();
  console.log({
    id: node.__id,
    type: node.__type,
    meta: node.__meta,
    value: node.__value,
    children: Object.keys(node.__nodes)
  });
}
```

### Trace Value Changes

```typescript
function traceValue(path: string) {
  $$(path).watch((newVal, oldVal) => {
    console.log(`${path} changed:`, {
      old: oldVal,
      new: newVal,
      timestamp: Date.now()
    });
  });
}
```

### Monitor Group Changes

```typescript
function monitorGroup(viewPath: string) {
  const group = $$(viewPath).group();
  
  group.on('change', (items) => {
    console.log(`Group ${viewPath} changed:`, {
      count: items.length,
      ids: items.map(i => i.node().__meta?.id)
    });
  });
}
```

## FX Performance Tips

### 1. Batch Updates

```typescript
// Inefficient: Multiple updates
$$("a").val(1);
$$("b").val(2);
$$("c").val(3);

// Efficient: Batch update
fx.batch(() => {
  $$("a").val(1);
  $$("b").val(2);
  $$("c").val(3);
});
```

### 2. Debounce Reactive Updates

```typescript
// Configure debouncing
$$("config.fx.groups.debounceMs").val(50);

// Prevents rapid-fire updates
```

### 3. Selective Reactivity

```typescript
// Only make reactive what needs to be
$$("views.static").group([]).reactive(false);  // Manual
$$("views.dynamic").group([]).reactive(true);  // Auto
```

## FX Extension Points

### Custom Behaviors

```typescript
// Add custom behavior to nodes
const SnippetBehavior = {
  name: "snippet",
  
  validate() {
    return this.val() && this.node().__meta?.id;
  },
  
  render() {
    const meta = this.node().__meta;
    return wrapSnippet(meta.id, this.val(), meta.lang);
  }
};

$$("snippets.example").inherit(SnippetBehavior);
```

### Custom Effects

```typescript
// Add side effects
const LogEffect = (event, proxy, key, value) => {
  console.log(`Effect triggered: ${event} on ${key}`, value);
};

$$("tracked.node").node().__effects.push(LogEffect);
```

## FX and Async Operations

### SharedArrayBuffer Support

FX can use SharedArrayBuffer for sync operations:

```typescript
// In browsers with SAB support
if (typeof SharedArrayBuffer !== "undefined") {
  // FX can load modules synchronously
  const module = fx.loadSync("./module.js");
}
```

### Worker Integration

```typescript
// FX can run in workers
// Disabled in Deno (not supported)
if (typeof Deno === "undefined") {
  fx.initWorker();
}
```

## Migrating from Raw FX to FXD

### Before (Raw FX)

```typescript
// Manual node management
const node = $$("data.item").node();
node.__type = "custom";
$$("data.item").val("content");

// Manual group creation
const items = [];
for (const key in fx.root.__nodes) {
  if (fx.root.__nodes[key].__type === "custom") {
    items.push(fx.root.__nodes[key]);
  }
}
```

### After (With FXD)

```typescript
// Structured snippet creation
createSnippet("data.item", "content", {
  id: "item-001",
  lang: "js"
});

// Declarative selection
const items = $$("view")
  .group([])
  .include(".snippet")
  .list();
```

## See Also

- [Core Concepts](concepts.md) - FXD concepts built on FX
- [Architecture](architecture.md) - How FX fits in the stack
- [API Reference](api-snippets.md) - FXD APIs using FX
- [Debugging Guide](guide-debugging.md) - Debugging FX issues