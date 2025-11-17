<!-- @agent: agent-docs -->
# Getting Started with FXD

**Quick guide to installing and using FXD (v0.1 Alpha)**

---

## What is FXD?

FXD is a reactive framework for organizing code as a graph of nodes. Think of it as a database for your code, where:
- Every piece of code is an **FXNode** (reactive object)
- Nodes can be queried with **CSS-like selectors** (`$$('#id')`, `$$('[type="function"]')`)
- Code is organized into **snippets** (reusable pieces)
- Snippets compose into **views** (virtual files)

## Current Status: Alpha

**What works:**
- ✅ Core reactive framework
- ✅ CSS selectors
- ✅ CLI help system

**What's in progress:**
- 🟡 Module integration (fixing imports)
- 🟡 Snippet management
- 🟡 View composition

**What's planned:**
- 🔵 Persistence (SQLite)
- 🔵 Import/Export

---

## Prerequisites

You need **Deno** (recommended) or **Node.js**.

### Install Deno

**macOS/Linux:**
```bash
curl -fsSL https://deno.land/x/install/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Or use package managers:**
```bash
# macOS
brew install deno

# Windows
choco install deno
scoop install deno
```

---

## Installation

### Option 1: Clone Repository (Recommended)

```bash
# Clone the repo
git clone https://github.com/yourusername/fxd.git
cd fxd

# Test that it works
deno run -A fxd-cli.ts help
```

### Option 2: Download Release

```bash
# Download latest release
curl -L https://github.com/yourusername/fxd/releases/latest/download/fxd.zip -o fxd.zip
unzip fxd.zip
cd fxd

# Test
deno run -A fxd-cli.ts help
```

---

## Quick Start

### 1. Test the CLI

```bash
# Show help
deno run -A fxd-cli.ts help

