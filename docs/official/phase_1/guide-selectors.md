# CSS Selectors Guide

## Overview

FXD uses CSS-like selectors to dynamically select snippets for inclusion in views. This powerful system allows flexible, declarative snippet composition.

## Basic Selectors

### Type Selector (Class)

Select by node type using dot notation:

```typescript
// Select all snippets
.include(".snippet")

// Select specific types
.include(".component")
.include(".utility")
.include(".test")
```

The class selector matches against `node.__type`:

```typescript
// This snippet will match ".snippet"
node.__type = "snippet";
```

### Attribute Selectors

Select by metadata attributes using square brackets:

```typescript
// Exact match
.include('[file="src/User.js"]')

// Attribute exists
.include('[deprecated]')

// Operators
.include('[order>=10]')        // Greater than or equal
.include('[version!=1]')        // Not equal
.include('[id^="user-"]')       // Starts with
.include('[file$=".js"]')       // Ends with
.include('[path*="auth"]')      // Contains
```

### ID Selector

Select by node ID (internal, rarely used):

```typescript
// Select by internal node ID
.include('#abc123def456')
```

## Combination Selectors

### Multiple Criteria

Combine class and attributes:

```typescript
// Snippets for JavaScript files
.include('.snippet[lang="js"]')

// Deprecated TypeScript snippets
.include('.snippet[lang="ts"][deprecated=true]')

// Ordered snippets in specific file
.include('.snippet[file="app.js"][order>=0]')
```

### Multiple Selectors

Apply multiple selection rules:

```typescript
$$("view")
  .group([])
  .include('.snippet[file="User.js"]')     // Include User.js snippets
  .include('.snippet[file="Auth.js"]')     // AND Auth.js snippets
  .exclude('.snippet[deprecated=true]');   // BUT NOT deprecated ones
```

## Attribute Resolution

Attributes are resolved in this order:

1. **meta** - Check `node.__meta` object
2. **type** - Check type-specific surface
3. **raw** - Check raw value object
4. **child** - Check child nodes

```typescript
// Priority order for [file="app.js"]
1. node.__meta.file         // Checked first
2. node.__value[type].file  // If type surface exists
3. node.__value.file        // Raw value
4. node.__nodes.file        // Child node
```

## Advanced Selectors

### Pseudo-selectors

```typescript
// Has selector (if enabled)
.include(':has(.child)')       // Has child nodes

// Not selector
.include(':not([deprecated])')  // Not deprecated

// Can selector (capability-based)
.include(':can(render)')        // Can render
```

### Combinators

```typescript
// Descendant (space)
.include('.parent .child')      // Child anywhere under parent

// Child (>)
.include('.parent > .child')    // Direct child only

// Note: These require tree traversal
```

## Selector Patterns

### File-based Selection

```typescript
// All snippets for a file
$$("views.UserFile")
  .group([])
  .include('.snippet[file="models/User.js"]');

// Multiple files
$$("views.Models")
  .group([])
  .include('.snippet[file^="models/"]');  // All in models/
```

### Feature-based Selection

```typescript
// All authentication snippets
$$("views.AuthFeature")
  .group([])
  .include('.snippet[feature="authentication"]')
  .include('.snippet[domain="auth"]');
```

### Status-based Selection

```typescript
// Production-ready snippets
$$("views.Production")
  .group([])
  .include('.snippet[status="stable"]')
  .exclude('.snippet[experimental=true]')
  .exclude('.snippet[deprecated=true]');
```

### Version-based Selection

```typescript
// Latest versions only
$$("views.Latest")
  .group([])
  .include('.snippet')
  .where(snippet => {
    const meta = snippet.node().__meta;
    return !meta.previousVersion || 
           meta.version > meta.previousVersion;
  });
```

## Dynamic Selection

### Programmatic Filters

Use `where()` for complex logic:

```typescript
$$("views.Complex")
  .group([])
  .include('.snippet')
  .where(snippet => {
    const meta = snippet.node().__meta;
    const content = snippet.val();
    
    return (
      meta.author === "team" &&
      meta.reviewed === true &&
      content.length < 1000 &&
      !content.includes('TODO')
    );
  });
```

### Computed Selectors

Build selectors dynamically:

```typescript
function buildSelector(options: FilterOptions): string {
  const parts = ['.snippet'];
  
  if (options.file) {
    parts.push(`[file="${options.file}"]`);
  }
  
  if (options.minVersion) {
    parts.push(`[version>=${options.minVersion}]`);
  }
  
  if (options.tags) {
    options.tags.forEach(tag => {
      parts.push(`[tags*="${tag}"]`);
    });
  }
  
  return parts.join('');
}

// Usage
const selector = buildSelector({
  file: "app.js",
  minVersion: 2,
  tags: ["auth", "validated"]
});
// Result: '.snippet[file="app.js"][version>=2][tags*="auth"][tags*="validated"]'
```

## Selector Performance

### Optimization Tips

```typescript
// FAST: Type selector first
.include('.snippet[file="app.js"]')

// SLOW: Attribute only
.include('[file="app.js"]')  // Must check all nodes

// FAST: Specific path
$$("snippets.auth").select('.snippet')

// SLOW: Global search
$$("").select('.snippet[domain="auth"]')
```

### Caching Selectors

