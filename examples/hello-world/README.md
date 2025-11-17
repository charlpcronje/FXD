# Hello World Example

**Location:** `examples/hello-world/`
**Difficulty:** Beginner
**Time:** 5 minutes

## Overview

This is the simplest introduction to FXD. It demonstrates the core concepts:
- Creating and accessing nodes
- Setting and getting values
- Basic proxy navigation
- Type conversions
- Watching for changes

## What You'll Learn

1. **Node Creation**: How to create nodes using the `$$()` function
2. **Value Operations**: Setting and getting values with `.val()`
3. **Type Conversions**: Using `.str()`, `.num()`, `.bool()` for type safety
4. **Reactive Watching**: Observing value changes with `.watch()`
5. **Safe Access**: Using `.get()` with default values

## Running the Example

```bash
deno run -A examples/hello-world/demo.ts
```

## Expected Output

You'll see:
- Simple value assignments and retrievals
- Nested node creation
- Object decomposition into child nodes
- Type conversion demonstrations
- Live change notifications from watchers

## Key Concepts

### The `$$` Function

`$$` is your primary interface to the FXD graph. It:
- Creates nodes if they don't exist
- Returns a proxy to navigate and manipulate nodes
- Supports dot-notation paths like `"user.profile.name"`

### Value Management

```typescript
// Set a value
$$("key").val("value");

// Get a value
const value = $$("key").val();

// Set nested values
$$("user.name").val("Alice");
```

### Type Conversions

FXD stores values intelligently and provides type-safe accessors:
- `.str()` - String representation
- `.num()` - Numeric value (parses strings)
- `.bool()` - Boolean coercion
- `.raw()` - Raw underlying value

### Reactive Watching

```typescript
const unwatch = $$("counter").watch((newVal, oldVal) => {
    console.log(`Changed: ${oldVal} → ${newVal}`);
});

// Don't forget to clean up!
unwatch();
```

## Next Steps

After mastering hello-world, try:
- **snippet-management**: Learn to work with code snippets
- **selector-demo**: Query nodes using CSS-like selectors
- **reactive-groups**: Create reactive collections of nodes

## Files

- `demo.ts` - The runnable example
- `README.md` - This documentation
