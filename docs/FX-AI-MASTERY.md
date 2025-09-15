# FX AI Mastery Guide - The Complete Mental Model

## 🧠 The Core Truth: Everything is a Node

**This is the only concept you need. Everything else follows naturally.**

```typescript
// A node is just a path in a tree
$$("app.users.alice")     // This IS a node
$$("config.theme.dark")   // This IS a node  
$$("@/api/users")         // This IS a node (API endpoint)
$$("@./math.ts")          // This IS a node (module)
$$("groups.active")       // This IS a node (containing a group)
```

## 🎯 The Three Fundamental Operations

### 1. SET a value
```typescript
$$("path").val(anything);     // Set any value
$$("path").set(anything);     // Same thing
```

### 2. GET a value
```typescript
const v = $$("path").val();   // Get the value (MUST CALL IT!)
const v = $$("path").get();   // Same thing
```

### 3. WATCH for changes
```typescript
$$("path").watch((newVal, oldVal) => {
    // React to changes
});
```

**That's it. Everything else is built on these three operations.**

## 🔑 The Mental Model Hierarchy

### Level 1: Node Basics
```typescript
// Nodes are paths
$$("app.user.name")           // Creates chain if needed
$$("app.user").val({name: "Alice"})  // Set object
$$("app").child("user")       // Alternative navigation

// Everything has a value
$$("anything").val()           // Gets the value
$$("anything").val(x)          // Sets the value
```

### Level 2: Node Metadata
```typescript
// Every node has hidden properties
node.__id      // Unique identifier  
node.__type    // Semantic type (for CSS selectors)
node.__meta    // Custom metadata
node.__value   // Internal storage
node.__nodes   // Child nodes

// Set type for semantic grouping
$$("app.user").setType("user");     // Now matches .user selector
$$("app.user").type("user");        // Shorthand (if implemented)
```

### Level 3: Reactivity is Automatic
```typescript
// This creates a reactive binding
$$("display").val($$("source"));     // display mirrors source forever

// This creates a snapshot
$$("display").val($$("source").val()); // Just copies current value

// Everything can be watched
$$("any.path").watch(v => console.log("Changed to:", v));
```

## 🚀 The Power Patterns

### Pattern 1: Module Loading with @
```typescript
// @ means "load this module synchronously"
$$("@./math.ts")              // Loads module, returns default export
$$("app.math@./math.ts")      // Loads and attaches to node
$$("app.utils@./utils.ts")    // Can attach multiple modules
$$("app.utils@./extra.ts")    // They merge!

// API calls are just modules
$$("@/api/users").get()        // GET request
$$("@/api/users").post({...})  // POST request
```

### Pattern 2: CSS Selectors on Nodes
```typescript
// Classes match __type
$$("app.user").setType("user");
$$(".user")                    // Finds all nodes with __type="user"

// Attributes match __meta (then other places)
$$("app.user").__meta = {active: true};
$$("[active=true]")            // Finds this node

// Complex selectors work
$$(".user[active=true]:not(.banned)")
```

### Pattern 3: Groups are Collections
```typescript
// Create a group (stores it on the node)
$$("groups.active")
    .group([])                        // Initialize empty
    .include(".user[active=true]")   // Add by selector
    .exclude(".banned")               // Remove by selector
    .reactive(true);                  // Auto-update

// Get existing group (no args!)
const g = $$("groups.active").group();  // Retrieves stored group
const items = g.list();                 // Array of node proxies
```

### Pattern 4: Views are Rendered Groups
```typescript
// FXD specific: snippets → groups → views → files
createSnippet("snippets.fn1", "function one(){}", {
    file: "main.js",
    id: "fn1"
});

$$("views.main")
    .group([])
    .include('.snippet[file="main.js"]');

const fileContent = renderView("views.main");
```

## ⚠️ Critical Gotchas That Break Everything

### Gotcha 1: val() Returns a Function!
```typescript
// WRONG - This doesn't get the value!
const v = $$("path").val;      // This is a FUNCTION

// RIGHT - You must CALL it!
const v = $$("path").val();    // This gets the value
```

