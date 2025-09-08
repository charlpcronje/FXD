# Core Concepts

## Overview

FXD fundamentally reimagines how code is stored and organized. Instead of monolithic files, code exists as a graph of interconnected **snippets** that can be dynamically composed into **views** and rendered as traditional files.

## Key Concepts

### 1. Snippets

A **snippet** is the atomic unit of code in FXD - a reusable piece of content with a stable identity.

#### Anatomy of a Snippet
```typescript
{
  path: "snippets.user.validate",     // Location in FX tree
  body: "function validate() {...}",  // The actual code
  metadata: {
    id: "user-validate-001",         // Unique stable ID
    lang: "js",                      // Language for syntax
    file: "utils/validation.js",     // File association
    order: 2,                        // Sort order in file
    version: 1,                      // Version number
    checksum: "a1b2c3d4"            // Content integrity
  }
}
```

#### Key Properties
- **Stable Identity**: Each snippet has a unique ID that persists across edits
- **Reusable**: Same snippet can appear in multiple files/views
- **Versioned**: Track changes at the snippet level
- **Metadata-Rich**: Carry context about language, file, order, etc.

### 2. Views

A **view** is a dynamic collection of snippets that represents a file. Views use CSS-like selectors to gather snippets.

#### View Composition
```typescript
// A view is a group with selectors
$$("views.UserModel")
  .group([])
  .include('.snippet[file="User.js"]')  // All snippets for User.js
  .include('.snippet[id^="user-"]')     // OR snippets with user- prefix
  .exclude('.snippet[deprecated=true]'); // BUT NOT deprecated ones
```

#### View Properties
- **Dynamic**: Automatically update when snippets change
- **Composable**: Combine multiple selection criteria
- **Reactive**: Can trigger effects when contents change
- **Ordered**: Respects snippet order metadata

### 3. Markers

**Markers** are special comments that preserve snippet boundaries in rendered files, enabling round-trip editing.

#### Marker Format
```javascript
/* FX:BEGIN id=snippet-001 lang=js file=app.js checksum=abc123 order=0 version=1 */
// Your code here
/* FX:END id=snippet-001 */
```

#### Marker Components
- `FX:BEGIN/END`: Boundary markers
- `id`: Links back to source snippet
- `checksum`: Detects modifications
- `order`: Maintains sequence
- `version`: Tracks iterations

### 4. Round-Trip Editing

The ability to edit rendered files and have changes flow back to source snippets.

#### The Round-Trip Cycle
```
Snippets → View → Render → File
   ↑                         ↓
   └──── Parse ← Edit ←──────┘
```

1. **Render**: Snippets combined with markers
2. **Edit**: User modifies the file normally
3. **Parse**: Extract changes from markers
4. **Update**: Apply changes to snippets

### 5. Filesystem Bridge

The **bridge** maps virtual file paths to views, enabling transparent file operations.

#### Bridge Mapping
```typescript
bridge.register({
  filePath: "src/models/User.js",    // Virtual file path
  viewId: "views.UserModel",         // View to render
  lang: "js",                        // Language hint
  hoistImports: true                 // Processing options
});
```

## The FX Foundation

FXD is built on FX, a reactive node framework that provides:

### Reactive Nodes
```typescript
// Nodes form a tree with reactive values
$$("app.data.users").val([...]);
$$("app.ui.count").val($$("app.data.users").val().length);
```

### CSS-Like Selectors
```typescript
// Select nodes by type, attributes, or path
.select(".user")                    // By type
.select('[active=true]')            // By attribute
.select('.user[role="admin"]')      // Combined
```

### Reactive Groups
```typescript
// Groups automatically track changes
$$("active.users")
  .group([])
  .include('.user[active=true]')
  .reactive(true)
  .on('change', () => console.log('Active users changed'));
```

## Design Principles

### 1. Separation of Concerns
- **Storage**: Snippets stored individually
- **Composition**: Views define combinations
- **Presentation**: Rendering adds markers
- **Editing**: Parse preserves structure

### 2. Stable Identity
Every snippet has a permanent ID enabling:
- Tracking across renames
- Maintaining relationships
- Preserving history

### 3. Composability
- Snippets combine into views
- Views combine into files
- Files combine into projects

### 4. Transparency
The system works with standard text editors - no special tools required for editing.

### 5. Reactivity
Changes propagate automatically:
- Edit snippet → Views update
- Edit file → Snippets update
- Add snippet → Matching views include it

## Benefits

### For Developers
- **No Copy-Paste**: Reuse snippets across files
- **Granular Versioning**: Track what actually changed
- **Smart Refactoring**: Update once, propagate everywhere
- **Flexible Organization**: Same code, multiple views

### For Teams
- **Reduced Conflicts**: Merge at snippet level
- **Clear Attribution**: Track who wrote what snippet
- **Parallel Development**: Work on different snippets
- **Code Sharing**: Build snippet libraries

### For AI/Automation
- **Structured Code**: Clear boundaries and metadata
- **Semantic Understanding**: Rich snippet metadata
- **Safe Modifications**: Preserve structure automatically
- **Pattern Recognition**: Identify reusable snippets

## Example Workflow

```typescript
// 1. Create reusable authentication snippet
createSnippet("auth.login", loginCode, {
  id: "auth-login-001",
  file: "auth/login.js"
});

// 2. Create views for different contexts
$$("views.webAuth").group([]).include('.snippet[file*="auth/"]');
$$("views.mobileAuth").group([]).include('.snippet[mobile=true]');

// 3. Register files
bridge.register({ filePath: "web/auth.js", viewId: "views.webAuth" });
bridge.register({ filePath: "mobile/auth.js", viewId: "views.mobileAuth" });

// 4. Edit either file - changes flow back to shared snippet
edit("web/auth.js");  // Changes update auth.login snippet
// mobile/auth.js automatically gets the updates!
```

## Next Steps

- [Snippets API](api-snippets.md) - Create and manage snippets
- [Views API](api-views.md) - Compose dynamic collections  
- [Markers System](markers.md) - How round-trip works
- [CSS Selectors Guide](guide-selectors.md) - Advanced selection patterns