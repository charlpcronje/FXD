# 🌟 FXD + Atomics Integration Vision

## What I'm Seeing

### fx-atomics.v3.ts (374 lines)
**A sophisticated entanglement system** that provides:

✅ **Bi-directional sync** between two nodes (A ↔ B)
✅ **Lifecycle hooks** (beforeSet, set, afterSet) on both sides
✅ **Transform functions** (mapAToB, mapBToA) for data conversion
✅ **Re-entrancy protection** (no ping-pong loops)
✅ **Microtask coalescing** (avoid thrashing)
✅ **Pause/Resume/Dispose** controls
✅ **One-way propagation** option (A→B only or B→A only)
✅ **Equality checking** (custom comparators)

### Your Vision Applied to FXD

## Current FXD Snippets (Passive)
```typescript
createSnippet("code.calculateTax", `
  function calculateTax(income, rate) {
    return income * rate;
  }
`, { id: "tax-calc", lang: "js" });
```

Just text. No connections. No reactivity.

---

## Proposed: Containerized Reactive Snippets

```typescript
createReactiveSnippet("code.calculateTax", `
  function calculateTax(income, rate) {
    return income * rate;
  }
`, {
  id: "tax-calc",
  lang: "js",

  // Internal → External Variable Mapping (like Docker ENV)
  variables: {
    // Inside the snippet, it's called "income"
    // Outside, it's connected to a node
    income: {
      external: "data.user.income",
      direction: "in",  // external → internal
      transform: (val) => Number(val)
    },

    rate: {
      external: "config.tax.rate",
      direction: "in",
      default: 0.21
    },

    // Return value
    return: {
      external: "results.taxAmount",
      direction: "out"  // internal → external
    }
  }
});
```

### What Happens Automatically

1. **Snippet gets its own node container:**
   ```
   code.calculateTax
   ├── __snippet (the code text)
   ├── __vars (internal scope)
   │   ├── income (connected via atomics)
   │   └── rate (connected via atomics)
   └── __connections (tracked dependencies)
       ├── data.user.income → income (IN)
       ├── config.tax.rate → rate (IN)
       └── return → results.taxAmount (OUT)
   ```

2. **Atomics creates entanglements:**
   ```typescript
   // When external data changes, internal var updates
   atomics.entangle("data.user.income", "code.calculateTax.__vars.income", {
     oneWayAToB: true,
     mapAToB: (val) => Number(val)
   });

   atomics.entangle("config.tax.rate", "code.calculateTax.__vars.rate", {
     oneWayAToB: true
   });

   // When snippet executes, result flows out
   atomics.entangle("code.calculateTax.__vars.return", "results.taxAmount", {
     oneWayAToB: true
   });
   ```

3. **Visualizer shows the flow:**
   ```
   [data.user.income] ──→ [calculateTax.income]
   [config.tax.rate]  ──→ [calculateTax.rate]
   [calculateTax.return] ──→ [results.taxAmount]
   ```

---

## 🎯 What This Enables

### 1. **Automatic Dependency Tracking**
```typescript
// Question: What snippets depend on data.user.income?
const deps = $$("data.user.income").__connections.out;
// Answer: ["code.calculateTax", "code.validateUser", ...]
```

### 2. **Reactive Re-execution**
```typescript
// Change user income
$$("data.user.income").val(50000);
// → Automatically triggers calculateTax with new income
// → Result flows to results.taxAmount
// → Any snippet depending on taxAmount re-executes
```

### 3. **Visual Data Flow**
```
Visualizer can show:
- Arrows from data sources to consumers
- Highlight active data flows (when values change)
- Show what breaks if you remove a snippet
- Animate data propagating through the system
```

### 4. **Testability**
```typescript
// Test a snippet in isolation
const snippet = $$("code.calculateTax");

// Set mock inputs
snippet.setInput("income", 50000);
snippet.setInput("rate", 0.21);

// Execute
snippet.execute();

// Check output
assertEquals(snippet.getOutput("return"), 10500);
```

### 5. **Multi-Language Support**
Same mapping works for ANY language:

**Python:**
```python
def calculate_tax(income, rate):
    return income * rate
```

**Rust:**
```rust
fn calculate_tax(income: f64, rate: f64) -> f64 {
    income * rate
}
```

**Go:**
```go
func calculateTax(income, rate float64) float64 {
    return income * rate
}
```

All get the same variable mapping infrastructure!

---

## 🚀 Implementation Plan

### Phase 1: Variable Mapping System (2 hours, ~100K tokens)

