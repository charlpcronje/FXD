# 🌟 Reactive Containerized Snippets - The Game Changer

## 🎯 The Vision (As I Understand It)

### Current State: Snippets are Passive Text
```typescript
// Snippet A
createSnippet("calc.add", "function add(a, b) { return a + b; }");

// Snippet B
createSnippet("calc.multiply", "function mul(x, y) { return x * y; }");

// Snippet C
createSnippet("calc.formula", "function formula(n) { return mul(add(n, 5), 2); }");
```

**Problems:**
- ❌ No connection tracking between snippets
- ❌ No automatic data flow
- ❌ Can't see dependencies
- ❌ Must manually wire everything
- ❌ No reactivity between components

---

### Proposed: Docker-Like Containerized Snippets

```typescript
// Container 1: Add function
createReactiveSnippet("calc.add", `
  function add(a, b) {
    return a + b;
  }
`, {
  id: "add",
  env: {
    // Internal var → External node (like Docker ENV)
    a: "inputs.add.a",
    b: "inputs.add.b",
    return: "outputs.add.result"
  }
});

// Container 2: Multiply function
createReactiveSnippet("calc.multiply", `
  function mul(x, y) {
    return x * y;
  }
`, {
  id: "mul",
  env: {
    x: "inputs.mul.x",
    y: "inputs.mul.y",
    return: "outputs.mul.result"
  }
});

// Container 3: Formula that COMPOSES the others
createReactiveSnippet("calc.formula", `
  function formula(n) {
    const addResult = add(n, 5);    // Uses calc.add!
    return mul(addResult, 2);       // Uses calc.multiply!
  }
`, {
  id: "formula",
  env: {
    n: "data.input",
    add: "outputs.add.result",      // DEPENDS ON calc.add output!
    mul: "outputs.mul.result",      // DEPENDS ON calc.multiply output!
    return: "data.finalResult"
  }
});

// THE MAGIC:
$$("data.input").val(10);

// Atomics automatically:
// 1. formula.env.n gets 10
// 2. formula needs add(10, 5)
//    → inputs.add.a = 10
//    → inputs.add.b = 5
//    → calc.add executes
//    → outputs.add.result = 15
// 3. formula.env.add gets 15
// 4. formula needs mul(15, 2)
//    → inputs.mul.x = 15
//    → inputs.mul.y = 2
//    → calc.multiply executes
//    → outputs.mul.result = 30
// 5. formula.env.mul gets 30
// 6. formula returns 30
//    → data.finalResult = 30

// ALL AUTOMATIC! ALL TRACKED! ALL VISUALIZABLE!
```

---

## 🔥 What fx-atomics Gives Us

From the plugin code, here's what we get:

### 1. **Perfect Bi-Directional Sync**
```typescript
// Connect snippet internal var to external node
atomics.entangle(
  "inputs.userAge",           // External (side A)
  "calc.retirement.__env.age", // Internal (side B)
  {
    oneWayAToB: true,  // Data flows external → internal only
    mapAToB: (val) => Number(val),  // Transform to number
    syncInitialValue: true  // Sync immediately
  }
);

// Now:
$$("inputs.userAge").val("42");  // External
// → calc.retirement.__env.age becomes 42 (internal)
```

### 2. **Lifecycle Hooks for Validation**
```typescript
atomics.entangle(externalPath, internalPath, {
  hooksB: {
    beforeSet: ({ incoming, current }) => {
      // Validate before setting
      if (incoming < 0) {
        console.warn("Age cannot be negative!");
        return { action: 'skip' };  // Don't update
      }
      return { action: 'proceed', value: incoming };
    },
    afterSet: ({ value, durationMs }) => {
      console.log(`Updated to ${value} in ${durationMs}ms`);
    }
  }
});
```

### 3. **Re-entrancy Protection**
```typescript
// No ping-pong loops!
// If A changes → B changes → (would trigger A) → BLOCKED
// Atomics detects re-entrancy and prevents infinite loops
```

### 4. **Microtask Coalescing**
```typescript
// Multiple rapid changes get coalesced
$$("input").val(1);
$$("input").val(2);
$$("input").val(3);
// → Only triggers ONE propagation with final value (3)
```

---

## 💡 How This Works Technically

