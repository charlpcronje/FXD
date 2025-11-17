# Selector Demo Example

**Location:** `examples/selector-demo/`
**Difficulty:** Intermediate
**Time:** 15 minutes

## Overview

This example demonstrates FXD's CSS-like selector engine. Just like CSS lets you query DOM elements, FXD lets you query nodes in the graph using familiar syntax. This is incredibly powerful for:
- Finding nodes by type or metadata
- Creating filtered collections
- Building reactive queries
- Aggregating data

## What You'll Learn

1. **Type Selectors**: Using `.class` to match node types
2. **Attribute Selectors**: Using `[key=value]` to query metadata
3. **Attribute Operators**: `=`, `^=`, `$=`, `*=` for flexible matching
4. **Combining Selectors**: Building complex queries
5. **Not Selector**: Using `:not()` to exclude matches
6. **Group Operations**: Aggregating results (sum, count, etc.)

## Running the Example

```bash
deno run -A examples/selector-demo/demo.ts
```

## Expected Output

You'll see:
- Type-based selections (.user, .product)
- Attribute-based filtering ([active=true])
- Category queries ([category=electronics])
- Combined selectors (.user[role=admin])
- Attribute operator demonstrations (^=, $=, *=)
- Not selector usage (:not([role=admin]))
- Group calculations and aggregations

## Key Concepts

### Class Selectors (Type Matching)

```typescript
// Select all nodes with __type = "user"
const users = $$("app").select(".user");
```

The `.class` selector matches:
- The node's `__type` property
- Any entries in the node's `__proto` array

### Attribute Selectors

```typescript
// Exact match
const active = $$("app").select('[active=true]');

// Starts with
const prefixed = $$("app").select('[tag^=prefix]');

// Ends with
const suffixed = $$("app").select('[tag$=suffix]');

// Contains
const contains = $$("app").select('[tag*=keyword]');
```

Attributes are resolved in this order:
1. `__meta` object (custom metadata)
2. Type surface (e.g., `user` object properties)
3. Raw value bag properties
4. Child nodes

### Combining Selectors

```typescript
// Type AND attribute
const adminUsers = $$("app").select('.user[role=admin]');

// Multiple attributes
const activeAdmins = $$("app").select('.user[role=admin][active=true]');
```

### Not Selector

```typescript
// Exclude matches
const nonAdmins = $$("app").select('.user:not([role=admin])');
```

### Group Operations

Once you have a selection, you can perform operations:

```typescript
const products = $$("products").select(".product");

// Get all nodes as proxies
const list = products.list();

// Aggregate values
const total = products.sum();
const count = list.length;
const avg = products.average();
const max = products.max();
const min = products.min();
```

## Setting Up Metadata

To make nodes queryable, set their `__type` and `__meta`:

```typescript
// Create a node
$$("users.alice").val({ name: "Alice", age: 30 });

// Set type (makes it matchable with .user)
$$("users.alice").node().__type = "user";

// Set metadata (makes it queryable with [key=value])
($$("users.alice").node() as any).__meta = {
    role: "admin",
    active: "true",
    department: "engineering"
};
```

## Selector Syntax Reference

| Selector | Matches | Example |
|----------|---------|---------|
| `.type` | Nodes with `__type` or `__proto` | `.user` |
| `[key=value]` | Exact attribute match | `[role=admin]` |
| `[key^=value]` | Attribute starts with | `[tag^=prefix]` |
| `[key$=value]` | Attribute ends with | `[tag$=suffix]` |
| `[key*=value]` | Attribute contains | `[tag*=keyword]` |
| `:not(selector)` | Excludes matching nodes | `:not([role=admin])` |
| `.type[key=val]` | Combined selectors | `.user[active=true]` |

## Use Cases

### User Management
```typescript
// Find all active admin users
const activeAdmins = $$("app")
    .select('.user[role=admin][active=true]');
```

### Inventory Queries
```typescript
// Find low-stock electronics
const lowStock = $$("products")
    .select('.product[category=electronics][stock^=1]'); // stock starts with "1" (10-19)
```

### Tag-Based Filtering
```typescript
// Find all beta features
const betaFeatures = $$("features")
    .select('[tag*=beta]');
```

### Excluding Items
```typescript
// All users except admins
const regularUsers = $$("users")
    .select('.user:not([role=admin])');
```

## Next Steps

After mastering selector-demo, try:
- **reactive-groups**: Make selections reactive to changes
- **import-export-workflow**: Query and export filtered subsets
- Combine with snippet-management to query code snippets

## Files

- `demo.ts` - The runnable example
- `README.md` - This documentation

## Related Modules

- `fxn.ts` - Core selector engine (parseSelector, matchCompound)
- `modules/fx-group-extras.ts` - Additional group operations