**Create:** `modules/fx-snippet-vars.ts`

```typescript
export interface VariableMapping {
  internal: string;        // Variable name inside snippet
  external: string;        // Path to external FX node
  direction: "in" | "out" | "inout";
  transform?: (val: any) => any;
  default?: any;
}

export interface ReactiveSnippetOptions {
  id: string;
  lang: string;
  file?: string;
  order?: number;
  version?: number;

  // NEW: Variable mappings
  variables?: Record<string, VariableMapping | string>; // string is shorthand for external path
}

export function createReactiveSnippet(
  path: string,
  code: string,
  opts: ReactiveSnippetOptions
) {
  // 1. Create the snippet node
  createSnippet(path, code, opts);

  // 2. Create variable container
  const varContainer = $$(`${path}.__vars`);

  // 3. Create connections metadata
  const connections = $$(`${path}.__connections`);

  // 4. For each variable mapping, create entanglement
  if (opts.variables) {
    for (const [internalName, mapping] of Object.entries(opts.variables)) {
      setupVariableMapping(path, internalName, mapping);
    }
  }

  return $$(path);
}
```

### Phase 2: Atomics Integration (1 hour, ~50K tokens)

**Create:** `modules/fx-snippet-atomics.ts`

Integrate fx-atomics.v3 plugin:
```typescript
import { FXAtomicsPlugin } from "./fx-atomics.v3.ts";

// Register atomics plugin
fx.pluginManager.register("atomics", FXAtomicsPlugin);

function setupVariableMapping(
  snippetPath: string,
  internalName: string,
  mapping: VariableMapping | string
) {
  const atomics = fx.plugins.atomics;

  const config = typeof mapping === 'string'
    ? { external: mapping, direction: 'in' as const }
    : mapping;

  const internalPath = `${snippetPath}.__vars.${internalName}`;
  const externalPath = config.external;

  // Create entanglement based on direction
  if (config.direction === 'in') {
    atomics.entangle(externalPath, internalPath, {
      oneWayAToB: true,
      mapAToB: config.transform,
      syncInitialValue: true
    });
  } else if (config.direction === 'out') {
    atomics.entangle(internalPath, externalPath, {
      oneWayAToB: true,
      mapAToB: config.transform,
      syncInitialValue: false
    });
  } else {
    // Bi-directional
    atomics.entangle(externalPath, internalPath, {
      bidirectional: true,
      mapAToB: config.transform
    });
  }

  // Track connection for visualization
  $$(`${snippetPath}.__connections.${config.direction}`).set([
    ...($$(`${snippetPath}.__connections.${config.direction}`).get() || []),
    { internal: internalName, external: externalPath }
  ]);
}
```

### Phase 3: Auto Variable Detection (2 hours, ~100K tokens)

**Create:** `modules/fx-snippet-analyzer.ts`

Use simple regex or AST parsing to auto-detect variables:

```typescript
export function analyzeSnippetVariables(code: string, lang: string): {
  parameters: string[];
  returns: boolean;
  locals: string[];
  globals: string[];
} {
  // For JavaScript/TypeScript
  if (lang === 'js' || lang === 'ts') {
    // Detect function parameters
    const funcMatch = code.match(/function\s+\w+\s*\(([^)]*)\)/);
    const arrowMatch = code.match(/\(([^)]*)\)\s*=>/);
    const params = (funcMatch?.[1] || arrowMatch?.[1] || '')
      .split(',')
      .map(p => p.trim().split(/[:=]/)[0].trim())
      .filter(Boolean);

    // Detect return statements
    const hasReturn = /return\s+/.test(code);

    return {
      parameters: params,
      returns: hasReturn,
      locals: [],  // Would need AST for this
      globals: []  // Would need AST for this
    };
  }

  // Similar for Python, Rust, Go, etc.
  return { parameters: [], returns: false, locals: [], globals: [] };
}

export function createSmartSnippet(path: string, code: string, opts: any) {
  // Auto-detect variables
  const analysis = analyzeSnippetVariables(code, opts.lang || 'js');

  // Auto-create mappings for parameters
  const autoMappings: Record<string, any> = {};
  for (const param of analysis.parameters) {
    autoMappings[param] = {
      external: `inputs.${param}`,  // Default external path
      direction: 'in'
    };
  }

  if (analysis.returns) {
    autoMappings['return'] = {
      external: `outputs.${opts.id}`,
      direction: 'out'
    };
  }

  // Merge with user-provided mappings
  opts.variables = { ...autoMappings, ...opts.variables };

  return createReactiveSnippet(path, code, opts);
}
```