```typescript
class CachedSelector {
  private cache = new Map<string, FXNode[]>();
  
  select(selector: string): FXNode[] {
    if (this.cache.has(selector)) {
      return this.cache.get(selector)!;
    }
    
    const results = this.executeSelector(selector);
    this.cache.set(selector, results);
    
    // Clear cache on structure change
    fx.onStructure(() => this.cache.clear());
    
    return results;
  }
}
```

## Selector Validation

### Syntax Validation

```typescript
function validateSelector(selector: string): ValidationResult {
  try {
    // Check basic syntax
    if (!selector) {
      return { valid: false, error: 'Empty selector' };
    }
    
    // Check for valid characters
    if (!/^[.\[\]#:=!^$*\w\s"'-]+$/.test(selector)) {
      return { valid: false, error: 'Invalid characters' };
    }
    
    // Check bracket balance
    const openBrackets = (selector.match(/\[/g) || []).length;
    const closeBrackets = (selector.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return { valid: false, error: 'Unbalanced brackets' };
    }
    
    // Try to parse
    parseSelector(selector);
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

### Testing Selectors

```typescript
function testSelector(
  selector: string,
  expectedCount?: number
): TestResult {
  const group = $$("test.selector")
    .group([])
    .include(selector);
  
  const results = group.list();
  
  return {
    selector,
    matchCount: results.length,
    matches: results.map(r => r.node().__meta?.id),
    passed: expectedCount ? 
      results.length === expectedCount : true
  };
}
```

## Common Selector Patterns

### 1. Language-specific

```typescript
// JavaScript files
.include('.snippet[lang="js"]')

// TypeScript files
.include('.snippet[lang="ts"]')

// Python files
.include('.snippet[lang="py"]')
```

### 2. Order-based

```typescript
// Ordered snippets
.include('.snippet[order>=0]')

// Header snippets (low order)
.include('.snippet[order<10]')

// Footer snippets (high order)
.include('.snippet[order>90]')
```

### 3. Metadata Queries

```typescript
// By author
.include('.snippet[author="john"]')

// By date range
.where(s => {
  const created = new Date(s.node().__meta.created);
  return created >= startDate && created <= endDate;
})

// By tags
.include('.snippet[tags*="important"]')
```

### 4. Exclusion Patterns

```typescript
// Everything except tests
.include('.snippet')
.exclude('.snippet[type="test"]')

// Non-deprecated, non-experimental
.include('.snippet')
.exclude('.snippet[deprecated=true]')
.exclude('.snippet[experimental=true]')
```

## Debugging Selectors

### Trace Selection

```typescript
function traceSelection(selector: string): void {
  console.log(`Tracing selector: ${selector}`);
  
  const parsed = parseSelector(selector);
  console.log('Parsed:', JSON.stringify(parsed, null, 2));
  
  const group = $$("trace").group([]).include(selector);
  const matches = group.list();
  
  console.log(`Matched ${matches.length} nodes:`);
  matches.forEach((match, i) => {
    const meta = match.node().__meta;
    console.log(`  ${i + 1}. ${meta?.id || 'unknown'}`);
    console.log(`     Type: ${match.node().__type}`);
    console.log(`     Meta:`, meta);
  });
}
```

### Selector Playground

```typescript
class SelectorPlayground {
  test(selector: string): void {
    console.group(`Testing: ${selector}`);
    
    try {
      // Parse
      const parsed = parseSelector(selector);
      console.log('✓ Valid syntax');
      
      // Execute
      const start = performance.now();
      const group = $$("playground")
        .group([])
        .include(selector);
      const results = group.list();
      const time = performance.now() - start;
      
      console.log(`✓ Executed in ${time.toFixed(2)}ms`);
      console.log(`✓ Matched ${results.length} snippets`);
      
      // Sample results
      if (results.length > 0) {
        console.log('Sample matches:');
        results.slice(0, 3).forEach(r => {
          console.log(`  - ${r.node().__meta?.id}`);
        });
      }
    } catch (error) {
      console.error('✗ Error:', error.message);
    }
    
    console.groupEnd();
  }
}
```

## Best Practices

### 1. Be Specific

```typescript
// GOOD: Specific selector
.include('.snippet[file="models/User.js"][version=2]')

// BAD: Too broad
.include('.snippet')
```

### 2. Use Type First

```typescript
// GOOD: Type narrows search
.include('.snippet[author="john"]')

// BAD: Attribute only
.include('[author="john"]')
```

### 3. Avoid Complex Nesting

```typescript
// GOOD: Simple selectors
.include('.snippet[file="app.js"]')
.include('.snippet[file="lib.js"]')

// BAD: Complex nesting
.include('.parent > .child .snippet[type="function"]')
```

### 4. Document Selectors

```typescript
// Document what the selector does
$$("views.PublicAPI")
  .group([])
  // Include all public API endpoints
  .include('.snippet[visibility="public"][type="endpoint"]')
  // Exclude internal endpoints
  .exclude('.snippet[internal=true]')
  // Exclude deprecated endpoints
  .exclude('.snippet[deprecated=true]');
```

## See Also

- [Views API](api-views.md) - Using selectors in views
- [FX Integration](fx-integration.md) - How selectors work in FX
- [Examples](examples-basic.md) - Selector examples
- [Performance Guide](guide-performance.md) - Optimizing selectors