### Node Structure for Reactive Snippet
```
calc.add (snippet node)
├── __snippet        "function add(a, b) { return a + b; }"
├── __meta          { id: "add", lang: "js" }
├── __env           (environment variables)
│   ├── a           (internal variable)
│   ├── b           (internal variable)
│   └── return      (return value)
├── __connections   (tracking metadata)
│   ├── in          [{ internal: "a", external: "inputs.add.a" }, ...]
│   └── out         [{ internal: "return", external: "outputs.add.result" }]
└── __entanglements (atomics links)
    ├── a_link      (AtomicLink instance)
    ├── b_link      (AtomicLink instance)
    └── return_link (AtomicLink instance)
```

### When You Create a Reactive Snippet:
```typescript
createReactiveSnippet(path, code, { env: { a: "inputs.add.a", ... } })

// Internally:
// 1. Create snippet node
// 2. Create __env container
// 3. For each env mapping:
//    a. Create $$("calc.add.__env.a") node
//    b. Create atomics.entangle("inputs.add.a", "calc.add.__env.a")
//    c. Store link in __entanglements
//    d. Track connection in __connections
```

### When External Data Changes:
```typescript
$$("inputs.add.a").val(10);

// Atomics detects change:
// 1. Runs beforeSet hooks (validation)
// 2. Checks equality (skip if same)
// 3. Propagates to calc.add.__env.a
// 4. Runs afterSet hooks
// 5. If snippet is "reactive", triggers re-execution
```

---

## 🎨 Visualizer Enhancements

### What We Can Show:

#### 1. **Dependency Graph**
```
[data.input] ──→ [calc.formula.n]
                      ↓
                 [formula executes]
                      ↓
      ┌──────────────┴──────────────┐
      ↓                              ↓
[inputs.add.a]                [inputs.mul.x]
      ↓                              ↓
[calc.add.a]                   [calc.multiply.x]
```

#### 2. **Live Data Flow Animation**
```
User changes input:
[data.input: 10] 🔵 (glows blue)
      ↓ ⚡ (animated arrow)
[calc.formula.n: 10] 🔵
      ↓
[formula executing] 💫 (pulsing)
      ↓
[outputs.add.result: 15] 🔵
      ↓ ⚡
[calc.multiply.x: 15] 🔵
      ↓
[outputs.mul.result: 30] 🔵
      ↓ ⚡
[data.finalResult: 30] ✅ (green checkmark)
```

#### 3. **Connection Inspector Panel**
Click on a snippet to see:
```
calc.formula
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Inputs:
  n ← data.input (number)
  add ← outputs.add.result (number)
  mul ← outputs.mul.result (number)

Outputs:
  return → data.finalResult (number)

Upstream Dependencies:
  • calc.add (via add variable)
  • calc.multiply (via mul variable)
  • data.input (direct)

Downstream Consumers:
  • reports.summary
  • ui.display
  • exports.api

Entanglement Status:
  ✅ All links active
  ⏸️ Paused: none
  🔧 Transforms: add (Number)
```

---

## 🛠️ Implementation Architecture

### Module 1: Core Container System
**File:** `modules/fx-snippet-container.ts` (~200 lines, 1 hour)

```typescript
export interface SnippetEnvironment {
  [internalVar: string]: {
    external: string;           // Path to external node
    direction: "in" | "out" | "inout";
    transform?: (val: any) => any;
    validate?: (val: any) => boolean;
    default?: any;
  } | string; // Shorthand: just external path (assumes "in")
}

export interface ReactiveSnippetOptions extends SnippetOptions {
  env?: SnippetEnvironment;
  autoDetect?: boolean;  // Auto-detect function params?
  reactive?: boolean;    // Auto-execute on input changes?
}

export function createReactiveSnippet(
  path: string,
  code: string,
  opts: ReactiveSnippetOptions
): FXNodeProxy {
  // 1. Create base snippet
  const snippet = createSnippet(path, code, opts);

  // 2. Create __env container
  const envPath = `${path}.__env`;

  // 3. Create __connections tracker
  const connPath = `${path}.__connections`;
  $$(`${connPath}.in`).set([]);
  $$(`${connPath}.out`).set([]);

  // 4. Setup each environment variable
  const env = opts.env || {};
  for (const [internalVar, mapping] of Object.entries(env)) {
    setupEnvMapping(path, internalVar, mapping);
  }

  // 5. If reactive, setup auto-execution
  if (opts.reactive) {
    setupReactiveExecution(path);
  }

  return snippet;
}
```