### Gotcha 2: group() With/Without Args
```typescript
// Creates NEW group (overwrites existing!)
$$("views.x").group([]);        

// Gets EXISTING group (retrieves stored!)
$$("views.x").group();          
```

### Gotcha 3: Reactive vs Snapshot
```typescript
// REACTIVE - Changes together forever
$$("b").val($$("a"));           

// SNAPSHOT - Just copies current value
$$("b").val($$("a").val());     
```

### Gotcha 4: Deep Traversal for Selectors
```typescript
// Selectors must search entire subtree
$$("app").select(".user")       // Must find app.foo.bar.user too!
```

## 🎨 The FXD Layer (Built on FX)

### Snippets = Nodes with Metadata
```typescript
createSnippet(path, code, {
    id: "stable-id",      // For round-trip editing
    file: "virtual.js",   // For grouping into views
    lang: "js",           // For syntax highlighting
    order: 0              // For sorting in views
});
```

### Views = Groups of Snippets
```typescript
// Collect snippets by file
$$("views.main")
    .group([])
    .include('.snippet[file="main.js"]');

// Render to file content
const content = renderView("views.main", {
    hoistImports: true    // Move imports to top
});
```

### Markers = Round-Trip Fences
```typescript
// Rendered output has markers
/* FX:BEGIN id=fn1 lang=js */
function one() {}
/* FX:END id=fn1 */

// Parse edited file back to patches
const patches = toPatches(editedContent);
applyPatches(patches);  // Updates original snippets
```

## 🔥 The Zen of FX

1. **Everything is a node** - Stop thinking in files, objects, or classes
2. **Paths are addresses** - Like URLs but for your entire system
3. **Values are reactive** - Changes propagate automatically
4. **Selectors are queries** - Find nodes like finding DOM elements
5. **Groups are live** - They update as nodes change
6. **Modules are nodes** - Even code loading is just nodes
7. **APIs are nodes** - Network calls are just nodes

## 🛠️ Debugging Checklist

When something doesn't work:

1. **Did you CALL val()?** - `val` vs `val()`
2. **Is the node type set?** - For CSS selectors
3. **Is metadata in __meta?** - For attribute selectors  
4. **Did you store the group?** - group([]) creates, group() retrieves
5. **Is it reactive or snapshot?** - $$() vs $$().val()
6. **Is deep traversal on?** - For nested selector matching
7. **Did you check __value?** - Sometimes value is stored differently

## 🚀 Why This Works for AI

FX is perfect for AI because:

1. **Uniform abstraction** - Everything is a node, no special cases
2. **Composable operations** - val/get/watch combine infinitely
3. **Declarative style** - Say what you want, not how
4. **Reactive by default** - Changes flow automatically
5. **No async complexity** - Sync-looking API over async reality
6. **Tree mental model** - Hierarchical like human thinking

## 📝 Quick Reference Card

```typescript
// The only syntax you need to remember
$$("path").val(x)          // Set
$$("path").val()           // Get  
$$("path").watch(fn)       // React

// Everything else builds on this
$$("@./mod.ts")            // Module loading
$$(".type[attr=val]")      // CSS selectors
$$("g").group([])          // Create group
$$("g").group()            // Get group
$$("g").group().list()     // Get items

// FXD additions
createSnippet(path, code, opts)
renderView(viewPath, opts)
toPatches(edited)
applyPatches(patches)
```

## 🎯 The Ultimate Test

If you understand this, you understand FX:

```typescript
// This line:
$$("app.ui@./ui.ts").group([]).include(".active").watch(v => $$("display").val(v));

// Means:
// 1. Load ui.ts module into app.ui node
// 2. Create a group on that node  
// 3. Include all nodes with type "active"
// 4. When the group changes, update display node
// All in one line, all reactive, all nodes
```

**Remember: In FX, there are no files, no classes, no modules, no APIs - only nodes with paths and values. Master this, and you master FX.**

---

*"Once you see everything as nodes, you can't unsee it. And that's when FX becomes magic."*