### Phase 4: Connection Tracking & Visualization (2 hours, ~100K tokens)

**Create:** `modules/fx-connection-graph.ts`

```typescript
export function getConnectionGraph(): {
  nodes: Array<{ id: string; type: 'snippet' | 'data' }>;
  edges: Array<{ from: string; to: string; variable: string }>;
} {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Find all snippets
  const snippets = $$("code").select(".snippet");

  for (const snippet of snippets) {
    const snippetPath = snippet.node().__id;
    nodes.push({ id: snippetPath, type: 'snippet' });

    // Get connections
    const connections = $$(`${snippetPath}.__connections`).get() || {};

    // Input connections
    for (const conn of connections.in || []) {
      edges.push({
        from: conn.external,
        to: `${snippetPath}.${conn.internal}`,
        variable: conn.internal
      });

      // Add data node if not already present
      if (!nodes.find(n => n.id === conn.external)) {
        nodes.push({ id: conn.external, type: 'data' });
      }
    }

    // Output connections
    for (const conn of connections.out || []) {
      edges.push({
        from: `${snippetPath}.${conn.internal}`,
        to: conn.external,
        variable: conn.internal
      });

      if (!nodes.find(n => n.id === conn.external)) {
        nodes.push({ id: conn.external, type: 'data' });
      }
    }
  }

  return { nodes, edges };
}

// Export for visualizer
export function exportConnectionGraphForViz(filePath: string) {
  const graph = getConnectionGraph();
  Deno.writeTextFileSync(filePath, JSON.stringify(graph, null, 2));
}
```

### Phase 5: Visualizer Integration (2 hours, ~100K tokens)

Enhance web visualizer to show data flow:

```typescript
// In visualizer HTML/JS
const graph = await fetch('/api/connections').then(r => r.json());

// Draw nodes
graph.nodes.forEach(node => {
  const color = node.type === 'snippet' ? 'blue' : 'green';
  drawNode(node.id, color);
});

// Draw edges with arrows
graph.edges.forEach(edge => {
  drawArrow(edge.from, edge.to, edge.variable);
});

// Animate when data changes
socket.on('valueChange', ({ path, value }) => {
  highlightNode(path);
  animateEdgesFrom(path);
});
```

---

## 🤯 Mind-Blowing Example

### Before (Current FXD)
```typescript
// Three separate snippets, no connection
createSnippet("calc.add", "function add(a, b) { return a + b; }");
createSnippet("calc.multiply", "function mul(a, b) { return a * b; }");
createSnippet("calc.formula", "function formula(x) { return mul(add(x, 5), 2); }");

// No way to know these are connected
// No way to track data flow
// No way to test in isolation
```

### After (Reactive Containerized)
```typescript
// Snippet 1: Add function
createReactiveSnippet("calc.add", `
  function add(a, b) { return a + b; }
`, {
  id: "add",
  variables: {
    a: { external: "inputs.add.a", direction: "in" },
    b: { external: "inputs.add.b", direction: "in" },
    return: { external: "outputs.add", direction: "out" }
  }
});

// Snippet 2: Multiply function
createReactiveSnippet("calc.multiply", `
  function mul(a, b) { return a * b; }
`, {
  id: "mul",
  variables: {
    a: { external: "inputs.mul.a", direction: "in" },
    b: { external: "inputs.mul.b", direction: "in" },
    return: { external: "outputs.mul", direction: "out" }
  }
});

// Snippet 3: Formula that composes the others
createReactiveSnippet("calc.formula", `
  function formula(x) {
    const addResult = add(x, 5);
    return mul(addResult, 2);
  }
`, {
  id: "formula",
  variables: {
    x: { external: "data.input", direction: "in" },
    add: { external: "outputs.add", direction: "in" },  // Consumes add's output!
    mul: { external: "outputs.mul", direction: "in" },  // Consumes mul's output!
    return: { external: "data.result", direction: "out" }
  }
});

// NOW THE MAGIC:
$$("data.input").val(10);

// Automatically:
// 1. formula.x gets 10
// 2. Snippet knows add(10, 5) is needed
// 3. inputs.add.a gets 10, inputs.add.b gets 5
// 4. add executes → outputs.add = 15
// 5. formula.add gets 15
// 6. Snippet knows mul(15, 2) is needed
// 7. inputs.mul.a gets 15, inputs.mul.b gets 2
// 8. mul executes → outputs.mul = 30
// 9. formula.mul gets 30
// 10. formula returns 30 → data.result = 30

// ALL AUTOMATIC! ALL REACTIVE! ALL TRACKED!
```