### Module 2: Atomics Integration
**File:** `modules/fx-atomics-integration.ts` (~150 lines, 45 min)

```typescript
import { FXAtomicsPlugin } from "../plugins/fx-atomics.v3.ts";

// Load atomics plugin into our FX
export function loadAtomicsPlugin() {
  if (!fx.pluginManager) {
    throw new Error("FX plugin manager not available");
  }

  fx.pluginManager.register("atomics", FXAtomicsPlugin);
  return fx.proxy("plugins.atomics");
}

export function setupEnvMapping(
  snippetPath: string,
  internalVar: string,
  mapping: any
) {
  const atomics = loadAtomicsPlugin();

  const config = typeof mapping === 'string'
    ? { external: mapping, direction: 'in' as const }
    : mapping;

  const internalPath = `${snippetPath}.__env.${internalVar}`;
  const externalPath = config.external;

  // Create the entanglement based on direction
  let link;

  if (config.direction === 'in') {
    // External → Internal (one-way)
    link = atomics.entangle(externalPath, internalPath, {
      oneWayAToB: true,
      mapAToB: config.transform,
      syncInitialValue: true,
      hooksB: config.validate ? {
        beforeSet: ({ incoming }: any) => {
          return config.validate!(incoming)
            ? { action: 'proceed', value: incoming }
            : { action: 'skip' };
        }
      } : undefined
    });
  } else if (config.direction === 'out') {
    // Internal → External (one-way)
    link = atomics.entangle(internalPath, externalPath, {
      oneWayAToB: true,
      mapAToB: config.transform,
      syncInitialValue: false
    });
  } else {
    // Bi-directional
    link = atomics.entangle(externalPath, internalPath, {
      bidirectional: true,
      mapAToB: config.transform
    });
  }

  // Store the link for later control (pause/resume/dispose)
  $$(`${snippetPath}.__entanglements.${internalVar}`).set(link);

  // Track connection for visualization
  const connList = $$(`${snippetPath}.__connections.${config.direction}`).get() || [];
  connList.push({ internal: internalVar, external: externalPath });
  $$(`${snippetPath}.__connections.${config.direction}`).set(connList);
}
```

### Module 3: Auto-Detection
**File:** `modules/fx-snippet-analyzer.ts` (~300 lines, 1.5 hours)

```typescript
export function analyzeCode(code: string, lang: string): {
  params: string[];
  returns: boolean;
  calls: string[];  // Function calls made
  variables: string[];  // Local variables declared
} {
  switch (lang) {
    case 'js':
    case 'ts':
      return analyzeJavaScript(code);
    case 'py':
      return analyzePython(code);
    case 'rust':
      return analyzeRust(code);
    case 'go':
      return analyzeGo(code);
    default:
      return { params: [], returns: false, calls: [], variables: [] };
  }
}

function analyzeJavaScript(code: string) {
  // Function parameters
  const funcMatch = code.match(/function\s+\w+\s*\(([^)]*)\)/);
  const arrowMatch = code.match(/(?:const|let|var)?\s*\w+\s*=\s*\(([^)]*)\)\s*=>/);

  const paramsStr = funcMatch?.[1] || arrowMatch?.[1] || '';
  const params = paramsStr
    .split(',')
    .map(p => p.trim().split(/[:=\s]/)[0].trim())
    .filter(Boolean);

  // Return statements
  const returns = /return\s+/.test(code);

  // Function calls (approximation)
  const calls = [...code.matchAll(/(\w+)\s*\(/g)]
    .map(m => m[1])
    .filter(name => !['if', 'for', 'while', 'switch', 'function'].includes(name));

  // Variables declared
  const variables = [...code.matchAll(/(?:const|let|var)\s+(\w+)/g)]
    .map(m => m[1]);

  return { params, returns, calls: [...new Set(calls)], variables };
}

function analyzePython(code: string) {
  // def function_name(param1, param2):
  const funcMatch = code.match(/def\s+\w+\s*\(([^)]*)\)/);
  const paramsStr = funcMatch?.[1] || '';
  const params = paramsStr
    .split(',')
    .map(p => p.trim().split(/[=:]/)[0].trim())
    .filter(Boolean);

  const returns = /return\s+/.test(code);

  return { params, returns, calls: [], variables: [] };
}

// Similar for Rust, Go, PHP, etc...
```

