# Working with Snippets

## Overview

Snippets are the fundamental building blocks of FXD. This guide covers best practices for designing, organizing, and managing snippets effectively.

## Snippet Design Principles

### 1. Single Responsibility

Each snippet should have one clear purpose:

```typescript
// GOOD: Focused snippet
createSnippet("auth.validateEmail", `
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
`, { id: "auth-validate-email" });

// BAD: Multiple responsibilities
createSnippet("auth.utils", `
function validateEmail(email) { /* ... */ }
function hashPassword(password) { /* ... */ }
function generateToken() { /* ... */ }
`, { id: "auth-utils-all" });
```

### 2. Self-Contained

Snippets should be as independent as possible:

```typescript
// GOOD: Self-contained with clear dependencies
createSnippet("components.Button", `
// Dependencies declared at top
import React from 'react';
import styles from './Button.module.css';

export function Button({ label, onClick }) {
  return (
    <button className={styles.button} onClick={onClick}>
      {label}
    </button>
  );
}
`, { 
  id: "component-button",
  requires: ["import-react", "styles-button"] 
});
```

### 3. Reusable

Design snippets for maximum reusability:

```typescript
// GOOD: Configurable and reusable
createSnippet("templates.apiEndpoint", `
router.{{method}}('{{route}}', {{middleware}}, async (req, res) => {
  try {
    const result = await {{handler}}(req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
`, { 
  id: "template-api-endpoint",
  template: true,
  variables: ["method", "route", "middleware", "handler"]
});
```

## Snippet Organization

### Hierarchical Structure

Organize snippets in a logical hierarchy:

```
snippets/
├── auth/
│   ├── login         # Login functionality
│   ├── register      # Registration
│   └── validation    # Auth validation
├── components/
│   ├── ui/          # UI components
│   ├── forms/       # Form components
│   └── layouts/     # Layout components
└── utils/
    ├── formatting    # Formatters
    ├── validation    # Validators
    └── helpers       # General helpers
```

### Naming Conventions

Use consistent, descriptive names:

```typescript
// Domain-based naming
createSnippet("auth.login.validation", code, {
  id: "auth-login-validation-001"
});

// Feature-based naming
createSnippet("feature.userProfile.display", code, {
  id: "feature-user-profile-display-001"
});

// Layer-based naming
createSnippet("controller.users.create", code, {
  id: "controller-users-create-001"
});
```

### Categorization with Metadata

Use metadata for rich categorization:

```typescript
createSnippet("api.users.get", code, {
  id: "api-users-get-001",
  
  // Standard metadata
  file: "api/users.js",
  lang: "js",
  order: 10,
  
  // Category metadata
  domain: "users",
  layer: "api",
  feature: "user-management",
  
  // Technical metadata
  method: "GET",
  route: "/api/users",
  auth: true,
  roles: ["admin", "user"],
  
  // Lifecycle metadata
  status: "stable",      // draft, stable, deprecated
  version: 1,
  created: "2024-01-01",
  author: "team",
  
  // Relationships
  requires: ["db-connection", "auth-middleware"],
  requiredBy: ["user-dashboard"],
  related: ["api-users-post", "api-users-put"]
});
```

## Snippet Lifecycle Management

### Creation Phase

```typescript
function createManagedSnippet(
  path: string,
  body: string,
  metadata: SnippetMetadata
): ManagedSnippet {
  // Validate before creation
  validateSnippetBody(body);
  validateMetadata(metadata);
  
  // Add lifecycle metadata
  const enrichedMetadata = {
    ...metadata,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    version: 1,
    status: 'draft'
  };
  
  // Create snippet
  const snippet = createSnippet(path, body, enrichedMetadata);
  
  // Index for search
  indexSnippet(path, enrichedMetadata.id);
  
  // Track in registry
  registerSnippet(enrichedMetadata.id, path);
  
  return snippet;
}
```

### Update Phase

```typescript
function updateSnippet(
  id: string,
  newBody?: string,
  metadataUpdates?: Partial<SnippetMetadata>
): void {
  const location = findBySnippetId(id);
  if (!location) throw new Error(`Snippet ${id} not found`);
  
  const node = $$(location.path).node();
  const oldMeta = node.__meta;
  
  // Create backup
  backupSnippet(id, $$(location.path).val(), oldMeta);
  
  // Update content if provided
  if (newBody !== undefined) {
    $$(location.path).val(newBody);
  }
  
  // Update metadata
  node.__meta = {
    ...oldMeta,
    ...metadataUpdates,
    modified: new Date().toISOString(),
    version: (oldMeta.version || 1) + 1,
    previousVersion: oldMeta.version
  };
  
  // Recalculate checksum
  node.__meta.checksum = calculateChecksum(
    newBody ?? $$(location.path).val()
  );
  
  // Emit update event
  emitSnippetUpdate(id, oldMeta, node.__meta);
}
```

### Deprecation Phase

```typescript
function deprecateSnippet(
  id: string,
  reason: string,
  replacement?: string
): void {
  updateSnippet(id, undefined, {
    status: 'deprecated',
    deprecatedAt: new Date().toISOString(),
    deprecationReason: reason,
    replacementId: replacement,
    
    // Add warning comment to body
    body: `
// DEPRECATED: ${reason}
// Use ${replacement || 'alternative solution'} instead
${getCurrentBody(id)}
    `.trim()
  });
  
  // Notify dependent snippets
  notifyDependents(id, 'deprecation', { reason, replacement });
}
```

## Snippet Relationships

### Dependencies

Track and manage snippet dependencies:

```typescript
interface SnippetDependencies {
  requires: string[];     // This snippet needs these
  requiredBy: string[];   // These need this snippet
  related: string[];      // Related but not dependent
}

function analyzeDependencies(id: string): DependencyGraph {
  const snippet = getSnippet(id);
  const body = snippet.val();
  
  // Analyze imports
  const imports = extractImports(body);
  
  // Analyze function calls
  const calls = extractFunctionCalls(body);
  
  // Build dependency graph
  return {
    direct: imports.concat(calls),
    transitive: getTransitiveDependencies(imports.concat(calls)),
    circular: detectCircularDependencies(id)
  };
}
```

### Snippet Families

Group related snippets:

```typescript
class SnippetFamily {
  constructor(
    public name: string,
    public baseId: string
  ) {}
  
  // Create variant
  createVariant(
    variantName: string,
    modifications: (base: string) => string
  ): void {
    const base = getSnippet(this.baseId).val();
    const variant = modifications(base);
    
    createSnippet(`${this.name}.${variantName}`, variant, {
      id: `${this.baseId}-${variantName}`,
      family: this.name,
      baseId: this.baseId,
      variant: variantName
    });
  }
  
  // Get all variants
  getVariants(): Snippet[] {
    return $$("snippets")
      .select(`.snippet[family="${this.name}"]`)
      .list();
  }
}

// Usage
const buttonFamily = new SnippetFamily("buttons", "component-button-base");
buttonFamily.createVariant("primary", base => 
  base.replace("styles.button", "styles.buttonPrimary")
);
buttonFamily.createVariant("secondary", base =>
  base.replace("styles.button", "styles.buttonSecondary")
);
```

## Snippet Validation

### Content Validation

```typescript
interface ValidationRule {
  name: string;
  test: (content: string) => boolean;
  message: string;
}

const VALIDATION_RULES: Record<string, ValidationRule[]> = {
  js: [
    {
      name: 'no-console',
      test: (content) => !content.includes('console.log'),
      message: 'Remove console.log statements'
    },
    {
      name: 'has-exports',
      test: (content) => /export\s+(default\s+)?/.test(content),
      message: 'Snippet should export something'
    }
  ],
  sql: [
    {
      name: 'no-select-star',
      test: (content) => !/SELECT\s+\*/.test(content),
      message: 'Avoid SELECT *'
    }
  ]
};

function validateSnippet(
  content: string,
  lang: string
): ValidationResult {
  const rules = VALIDATION_RULES[lang] || [];
  const failures = [];
  
  for (const rule of rules) {
    if (!rule.test(content)) {
      failures.push({
        rule: rule.name,
        message: rule.message
      });
    }
  }
  
  return {
    valid: failures.length === 0,
    failures
  };
}
```

### Metadata Validation

```typescript
function validateMetadata(meta: SnippetMetadata): void {
  // Required fields
  if (!meta.id) throw new Error('Snippet ID is required');
  if (!meta.lang) throw new Error('Language is required');
  
  // ID format
  if (!/^[a-z0-9-]+$/.test(meta.id)) {
    throw new Error('ID must be lowercase alphanumeric with dashes');
  }
  
  // Language validity
  const validLangs = ['js', 'ts', 'py', 'java', 'go', 'rust'];
  if (!validLangs.includes(meta.lang)) {
    throw new Error(`Invalid language: ${meta.lang}`);
  }
  
  // Order range
  if (meta.order !== undefined && (meta.order < 0 || meta.order > 1000)) {
    throw new Error('Order must be between 0 and 1000');
  }
}
```

## Snippet Search and Discovery

### Search Implementation

```typescript
class SnippetSearch {
  search(query: string, options?: SearchOptions): Snippet[] {
    const results = [];
    
    // Search by ID
    if (options?.searchId) {
      results.push(...this.searchById(query));
    }
    
    // Search by content
    if (options?.searchContent) {
      results.push(...this.searchByContent(query));
    }
    
    // Search by metadata
    if (options?.searchMetadata) {
      results.push(...this.searchByMetadata(query));
    }
    
    // Rank results
    return this.rankResults(results, query);
  }
  
  private searchByContent(query: string): Snippet[] {
    return $$("snippets")
      .select(".snippet")
      .list()
      .filter(snippet => {
        const content = snippet.val();
        return content.toLowerCase().includes(query.toLowerCase());
      });
  }
  
  private searchByMetadata(query: string): Snippet[] {
    return $$("snippets")
      .select(".snippet")
      .list()
      .filter(snippet => {
        const meta = snippet.node().__meta;
        const metaString = JSON.stringify(meta).toLowerCase();
        return metaString.includes(query.toLowerCase());
      });
  }
}
```

### Discovery Tools

```typescript
// Find similar snippets
function findSimilar(id: string): Snippet[] {
  const source = getSnippet(id);
  const sourceMeta = source.node().__meta;
  
  return $$("snippets")
    .select(".snippet")
    .list()
    .filter(snippet => {
      const meta = snippet.node().__meta;
      return (
        meta.id !== id &&
        (meta.family === sourceMeta.family ||
         meta.domain === sourceMeta.domain ||
         meta.feature === sourceMeta.feature)
      );
    })
    .sort((a, b) => {
      // Sort by similarity score
      return similarityScore(b, source) - similarityScore(a, source);
    });
}

// Discover unused snippets
function findUnused(): Snippet[] {
  const allSnippets = $$("snippets").select(".snippet").list();
  const usedIds = new Set();
  
  // Check all views
  $$("views").select(".group").list().forEach(view => {
    view.list().forEach(snippet => {
      usedIds.add(snippet.node().__meta?.id);
    });
  });
  
  return allSnippets.filter(snippet => 
    !usedIds.has(snippet.node().__meta?.id)
  );
}
```

## Best Practices

### 1. Version Everything

```typescript
// Always track versions
createSnippet(path, body, {
  version: 1,
  previousVersions: [],
  versionHistory: [{
    version: 1,
    date: new Date(),
    author: "system",
    changes: "Initial version"
  }]
});
```

### 2. Document Snippets

```typescript
// Add documentation
createSnippet("utils.formatDate", `
/**
 * Formats a date to ISO string
 * @param {Date} date - The date to format
 * @returns {string} ISO formatted date
 * @example formatDate(new Date()) // "2024-01-01T00:00:00.000Z"
 */
function formatDate(date) {
  return date.toISOString();
}
`, {
  id: "util-format-date",
  description: "Date formatting utility",
  examples: ["formatDate(new Date())"]
});
```

### 3. Test Snippets

```typescript
// Associate tests
createSnippet("function.calculate", functionCode, {
  id: "function-calculate",
  testSnippetId: "test-function-calculate"
});

createSnippet("test.function.calculate", `
describe('calculate', () => {
  it('should calculate correctly', () => {
    expect(calculate(2, 3)).toBe(5);
  });
});
`, {
  id: "test-function-calculate",
  type: "test",
  testsSnippetId: "function-calculate"
});
```

## See Also

- [Snippets API](api-snippets.md) - Complete API reference
- [CSS Selectors Guide](guide-selectors.md) - Selecting snippets
- [Views Guide](api-views.md) - Composing snippets
- [Examples](examples-basic.md) - Practical examples