---

## 🎨 Visualizer Enhancements

### Data Flow Animation
```
When you change $$("data.input").val(20):

[data.input] 🔵 (changes to 20)
     ↓ ⚡ (animated flow)
[calc.formula.x] 🔵
     ↓
[calc.add] 💫 (executes)
     ↓
[outputs.add] 🔵 (becomes 25)
     ↓
[calc.multiply] 💫 (executes)
     ↓
[outputs.mul] 🔵 (becomes 50)
     ↓
[data.result] 🔵 (final: 50)
```

### Dependency Inspector
```
Click on "calc.formula":
  Inputs:
    ✓ x ← data.input
    ✓ add ← outputs.add (from calc.add)
    ✓ mul ← outputs.mul (from calc.multiply)

  Outputs:
    ✓ return → data.result

  Upstream Dependencies:
    - calc.add
    - calc.multiply
    - data.input
    - config.tax.rate (indirect via add)

  Downstream Dependents:
    - reports.summary
    - ui.display
```

---

## 🛠️ Implementation Architecture

### New Modules to Create

1. **`modules/fx-snippet-vars.ts`**
   - VariableMapping interface
   - createReactiveSnippet()
   - setupVariableMapping()

2. **`modules/fx-snippet-atomics.ts`**
   - Integrate fx-atomics.v3
   - Entanglement creation
   - Connection tracking

3. **`modules/fx-snippet-analyzer.ts`**
   - Code analysis (regex or AST)
   - Auto-detect parameters/returns
   - Multi-language support

4. **`modules/fx-connection-graph.ts`**
   - Build connection graph
   - Export for visualizer
   - Dependency queries

5. **`modules/fx-snippet-executor.ts`**
   - Execute snippets with mapped variables
   - Sandbox/isolation
   - Error handling

### Enhanced Visualizer

6. **`public/fxd-atomics-visualizer.html`**
   - Force-directed graph with data flow
   - Animated value propagation
   - Click to inspect connections
   - Edit mode (change values, see flow)

---

## 💡 What I'm Thinking

### This is REVOLUTIONARY Because:

1. **Docker-like Variable Isolation**
   - Snippets are isolated containers
   - Internal vars mapped to external world
   - Same concept developers already know

2. **Automatic Dependency Injection**
   - No manual wiring
   - Just declare what you need
   - Atomics handles the rest

3. **Visual Data Flow**
   - See exactly what depends on what
   - Understand system at a glance
   - Debug by watching data flow

4. **Language Agnostic**
   - Works for JS, Python, Rust, Go, PHP
   - Same mapping concept everywhere
   - Use the right FX runtime per language

5. **Testable & Composable**
   - Test snippets in isolation
   - Compose complex flows from simple pieces
   - No side effects, pure reactive

### Comparison to Current FXD

**Current:** Snippets are text blocks with markers
**Proposed:** Snippets are reactive containers with I/O contracts

**Current:** Static composition (render views)
**Proposed:** Dynamic composition (data flows through)

**Current:** Manual dependency tracking
**Proposed:** Automatic with visualization

---

## 🎯 Questions for You

Before I start implementing:

1. **Auto-detection vs Manual?**
   - Should I auto-detect function parameters?
   - Or require explicit mapping declarations?
   - Or hybrid (auto-detect, allow override)?

2. **Execution Model?**
   - Should snippets auto-execute when inputs change?
   - Or require manual trigger?
   - Or configurable?

3. **Multi-Language Priority?**
   - Start with JavaScript only?
   - Or build multi-language from the start?
   - Which languages are highest priority?

4. **Integration with Current FXD?**
   - Make this an optional layer (createReactiveSnippet vs createSnippet)?
   - Or make all snippets reactive by default?

5. **Visualizer Focus?**
   - Enhance existing HTML files?
   - Or create new dedicated data-flow visualizer?

---

## ⚡ Let's Build This!

With **~720K tokens remaining**, we can:

✅ Build complete variable mapping system
✅ Integrate fx-atomics
✅ Auto-detect variables (multi-language)
✅ Track all connections
✅ Create data flow visualizer
✅ Write comprehensive tests
✅ Create amazing examples
✅ Document everything

**This could be the feature that makes FXD legendary.**

**Ready to start? Which aspect should we tackle first?** 🚀