### Module 4: Connection Graph Builder
**File:** `modules/fx-connection-graph.ts` (~200 lines, 1 hour)

```typescript
export interface ConnectionNode {
  id: string;
  type: 'snippet' | 'data' | 'input' | 'output';
  label: string;
  metadata?: any;
}

export interface ConnectionEdge {
  from: string;
  to: string;
  variable: string;
  direction: 'in' | 'out';
  transform?: string;
}

export function buildConnectionGraph(): {
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
  clusters: Array<{ id: string; members: string[] }>;
} {
  const nodes: ConnectionNode[] = [];
  const edges: ConnectionEdge[] = [];
  const nodeSet = new Set<string>();

  // Find all reactive snippets
  const snippets = $$("code").select(".snippet");

  for (const snippet of snippets.list()) {
    const snippetPath = snippet.node().__id;
    const meta = snippet.node().__meta || {};

    // Add snippet node
    if (!nodeSet.has(snippetPath)) {
      nodes.push({
        id: snippetPath,
        type: 'snippet',
        label: meta.id || snippetPath,
        metadata: meta
      });
      nodeSet.add(snippetPath);
    }

    // Get connections
    const connections = $$(`${snippetPath}.__connections`).get() || {};

    // Input connections
    for (const conn of connections.in || []) {
      // Add external node if not present
      if (!nodeSet.has(conn.external)) {
        nodes.push({
          id: conn.external,
          type: conn.external.startsWith('inputs.') ? 'input' : 'data',
          label: conn.external.split('.').pop() || conn.external
        });
        nodeSet.add(conn.external);
      }

      // Add edge: external → snippet.internal
      edges.push({
        from: conn.external,
        to: `${snippetPath}.__env.${conn.internal}`,
        variable: conn.internal,
        direction: 'in'
      });
    }

    // Output connections
    for (const conn of connections.out || []) {
      if (!nodeSet.has(conn.external)) {
        nodes.push({
          id: conn.external,
          type: conn.external.startsWith('outputs.') ? 'output' : 'data',
          label: conn.external.split('.').pop() || conn.external
        });
        nodeSet.add(conn.external);
      }

      edges.push({
        from: `${snippetPath}.__env.${conn.internal}`,
        to: conn.external,
        variable: conn.internal,
        direction: 'out'
      });
    }
  }

  return { nodes, edges, clusters: [] };
}

export function exportForVisualizer(outputPath: string) {
  const graph = buildConnectionGraph();
  Deno.writeTextFileSync(outputPath, JSON.stringify(graph, null, 2));
  console.log(`✅ Exported connection graph to ${outputPath}`);
  console.log(`   Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
}
```

### Module 5: Execution Engine
**File:** `modules/fx-snippet-executor.ts` (~250 lines, 1.5 hours)

```typescript
export function executeSnippet(snippetPath: string): any {
  const snippet = $$(snippetPath);
  const code = snippet.val();
  const meta = snippet.node().__meta || {};

  // Get environment values
  const env = $$(`${snippetPath}.__env`).get() || {};

  // Build execution context
  const context: Record<string, any> = {};
  for (const [varName, value] of Object.entries(env)) {
    context[varName] = value;
  }

  // Execute code with environment
  let result;
  try {
    if (meta.lang === 'js' || meta.lang === 'ts') {
      // Create function with env vars as parameters
      const paramNames = Object.keys(context);
      const paramValues = Object.values(context);

      const fn = new Function(...paramNames, code + `\nreturn typeof result !== 'undefined' ? result : undefined;`);
      result = fn(...paramValues);
    }
    // Add Python, Rust, etc. execution via respective runtimes

    // Set return value if it exists
    if (result !== undefined) {
      $$(`${snippetPath}.__env.return`).set(result);
    }

    return result;
  } catch (error) {
    console.error(`[FXD] Error executing snippet ${meta.id}:`, error);
    $$(`${snippetPath}.__errors`).set({ error: String(error), timestamp: Date.now() });
    return undefined;
  }
}

