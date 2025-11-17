<!-- @agent: agent-docs -->
# FXD Examples

**Working code examples and use cases**

---

## Status

**v0.1 Alpha:** Examples exist but need import fixes to run. Expected to work in 1-2 weeks.

Current examples location: `examples/` directory

---

## Table of Contents

1. [Basic Examples](#basic-examples)
2. [Core Framework Examples](#core-framework-examples)
3. [CLI Usage Examples](#cli-usage-examples)
4. [Advanced Examples](#advanced-examples)
5. [Example Files](#example-files)

---

## Basic Examples

### 1. Hello World

```typescript
import { $$ } from './fxn.ts'

// Set a value
$$('greeting').val('Hello, FXD!')

// Get the value
const message = $$('greeting').val()
console.log(message)  // 'Hello, FXD!'
```

### 2. Simple Counter

```typescript
import { $$ } from './fxn.ts'

// Initialize counter
$$('counter').val(0)

// Increment function
function increment() {
  const current = $$('counter').val()
  $$('counter').val(current + 1)
}

// Watch changes
$$('counter').watch((newVal, oldVal) => {
  console.log(`Counter: ${oldVal} → ${newVal}`)
})

// Test it
increment()  // Counter: 0 → 1
increment()  // Counter: 1 → 2
increment()  // Counter: 2 → 3
```

### 3. Configuration Management

```typescript
import { $$ } from './fxn.ts'

// Set configuration
$$('config.database.host').val('localhost')
$$('config.database.port').val(5432)
$$('config.database.name').val('mydb')
$$('config.api.port').val(3000)
$$('config.api.timeout').val(30000)

// Get config with defaults
const dbHost = $$('config.database.host').get('localhost')
const dbPort = $$('config.database.port').get(5432)
const apiPort = $$('config.api.port').get(3000)

console.log('Database:', dbHost, dbPort)
console.log('API Port:', apiPort)

// Watch for config changes
$$('config.api').watch(() => {
  console.log('API config changed!')
})
```

---

## Core Framework Examples

### 1. Reactive Data Flow

```typescript
import { $$ } from './fxn.ts'

// Create reactive shopping cart
$$('cart.items').val([
  { name: 'Apple', price: 1.5, qty: 3 },
  { name: 'Banana', price: 0.8, qty: 6 }
])

// Auto-calculate totals
$$('cart.items').watch(items => {
  const subtotal = items.reduce((sum: number, item: any) =>
    sum + (item.price * item.qty), 0
  )

  $$('cart.subtotal').val(subtotal)
  $$('cart.tax').val(subtotal * 0.1)
  $$('cart.total').val(subtotal * 1.1)

  console.log('Cart updated:', {
    subtotal: $$('cart.subtotal').val(),
    tax: $$('cart.tax').val(),
    total: $$('cart.total').val()
  })
})

// Trigger calculation
$$('cart.items').val($$('cart.items').val())
```

### 2. CSS Selectors

```typescript
import { $$ } from './fxn.ts'

// Create some nodes with attributes
$$('users.alice').val({ name: 'Alice', age: 30, active: true })
$$('users.bob').val({ name: 'Bob', age: 25, active: true })
$$('users.charlie').val({ name: 'Charlie', age: 35, active: false })

// Query with selectors
const activeUsers = $$('users').select('[active="true"]')
console.log('Active users:', activeUsers.list())

// Query by age
const adults = $$('users').select('[age>=30]')
console.log('Adults:', adults.list())

// Complex queries
const activeAdults = $$('users')
  .select('[active="true"]')
  .select('[age>=30]')
console.log('Active adults:', activeAdults.list())
```

### 3. Groups & Collections

```typescript
import { $$ } from './fxn.ts'

// Create user collection
$$('users.alice').val({ name: 'Alice', score: 95 })
$$('users.bob').val({ name: 'Bob', score: 87 })
$$('users.charlie').val({ name: 'Charlie', score: 92 })

// Create a group
const usersGroup = $$('users').group(['alice', 'bob', 'charlie'])

// Aggregate operations
const avgScore = usersGroup.average()
console.log('Average score:', avgScore)  // 91.33

const maxScore = usersGroup.max()
console.log('Max score:', maxScore)  // 95

const allNames = usersGroup.concat(', ')
console.log('All names:', allNames)  // 'Alice, Bob, Charlie'

// Filter group
const topScorers = usersGroup.where(p => p.get('score').num() >= 90)
console.log('Top scorers:', topScorers.list())
```

### 4. Watchers & Reactions

```typescript
import { $$ } from './fxn.ts'

// Temperature converter
$$('temp.celsius').val(0)

// Watch Celsius, update Fahrenheit
$$('temp.celsius').watch(c => {
  const f = (c * 9/5) + 32
  $$('temp.fahrenheit').val(f)
  console.log(`${c}°C = ${f}°F`)
})

// Watch Fahrenheit, update Celsius
$$('temp.fahrenheit').watch(f => {
  const c = (f - 32) * 5/9
  // Prevent infinite loop - only update if different
  if ($$('temp.celsius').val() !== c) {
    $$('temp.celsius').val(c)
  }
})

// Test it
$$('temp.celsius').val(25)   // 25°C = 77°F
$$('temp.fahrenheit').val(32)  // 0°C = 32°F
```

---

## CLI Usage Examples

### 1. Import Project

```bash
# Create a new disk
deno run -A fxd-cli.ts create my-app

# Import source code
deno run -A fxd-cli.ts import ./src

# Expected output:
# 📥 Importing files from: ./src
# 📁 Importing directory: ./src
#   📄 app.js
#   ✓ Snippet: app.main
#   ✓ Snippet: app.config
#   📄 utils.js
#   ✓ Snippet: utils.helper
#   ✓ Snippet: utils.format
#
# ✅ Import completed!
#    Files imported: 2
#    Snippets created: 4
```

### 2. List & Run Snippets

```bash
# List all snippets
deno run -A fxd-cli.ts list --type=snippets

# Expected output:
# ✂️  SNIPPETS (4):
# ────────────────────────────────────────
#    1. app.main
#       Language: javascript | Type: function | Lines: 25
#    2. app.config
#       Language: javascript | Type: function | Lines: 10
#    3. utils.helper
#       Language: javascript | Type: function | Lines: 15
#    4. utils.format
#       Language: javascript | Type: function | Lines: 8

# Run a specific snippet
deno run -A fxd-cli.ts run app.main

# Expected output:
# 🚀 Running snippet: app.main
# ────────────────────────────────────────
# Language: javascript
# Type: function
# ────────────────────────────────────────
#
# ✅ Execution completed successfully!
# ⏱️  Execution time: 12ms
```

### 3. Export Project

```bash
# Export as files
deno run -A fxd-cli.ts export ./output

# Expected output:
# 📤 Exporting FXD Contents
# ============================================================
#
# 📁 Export format: Individual files
# 📂 Output path: ./output
#
#   ✓ app.js (3.45 KB)
#   ✓ utils.js (1.89 KB)
#   ✓ _snippets.json (metadata)
#
# ✅ Export completed!
#    Files created: 3
#    Total size: 5.34 KB

# Export as archive
deno run -A fxd-cli.ts export ./archive --format=archive

# Expected output:
# 📦 Export format: Archive
#   ✓ fxd-archive.json (8.92 KB)
#
# 📊 Archive contents:
#      Snippets: 4
#      Views: 2
```

---

## Advanced Examples

### 1. Custom Types & Behaviors

```typescript
import { $$ } from './fxn.ts'

// Define a User class
class User {
  constructor(
    public name: string,
    public email: string,
    public role: string = 'user'
  ) {}

  isAdmin(): boolean {
    return this.role === 'admin'
  }

  greet(): string {
    return `Hello, I'm ${this.name}`
  }
}

// Create typed node
const alice = new User('Alice', 'alice@example.com', 'admin')
$$('currentUser').val(alice)

// Type-safe access
const user = $$('currentUser').as(User)
if (user) {
  console.log(user.greet())     // 'Hello, I'm Alice'
  console.log(user.isAdmin())   // true
}

// Add behavior
const authBehavior = {
  login(username: string, password: string) {
    // Simplified login
    this.val({ ...this.val(), authenticated: true })
    console.log(`${username} logged in`)
  },

  logout() {
    this.val({ ...this.val(), authenticated: false })
    console.log('Logged out')
  }
}

$$('session').inherit(authBehavior)
$$('session').login('alice', 'secret123')
```

### 2. Reactive UI State

```typescript
import { $$ } from './fxn.ts'

// Application state
$$('app.route').val('/')
$$('app.user').val(null)
$$('app.loading').val(false)
$$('app.error').val(null)

// Route watcher
$$('app.route').watch(route => {
  console.log('Navigating to:', route)
  $$('app.loading').val(true)

  // Simulate route loading
  setTimeout(() => {
    $$('app.loading').val(false)
    console.log('Route loaded:', route)
  }, 500)
})

// User watcher
$$('app.user').watch(user => {
  if (user) {
    console.log('User logged in:', user.name)
    $$('app.route').val('/dashboard')
  } else {
    console.log('User logged out')
    $$('app.route').val('/login')
  }
})

// Error watcher
$$('app.error').watch(error => {
  if (error) {
    console.error('App error:', error)
    // Show error UI
  }
})

// Simulate login
setTimeout(() => {
  $$('app.user').val({ name: 'Alice', role: 'admin' })
}, 1000)
```

### 3. Data Aggregation

```typescript
import { $$ } from './fxn.ts'

// Sales data
$$('sales.jan').val({ month: 'Jan', revenue: 45000, costs: 32000 })
$$('sales.feb').val({ month: 'Feb', revenue: 52000, costs: 35000 })
$$('sales.mar').val({ month: 'Mar', revenue: 48000, costs: 33000 })

// Create sales group
const salesGroup = $$('sales').group(['jan', 'feb', 'mar'])

// Calculate total revenue
const totalRevenue = salesGroup
  .where(p => p.val())
  .list()
  .reduce((sum, p) => sum + p.val().revenue, 0)

console.log('Total revenue:', totalRevenue)  // 145000

// Calculate average profit
const profits = salesGroup.list().map(p => {
  const data = p.val()
  return data.revenue - data.costs
})

const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length
console.log('Average profit:', avgProfit)  // 14333.33

// Best month
const bestMonth = salesGroup.list().reduce((best, p) => {
  const current = p.val()
  const bestData = best.val()
  return current.revenue > bestData.revenue ? p : best
})

console.log('Best month:', bestMonth.val().month)  // 'Feb'
```

---

## Example Files

### 1. Repo JS Demo

**Location:** `examples/repo-js/demo.ts`

**Purpose:** Demonstrates round-trip editing (render → edit → parse → apply)

**Status:** Needs import fixes (in progress)

**What it does:**
```typescript
// 1. Seed snippets + view
seedRepoSnippets()

// 2. Render view as file
const text = renderView("views.repoFile", { lang: "js" })

// 3. Simulate editor change
const edited = text.replace("findUser", "findUserById")

// 4. Parse edits into patches
const patches = toPatches(edited)

// 5. Apply patches to FX graph
applyPatches(patches)

// 6. Re-render - should show changes
const updated = renderView("views.repoFile", { lang: "js" })
```

**Expected output:**
```
--- Initial Render ---
(rendered code with findUser)

--- Patches ---
[{ op: "replace", path: "...", value: "findUserById" }]

--- After Apply ---
(rendered code with findUserById)
```

### 2. MCP Client Demo

**Location:** `examples/mcp-client-demo.ts`

**Purpose:** Demonstrates MCP (Model Context Protocol) integration

**Status:** Needs integration work

**Features:**
- Connect to MCP server
- Execute remote operations
- Sync state between client/server

### 3. Simple Examples

**Quick demo files:**

**quick-demo.ts:**
```typescript
import { $$ } from './fxn.ts'

// Simple reactive demo
$$('count').val(0)
$$('count').watch(v => console.log('Count:', v))

setInterval(() => {
  $$('count').val($$('count').val() + 1)
}, 1000)
```

**simple-demo.ts:**
```typescript
import { $$ } from './fxn.ts'

console.log('FXD Simple Demo')

// Basic operations
$$('app.name').val('MyApp')
$$('app.version').val('1.0.0')

console.log('App:', $$('app.name').val())
console.log('Version:', $$('app.version').val())
```

---

## Running Examples

### Current Status (v0.1 Alpha)

Examples are **written but need import fixes** to run. Expected timeline: 1-2 weeks.

### Once Fixed (v0.2+)

```bash
# Run quick demo
deno run -A quick-demo.ts

# Run simple demo
deno run -A simple-demo.ts

# Run repo demo
deno run -A examples/repo-js/demo.ts

# Run MCP demo
deno run -A examples/mcp-client-demo.ts
```

### Expected Output

When working, you should see:
- ✅ Clean execution
- 📊 Reactive updates
- 🔄 Proper data flow
- 🎯 Expected results

---

## Creating Your Own Examples

### Template

```typescript
import { $$ } from './fxn.ts'

// 1. Set up data
$$('myData.value').val(42)

// 2. Add logic
function process() {
  const value = $$('myData.value').val()
  return value * 2
}

// 3. Watch changes
$$('myData.value').watch(v => {
  console.log('Value changed:', v)
})

// 4. Test it
console.log('Result:', process())
$$('myData.value').val(50)
```

### Best Practices

1. **Import core:** Always import `$$` from `fxn.ts` or `fx.ts`
2. **Initialize state:** Set up initial values clearly
3. **Add watchers:** Use `.watch()` for reactive behavior
4. **Clean up:** Call `unwatch()` when done
5. **Comment code:** Explain what each part does
6. **Test thoroughly:** Try edge cases

---

## Example Use Cases

### 1. State Management
```typescript
// Centralized app state
$$('state.user').val(null)
$$('state.theme').val('light')
$$('state.language').val('en')

// React to changes
$$('state.theme').watch(theme => {
  document.body.className = theme
})
```

### 2. Form Validation
```typescript
// Form fields
$$('form.email').val('')
$$('form.password').val('')

// Validation
$$('form.email').watch(email => {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  $$('form.emailValid').val(valid)
})

$$('form.password').watch(pwd => {
  $$('form.passwordValid').val(pwd.length >= 8)
})
```

### 3. Real-time Dashboard
```typescript
// Metrics
$$('metrics.users').val(0)
$$('metrics.revenue').val(0)
$$('metrics.errors').val(0)

// Update dashboard
$$('metrics').watch(() => {
  const users = $$('metrics.users').val()
  const revenue = $$('metrics.revenue').val()
  const errors = $$('metrics.errors').val()

  console.log(`Users: ${users}, Revenue: $${revenue}, Errors: ${errors}`)
})
```

---

## Troubleshooting Examples

### Common Issues

**1. Import errors**
```
TS2304 [ERROR]: Cannot find name '$$'
```
→ Wait for v0.2 with import fixes

**2. Module not found**
```
error: Module not found
```
→ Check import paths are correct

**3. Undefined values**
```typescript
// Bad
const value = $$('undefined.path').val()  // undefined

// Good
const value = $$('undefined.path').get(defaultValue)
```

### Getting Help

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [API-REFERENCE.md](API-REFERENCE.md)
3. See [GETTING-STARTED.md](GETTING-STARTED.md)
4. Open an issue on GitHub

---

## Next Steps

- **[Getting Started](GETTING-STARTED.md)** - Installation guide
- **[API Reference](API-REFERENCE.md)** - Complete API docs
- **[CLI Guide](CLI-GUIDE.md)** - CLI commands
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues

---

<!-- @agent: agent-docs -->
<!-- Last updated: 2025-10-02 -->