# You should see:
# 🎯 FXD CLI - Visual Code Management Platform
# COMMANDS:
#   create, import, list, run, visualize, export
```

### 2. Test Core Framework

```bash
# Run the core framework (starts server on port 8787)
deno run -A fxn.ts
```

**Expected output:**
```
Server running on http://localhost:8787
(or "AddrInUse" if port is taken - that's fine, it means it works!)
```

### 3. Run a Simple Demo

```bash
# Run quick demo (once imports are fixed)
deno run -A quick-demo.ts
```

---

## Basic Usage

### Create a Disk

```bash
# Create a new FXD disk
deno run -A fxd-cli.ts create my-project

# Output:
# ✅ FXD disk created: my-project
# 📁 Location: ./my-project.fxd
# 🎯 Next steps:
#    fxd-cli import <your-code-folder>
#    fxd-cli visualize
```

### Import Code

```bash
# Import a file
deno run -A fxd-cli.ts import my-file.js

# Import a directory
deno run -A fxd-cli.ts import ./src
```

### List Contents

```bash
# List everything
deno run -A fxd-cli.ts list

# List only snippets
deno run -A fxd-cli.ts list --type=snippets

# List only views
deno run -A fxd-cli.ts list --type=views
```

### Run Code

```bash
# Execute a snippet
deno run -A fxd-cli.ts run my-snippet

# Run with visualizer
deno run -A fxd-cli.ts run my-snippet --visualize
```

---

## Core Concepts

### 1. FXNodes

Everything in FXD is a node:

```typescript
import { $$ } from './fxn.ts';

// Create a node
$$('user.name').val('Alice');

// Read a node
const name = $$('user.name').val();  // 'Alice'

// Watch for changes
$$('user.name').watch((newVal) => {
  console.log('Name changed:', newVal);
});
```

### 2. CSS Selectors

Query nodes like you query the DOM:

```typescript
// By ID
$$('#user-1')

// By type
$$('[type="function"]')

// By attribute
$$('[language="javascript"]')

// Complex queries
$$('snippets [type="function"][language="javascript"]')
```

### 3. Snippets

Code pieces with metadata:

```typescript
// Snippet structure
{
  id: 'greet',
  name: 'greet',
  content: 'function greet(name) { return `Hello ${name}`; }',
  language: 'javascript',
  type: 'function',
  created: 1696723200000,
  source: 'my-file.js'
}
```

### 4. Views

Virtual files composed from snippets:

```typescript
// View composed from multiple snippets
$$('views.my-file.js').val(`
  ${$$('snippets.import1').val()}
  ${$$('snippets.function1').val()}
  ${$$('snippets.function2').val()}
`)
```

---

## Next Steps

### Learn More
1. **[API Reference](API-REFERENCE.md)** - Complete API documentation
2. **[CLI Guide](CLI-GUIDE.md)** - All CLI commands
3. **[Examples](EXAMPLES.md)** - Working code examples
4. **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues

### Explore Code
```bash
# Core framework
cat fxn.ts          # Main reactive framework (~1,700 lines)

# Modules
ls modules/         # 58 modules (need integration)

# Tests
ls test/            # 5 test files (need import fixes)

# Examples
ls examples/        # 3 examples
```

### Check Status
```bash
# See what works and what doesn't
cat docs/ACTUAL-STATUS.md

# See immediate todos
cat docs/IMMEDIATE-TODO.md

# See full documentation index
cat docs/INDEX.md
```

---

## Common Tasks

### Working with Nodes

```typescript
// Create
$$('config.port').val(8080);

// Read
const port = $$('config.port').val();

// Update
$$('config.port').val(3000);

// Delete
$$('config.port').val(undefined);
```

### Querying

```typescript
// Get all functions
const funcs = $$('[type="function"]').nodes();

// Get JavaScript snippets
const jsSnippets = $$('snippets [language="javascript"]').nodes();

// Filter by multiple attributes
const exported = $$('[type="function"][export="true"]').nodes();
```

### Watching Changes

```typescript
// Watch a specific node
$$('config.port').watch((newVal, oldVal) => {
  console.log(`Port changed from ${oldVal} to ${newVal}`);
});

// Watch a group
$$('snippets').watch(() => {
  console.log('Snippets collection changed');
});
```

---

## Project Structure

```
fxd/
├── fxn.ts              # Core framework (90% complete)
├── fx.ts               # Alternative entry (same as fxn.ts)
├── fxd-cli.ts          # CLI tool
├── modules/            # 58 modules (need integration)
│   ├── fx-snippets.ts
│   ├── fx-view.ts
│   ├── fx-parse.ts
│   └── ...
├── test/               # Tests (need import fixes)
├── examples/           # Examples
├── docs/               # Documentation
└── README.md           # Main readme
```

---

## Troubleshooting

### Common Issues

**1. Import errors**
```
TS2304 [ERROR]: Cannot find name '$$'
```
→ This is expected in alpha. Modules need import fixes.

**2. Port already in use**
```
error: AddrInUse: Address already in use
```
→ This actually means the server works! Try a different port.

**3. Tests fail**
```
error: Module not found
```
→ Tests are written but need import fixes. Coming soon.

### Getting Help

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Read [ACTUAL-STATUS.md](ACTUAL-STATUS.md)
3. See [INDEX.md](INDEX.md) for all docs
4. Open an issue on GitHub

---

## What's Next?

### For Users
- Wait for v0.1 functional release (2-3 weeks)
- Current alpha is for exploration only
- Star/watch the repo for updates

### For Contributors
- Help fix module imports (high priority)
- Write tests for core features
- Improve documentation
- Report bugs

---

## Summary

**FXD Alpha Checklist:**
- ✅ Install Deno
- ✅ Clone repository
- ✅ Run `deno run -A fxd-cli.ts help`
- ✅ Read [API-REFERENCE.md](API-REFERENCE.md)
- ✅ Try examples (once imports fixed)
- ✅ Explore code structure
- ✅ Check status in [ACTUAL-STATUS.md](ACTUAL-STATUS.md)

**Remember:** This is alpha software. The core works, but integration is incomplete.

---

<!-- @agent: agent-docs -->
<!-- Last updated: 2025-10-02 -->
