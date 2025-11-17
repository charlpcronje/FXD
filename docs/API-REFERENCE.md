<!-- @agent: agent-docs -->
# FXD API Reference

**Complete API documentation for FXD v0.1 Alpha**

---

## Table of Contents

1. [Core API (`$$`)](#core-api-)
2. [FXNode](#fxnode)
3. [FXNodeProxy](#fxnodeproxy)
4. [Group Operations](#group-operations)
5. [Selectors](#selectors)
6. [Watchers](#watchers)
7. [Types & Behaviors](#types--behaviors)

---

## Core API (`$$`)

The `$$` function is the main entry point to the FX framework.

### Import

```typescript
import { $$ } from './fxn.ts';
// or
import { $$ } from './fx.ts';
```

### Basic Usage

```typescript
// Create/get a node
$$('path.to.node')

// Set a value
$$('user.name').val('Alice')

// Get a value
const name = $$('user.name').val()  // 'Alice'

// Chain operations
$$('config.port').val(8080).watch(v => console.log('Port:', v))
```

---

## FXNode

The underlying node structure. Usually accessed via `node()` method.

### Structure

```typescript
interface FXNode {
  __id: string;                    // Unique node ID
  __parent_id: string | null;      // Parent node ID
  __nodes: Record<string, FXNode>; // Child nodes
  __value: any;                    // Node value
  __type: string | null;           // Type name
  __proto: string[];               // Prototype chain
  __behaviors: Map<string, any>;   // Behaviors
  __instances: Map<string, any>;   // Type instances
  __effects: Function[];           // Effect functions
  __watchers: Set<Function>;       // Watch callbacks
  __meta?: Record<string, any>;    // Optional metadata
}
```

### Access Node

```typescript
// Get underlying node
const node = $$('user').node()

console.log(node.__id)        // 'user'
console.log(node.__value)     // current value
console.log(node.__nodes)     // child nodes
```

---

## FXNodeProxy

The proxy wrapper that provides the fluent API.

### `.val()` - Get/Set Value

```typescript
// Get value
const value = $$('config.port').val()

// Set value
$$('config.port').val(8080)

// With options
$$('config.timeout').val(30, { cast: 'number' })

// Set and return proxy
const proxy = $$('user.age').val(25)
```

**Options:**
- `default` - Default value if undefined
- `cast` - Type casting: `'number'`, `'string'`, `'boolean'`, `'json'`, or function
- `createIfMissing` - Create node if it doesn't exist

### `.get()` - Get with Default

```typescript
// Get with default
const port = $$('config.port').get(3000)  // Returns 3000 if undefined

// Get child node
const nameProxy = $$('user').get('name')

// Get with options
const timeout = $$('config.timeout').get(30, { cast: 'number' })
```

### `.set()` - Set Value

```typescript
// Set value
$$('user.name').set('Bob')

// Set child value
$$('user').set('Bob', 'name')

// Set with options
$$('config').set(8080, 'port', { cast: 'number' })
```

### `.node()` - Get FXNode

```typescript
// Get underlying node
const node = $$('user').node()

// Access node properties
console.log(node.__id)
console.log(node.__value)
console.log(node.__nodes)
```

### `.proxy()` - Get Proxy

```typescript
// Get proxy (usually implicit)
const proxy = $$('user').proxy()

// Returns same proxy instance
console.log(proxy === $$('user'))  // true
```

### `.type()` - Get Type

```typescript
// Get type name
const type = $$('user').type()  // string | null

// Check type
if ($$('data').type() === 'UserClass') {
  // ...
}
```

### `.as<T>()` - Type-Safe Unwrap

```typescript
// Unwrap by class
class User { name: string; }
const user = $$('user').as(User)  // User | null

// Unwrap by name
const user2 = $$('user').as<User>('User')  // User | null

// Safe usage
const user = $$('currentUser').as(User)
if (user) {
  console.log(user.name)
}
```

### `.inherit()` - Add Behaviors

```typescript
// Add single behavior
$$('user').inherit(authBehavior)

// Add multiple behaviors
$$('user').inherit(authBehavior, logBehavior, validateBehavior)

// Behaviors add methods to proxy
$$('user').inherit({
  greet() { return `Hello ${this.val().name}` }
})

$$('user').greet()  // Uses inherited method
```

### `.watch()` - Watch Changes

```typescript
// Watch value changes
const unwatch = $$('config.port').watch((newVal, oldVal) => {
  console.log(`Port changed from ${oldVal} to ${newVal}`)
})

// Stop watching
unwatch()

// Watch with specific logic
$$('user.status').watch((status) => {
  if (status === 'active') {
    console.log('User is active!')
  }
})
```

### `.nodes()` - Get Child Proxies

```typescript
// Get all child node proxies
const children = $$('users').nodes()

// Iterate children
for (const [key, proxy] of Object.entries(children)) {
  console.log(key, proxy.val())
}

// Example:
// {
//   'alice': <proxy for users.alice>,
//   'bob': <proxy for users.bob>
// }
```

### Built-in Views

```typescript
// .str() - Convert to string
$$('user.age').val(25).str()  // '25'

// .num() - Convert to number
$$('config.port').val('8080').num()  // 8080

// .bool() - Convert to boolean
$$('feature.enabled').val('true').bool()  // true

// .raw() - Get raw value
$$('data').raw()  // same as .val() but typed as any
```

---

## Group Operations

Groups provide collection-like operations on multiple nodes.

### Create Group

```typescript
// Create group from paths
const group = $$('root').group(['user1', 'user2', 'user3'])

// Create group with selector
const funcs = $$('code').select('[type="function"]')

// Empty group
const empty = $$('root').group()
```

### Add/Remove Items

```typescript
// Add item
group.add('user4')

// Insert at index
group.insert(0, 'user0')

// Prepend
group.prepend('first')

// Add after existing item
group.addAfter('user2', 'user2.5')

// Add before existing item
group.addBefore('user3', 'user2.5')

// Remove item
group.remove('user4')

// Clear all
group.clear()
```

### Selectors

```typescript
// Filter with CSS selector
const jsFuncs = group.select('[language="javascript"]')

// Include items matching selector
group.include('[active="true"]')

// Exclude items matching selector
group.exclude('[deprecated="true"]')

// Remove selector
group.removeSelector('[active="true"]')

// Clear all selectors
group.clearSelectors()           // Clear all
group.clearSelectors('include')  // Clear include only
group.clearSelectors('exclude')  // Clear exclude only
```

### Filter & Transform

```typescript
// Filter with function
const adults = group.where(p => p.get('age').num() >= 18)

// Get as list of proxies
const items = group.list()

// Sum numeric values
const total = group.sum()

// Concatenate string values
const names = group.concat(', ')

// Cast all to type
group.cast('number')  // Convert all to numbers
group.cast('string')  // Convert all to strings
group.cast('boolean') // Convert all to booleans

// Math operations
const max = group.max()
const min = group.min()
const avg = group.average()

// Sort
group.sort('asc')   // Ascending
group.sort('desc')  // Descending

// Check sameness
const allSame = group.same('value')  // All have same value
const sameType = group.same('type')  // All have same type

// Check if has value
const hasActive = group.hasValue('active')
```

### Options

```typescript
// Set mode
group.options({ mode: 'set' })   // Unique items
group.options({ mode: 'list' })  // Allow duplicates

// Set deep traversal
group.deep(true)   // Traverse child nodes
group.deep(false)  // Only direct children

// Set reactive
group.reactive(true)   // Auto-update on changes
group.reactive(false)  // Static snapshot

// Debounce updates
group.debounce(100)  // Debounce by 100ms

// Set name
group.name('activeUsers')
```

### Events

```typescript
// Listen to events
group.on('change', (items) => {
  console.log('Group changed:', items)
})

group.on('add', (item) => {
  console.log('Item added:', item)
})

group.on('remove', (item) => {
  console.log('Item removed:', item)
})

// Remove listener
const handler = (items) => console.log(items)
group.on('change', handler)
group.off('change', handler)
```

---

## Selectors

CSS-like selectors for querying nodes.

### Syntax

```typescript
// By ID (exact path match)
$$('#user')
$$('#config.database.host')

// By attribute
$$('[type="function"]')
$$('[language="javascript"]')
$$('[active="true"]')

// By type (class name)
$$('[__type="User"]')

// Combining selectors
$$('snippets [type="function"][language="javascript"]')

// Complex queries
$$('code [type="function"][export="true"]:not([deprecated="true"])')
```

### Examples

```typescript
// Find all JavaScript functions
const jsFunctions = $$('code').select('[language="javascript"][type="function"]')

// Find all active users
const activeUsers = $$('users').select('[status="active"]')

// Find all public API methods
const publicMethods = $$('api').select('[visibility="public"][type="method"]')

// Exclude deprecated items
const current = $$('items').select('[deprecated!="true"]')
```

---

## Watchers

React to node changes in real-time.

### Basic Watcher

```typescript
// Watch value changes
$$('config.port').watch((newVal, oldVal) => {
  console.log(`Port: ${oldVal} → ${newVal}`)
})
```

### Advanced Watching

```typescript
// Watch with cleanup
const unwatch = $$('user.status').watch((status) => {
  console.log('Status:', status)
})

// Later: stop watching
unwatch()

// Watch child nodes
$$('users').watch((newUsers, oldUsers) => {
  console.log('Users changed')
})

// Watch with derived logic
$$('cart.items').watch((items) => {
  const total = items.reduce((sum, item) => sum + item.price, 0)
  $$('cart.total').val(total)
})
```

### Reactive Chains

```typescript
// Auto-update derived values
$$('order.quantity').watch(qty => {
  const price = $$('order.price').val()
  $$('order.total').val(qty * price)
})

$$('order.price').watch(price => {
  const qty = $$('order.quantity').val()
  $$('order.total').val(qty * price)
})

// Now changing either quantity or price updates total
$$('order.quantity').val(5)  // Updates total
$$('order.price').val(10)    // Updates total
```

---

## Types & Behaviors

Extend nodes with custom types and behaviors.

### Define Type

```typescript
class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  greet() {
    return `Hello, I'm ${this.name}`
  }
}

// Create typed node
$$('currentUser').val(new User('Alice', 'alice@example.com'))

// Access with type safety
const user = $$('currentUser').as(User)
if (user) {
  console.log(user.greet())  // 'Hello, I'm Alice'
}
```

### Add Behaviors

```typescript
// Define behavior
const authBehavior = {
  login(username: string, password: string) {
    // Login logic
    this.val({ ...this.val(), authenticated: true })
  },

  logout() {
    this.val({ ...this.val(), authenticated: false })
  },

  isAuthenticated() {
    return this.val()?.authenticated || false
  }
}

// Attach behavior
$$('session').inherit(authBehavior)

// Use behavior methods
$$('session').login('alice', 'secret123')
console.log($$('session').isAuthenticated())  // true
$$('session').logout()
```

### Prototype Chain

```typescript
// Define prototypes
const timestampProto = {
  setTimestamp() {
    this.val({ ...this.val(), timestamp: Date.now() })
  }
}

const validationProto = {
  validate() {
    // Validation logic
    return this.val() !== null && this.val() !== undefined
  }
}

// Inherit multiple
$$('record').inherit(timestampProto, validationProto)

// Use both
$$('record').setTimestamp()
console.log($$('record').validate())
```

---

## Common Patterns

### Configuration Management

```typescript
// Set config
$$('config.database.host').val('localhost')
$$('config.database.port').val(5432)
$$('config.database.name').val('mydb')

// Get config with defaults
const host = $$('config.database.host').get('localhost')
const port = $$('config.database.port').get(5432)

// Watch config changes
$$('config').watch(() => {
  console.log('Configuration updated')
  reloadApp()
})
```

### State Management

```typescript
// Application state
$$('app.user').val({ name: 'Alice', role: 'admin' })
$$('app.route').val('/dashboard')
$$('app.loading').val(false)

// React to state changes
$$('app.route').watch(route => {
  console.log('Navigating to:', route)
  loadRoute(route)
})

$$('app.loading').watch(loading => {
  document.body.classList.toggle('loading', loading)
})
```

### Collection Management

```typescript
// Users collection
$$('users.alice').val({ name: 'Alice', age: 30 })
$$('users.bob').val({ name: 'Bob', age: 25 })
$$('users.charlie').val({ name: 'Charlie', age: 35 })

// Query users
const adults = $$('users').select('[age>=18]').list()
const seniors = $$('users').select('[age>=65]').list()

// Aggregate
const avgAge = $$('users').group().average()
const names = $$('users').group().concat(', ')
```

### Reactive Computations

```typescript
// Shopping cart
$$('cart.items').val([
  { name: 'Apple', price: 1.5, qty: 3 },
  { name: 'Banana', price: 0.8, qty: 6 }
])

// Auto-calculate totals
$$('cart.items').watch(items => {
  const subtotal = items.reduce((sum, item) =>
    sum + (item.price * item.qty), 0
  )
  $$('cart.subtotal').val(subtotal)
  $$('cart.tax').val(subtotal * 0.1)
  $$('cart.total').val(subtotal * 1.1)
})

// Update cart
$$('cart.items').val([...$$('cart.items').val(), {
  name: 'Orange', price: 1.2, qty: 4
}])
// Totals automatically recalculate
```

---

## Error Handling

```typescript
// Safe value access
const port = $$('config.port').get(8080)  // Returns 8080 if undefined

// Type-safe unwrap
const user = $$('currentUser').as(User)
if (user) {
  // user is User type here
  console.log(user.name)
} else {
  // Handle missing user
  console.log('No user logged in')
}

// Try-catch for behaviors
try {
  $$('session').login('user', 'wrong-password')
} catch (error) {
  console.error('Login failed:', error)
}
```

---

## Performance Tips

1. **Use watchers sparingly** - Each watcher adds overhead
2. **Debounce group updates** - Use `.debounce(ms)` for frequently changing groups
3. **Use selectors efficiently** - Specific selectors are faster than broad ones
4. **Clean up watchers** - Always call `unwatch()` when done
5. **Batch updates** - Update multiple values, then notify watchers once

```typescript
// Good: Batch updates
const values = { name: 'Alice', age: 30, role: 'admin' }
$$('user').val(values)  // One update, one notification

// Bad: Multiple updates
$$('user.name').val('Alice')  // Notifies watchers
$$('user.age').val(30)         // Notifies watchers
$$('user.role').val('admin')   // Notifies watchers
```

---

## Next Steps

- **[CLI Guide](CLI-GUIDE.md)** - Command-line usage
- **[Examples](EXAMPLES.md)** - Working code examples
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues
- **[Getting Started](GETTING-STARTED.md)** - Installation guide

---

<!-- @agent: agent-docs -->
<!-- Last updated: 2025-10-02 -->