export function setupReactiveExecution(snippetPath: string) {
  // Watch all input environment variables
  const connections = $$(`${snippetPath}.__connections.in`).get() || [];

  for (const conn of connections) {
    const internalPath = `${snippetPath}.__env.${conn.internal}`;

    // When input changes, re-execute snippet
    $$(internalPath).watch(() => {
      // Debounce using microtask
      queueMicrotask(() => {
        executeSnippet(snippetPath);
      });
    });
  }
}
```

---

## 🎨 Enhanced Visualizer

**File:** `public/fxd-reactive-visualizer.html` (~500 lines, 2 hours)

### Features:

1. **Force-Directed Graph**
   - Snippets as blue circles
   - Data nodes as green squares
   - Input nodes as yellow triangles
   - Output nodes as orange hexagons

2. **Animated Data Flow**
   - When value changes, highlight node
   - Animate arrow from source to destination
   - Show value in tooltip
   - Pulsing effect during execution

3. **Interactive Controls**
   - Click node to see connections
   - Double-click to edit value
   - Right-click for context menu
   - Drag to rearrange

4. **Live Updates**
   - WebSocket connection to FX server
   - Real-time graph updates
   - Value change animations
   - Execution trace visualization

---

## 📊 Implementation Timeline

### Session 1: Core Infrastructure (2-3 hours, ~200K tokens)
1. ✅ Port fx-atomics.v3 to work with fxn.ts
2. ✅ Create snippet container system
3. ✅ Build environment mapping infrastructure
4. ✅ Write basic tests

### Session 2: Intelligence Layer (2 hours, ~100K tokens)
5. ✅ Auto-detection for JavaScript
6. ✅ Auto-detection for Python
7. ✅ Connection graph builder
8. ✅ Test auto-detection

### Session 3: Visualization (2 hours, ~100K tokens)
9. ✅ Enhance web visualizer with data flow
10. ✅ Animated propagation
11. ✅ Interactive inspector
12. ✅ Test with live data

### Session 4: Polish & Examples (1 hour, ~50K tokens)
13. ✅ Create amazing demo
14. ✅ Document everything
15. ✅ Add to test suite

**Total: ~7 hours, ~450K tokens**
**Remaining: ~270K for more features or polish!**

---

## 🤔 Design Decisions Needed

Before I start coding, I need your input on:

### 1. **Auto-Detection Behavior**
```typescript
// Option A: Auto-detect + allow override
createReactiveSnippet(path, "function add(a, b) { return a + b; }", {
  // Auto-detects: a, b, return
  // Maps to: inputs.add.a, inputs.add.b, outputs.add.result
});

// Option B: Require explicit declaration
createReactiveSnippet(path, code, {
  env: {
    a: "data.num1",
    b: "data.num2",
    return: "data.sum"
  }
});

// Option C: Hybrid (auto-detect but customizable)
createReactiveSnippet(path, code, {
  autoDetect: true,
  env: {
    a: "custom.path",  // Override auto-detected
    // b: auto-detected as inputs.add.b
    // return: auto-detected as outputs.add.result
  }
});
```

**Which do you prefer?**

### 2. **Execution Model**
```typescript
// Option A: Manual execution only
const result = executeSnippet("calc.add");

// Option B: Auto-execute when inputs change (reactive)
createReactiveSnippet(path, code, { reactive: true });
// Now automatically runs when inputs change!

// Option C: Hybrid (opt-in reactive)
snippet.makeReactive();
snippet.pause();  // Stop auto-execution
snippet.resume(); // Resume auto-execution
```

**Which do you prefer?**

### 3. **Namespace Convention**
```typescript
// Option A: Flat namespace
inputs.a, inputs.b, outputs.result

// Option B: Per-snippet namespace
inputs.add.a, inputs.add.b, outputs.add.result

// Option C: User-defined
env: { a: "wherever.you.want.a" }
```

**Which do you prefer?**

### 4. **Multi-Language Priority**
Start with JavaScript only, or build multi-language from day 1?

- JavaScript/TypeScript: Easy, we have eval/Function
- Python: Need Python runtime or WASM
- Rust: Need compilation step
- Go: Need compilation step

**Start with JS only, or all languages?**

---

## 🚀 Ready to Build!

With **~688K tokens remaining**, I can build this entire vision TODAY!

**Shall I start with:**
- **A.** Port fx-atomics and build core container system first?
- **B.** Start with auto-detection to prove the concept?
- **C.** Build visualizer first to see the end goal?
- **D.** Your priority order?

**I'm ready to make FXD the most revolutionary code organization system ever created!** 🔥

What are your design preferences above, and where should I start?
