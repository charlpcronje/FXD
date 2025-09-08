# Round-Trip Editing Guide

## Overview

Round-trip editing is FXD's killer feature - the ability to edit rendered files with markers and have changes automatically flow back to source snippets. This guide covers the complete round-trip workflow.

## The Round-Trip Cycle

```
     Create Snippets
           ↓
      Compose View
           ↓
    Render with Markers
           ↓
       Edit File
           ↓
     Parse Changes
           ↓
    Generate Patches
           ↓
    Apply to Snippets
           ↓
    (Cycle Repeats)
```

## Step-by-Step Workflow

### Step 1: Create Source Snippets

```typescript
// Create original snippets
createSnippet(
  "snippets.user.model",
  `export class User {
  constructor(public name: string) {
    this.id = Date.now();
  }
}`,
  {
    id: "user-model-001",
    lang: "ts",
    file: "models/User.ts",
    version: 1
  }
);

createSnippet(
  "snippets.user.interface",
  `export interface IUser {
  id: number;
  name: string;
}`,
  {
    id: "user-interface-001",
    lang: "ts",
    file: "models/User.ts",
    version: 1
  }
);
```

### Step 2: Create View

```typescript
// Compose snippets into view
$$("views.UserModel")
  .group([])
  .include('.snippet[file="models/User.ts"]')
  .reactive(true);
```

### Step 3: Render with Markers

```typescript
// Render to file with markers
const content = renderView("views.UserModel", {
  lang: "ts",
  hoistImports: true
});

console.log(content);
// Output:
// /* FX:BEGIN id=user-interface-001 lang=ts file=models/User.ts checksum=abc123 version=1 */
// export interface IUser {
//   id: number;
//   name: string;
// }
// /* FX:END id=user-interface-001 */
//
// /* FX:BEGIN id=user-model-001 lang=ts file=models/User.ts checksum=def456 version=1 */
// export class User {
//   constructor(public name: string) {
//     this.id = Date.now();
//   }
// }
// /* FX:END id=user-model-001 */
```

### Step 4: User Edits File

User modifies the file, preserving markers:

```typescript
const editedContent = `
/* FX:BEGIN id=user-interface-001 lang=ts file=models/User.ts checksum=abc123 version=1 */
export interface IUser {
  id: number;
  name: string;
  email: string;  // ADDED
}
/* FX:END id=user-interface-001 */

/* FX:BEGIN id=user-model-001 lang=ts file=models/User.ts checksum=def456 version=1 */
export class User {
  constructor(
    public name: string,
    public email: string  // ADDED
  ) {
    this.id = Date.now();
    this.createdAt = new Date();  // ADDED
  }
}
/* FX:END id=user-model-001 */
`;
```

### Step 5: Parse and Apply Changes

```typescript
// Parse changes
const patches = toPatches(editedContent, content);

// Apply to snippets
applyPatches(patches);

// Verify changes applied
const updatedModel = $$("snippets.user.model").val();
console.log(updatedModel.includes("email")); // true
console.log(updatedModel.includes("createdAt")); // true
```

## Handling Different Edit Types

### Adding Content

```typescript
// Original
/* FX:BEGIN id=func-001 */
function calculate(a, b) {
  return a + b;
}
/* FX:END id=func-001 */

// Edited (added parameter and logic)
/* FX:BEGIN id=func-001 */
function calculate(a, b, operation = 'add') {
  switch(operation) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide': return a / b;
    default: return a + b;
  }
}
/* FX:END id=func-001 */
```

### Removing Content

```typescript
// Original
/* FX:BEGIN id=class-001 */
class Example {
  constructor() {
    this.debug = true;
    this.verbose = true;
    this.logLevel = 'debug';
  }
}
/* FX:END id=class-001 */

// Edited (removed debug properties)
/* FX:BEGIN id=class-001 */
class Example {
  constructor() {
    this.logLevel = 'info';
  }
}
/* FX:END id=class-001 */
```

### Reordering Content

```typescript
// Original
/* FX:BEGIN id=methods-001 */
class Service {
  delete() { /* ... */ }
  create() { /* ... */ }
  update() { /* ... */ }
  read() { /* ... */ }
}
/* FX:END id=methods-001 */

// Edited (reordered to CRUD)
/* FX:BEGIN id=methods-001 */
class Service {
  create() { /* ... */ }
  read() { /* ... */ }
  update() { /* ... */ }
  delete() { /* ... */ }
}
/* FX:END id=methods-001 */
```

## Preserving Marker Integrity

### Do's and Don'ts

```typescript
// DO: Edit content between markers
/* FX:BEGIN id=snippet-001 */
// Safe to edit this content
const value = 42;  // Can change to any value
/* FX:END id=snippet-001 */

// DON'T: Modify marker lines
/* FX:BEGIN id=snippet-001 checksum=abc123 */  // Don't change this line
const value = 42;
/* FX:END id=snippet-001 */  // Don't change this line

// DON'T: Break marker pairing
/* FX:BEGIN id=snippet-001 */
const value = 42;
// Missing FX:END - will break parsing!

// DON'T: Nest markers incorrectly
/* FX:BEGIN id=outer-001 */
/* FX:BEGIN id=inner-001 */  // OK
/* FX:END id=outer-001 */    // Wrong! Should end inner first
/* FX:END id=inner-001 */
```

### Marker Protection

```typescript
// Protect markers in editor
function setupMarkerProtection(editor: Editor) {
  // Highlight markers
  editor.addMarkerDecoration({
    regex: /.*FX:(BEGIN|END).*/g,
    className: 'fxd-marker',
    readOnly: true
  });
  
  // Prevent marker editing
  editor.onBeforeChange((change) => {
    const line = editor.getLine(change.line);
    if (line.includes('FX:BEGIN') || line.includes('FX:END')) {
      change.cancel();
      editor.showMessage('Cannot edit marker lines');
    }
  });
  
  // Auto-complete markers
  editor.onKeyPress('/', () => {
    const line = editor.getCurrentLine();
    if (line.trim() === '/*') {
      editor.showCompletions([
        'FX:BEGIN id=',
        'FX:END id='
      ]);
    }
  });
}
```

## Conflict Resolution

### Detecting Conflicts

```typescript
function detectConflicts(
  localChanges: Patch[],
  remoteChanges: Patch[]
): Conflict[] {
  const conflicts = [];
  
  for (const local of localChanges) {
    const remote = remoteChanges.find(r => r.id === local.id);
    
    if (remote && local.newContent !== remote.newContent) {
      conflicts.push({
        snippetId: local.id,
        localContent: local.newContent,
        remoteContent: remote.newContent,
        baseContent: getOriginalContent(local.id)
      });
    }
  }
  
  return conflicts;
}
```

### Resolving Conflicts

```typescript
// Three-way merge
function resolveConflict(conflict: Conflict): string {
  // Try automatic merge
  const merged = threeWayMerge(
    conflict.baseContent,
    conflict.localContent,
    conflict.remoteContent
  );
  
  if (merged.success) {
    return merged.content;
  }
  
  // Manual resolution required
  return `
<<<<<<< LOCAL
${conflict.localContent}
=======
${conflict.remoteContent}
>>>>>>> REMOTE
  `.trim();
}

// Interactive resolution
async function interactiveResolve(conflict: Conflict): Promise<string> {
  const choice = await prompt({
    type: 'select',
    message: `Conflict in ${conflict.snippetId}`,
    choices: [
      { title: 'Keep local', value: 'local' },
      { title: 'Keep remote', value: 'remote' },
      { title: 'Keep both', value: 'both' },
      { title: 'Manual merge', value: 'manual' }
    ]
  });
  
  switch (choice) {
    case 'local':
      return conflict.localContent;
    case 'remote':
      return conflict.remoteContent;
    case 'both':
      return `${conflict.localContent}\n\n${conflict.remoteContent}`;
    case 'manual':
      return await editInEditor(conflict);
  }
}
```

## Validation and Recovery

### Pre-flight Validation

```typescript
function validateBeforeRoundTrip(content: string): ValidationResult {
  const errors = [];
  const warnings = [];
  
  // Check marker pairing
  const begins = (content.match(/FX:BEGIN/g) || []).length;
  const ends = (content.match(/FX:END/g) || []).length;
  
  if (begins !== ends) {
    errors.push(`Mismatched markers: ${begins} BEGIN, ${ends} END`);
  }
  
  // Check marker structure
  const markers = parseMarkers(content);
  for (const marker of markers) {
    if (!marker.id) {
      errors.push('Marker missing ID');
    }
    
    if (!marker.checksum) {
      warnings.push(`Marker ${marker.id} missing checksum`);
    }
  }
  
  // Check for orphaned content
  const orphaned = findOrphanedContent(content);
  if (orphaned.length > 0) {
    warnings.push(`Found ${orphaned.length} lines outside markers`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

### Error Recovery

```typescript
function recoverFromErrors(
  content: string,
  errors: ParseError[]
): RecoveryResult {
  let recovered = content;
  const fixes = [];
  
  for (const error of errors) {
    switch (error.type) {
      case 'missing-end':
        // Add missing END marker
        recovered = addMissingEnd(recovered, error.id);
        fixes.push(`Added missing END for ${error.id}`);
        break;
        
      case 'missing-begin':
        // Remove orphaned END
        recovered = removeOrphanedEnd(recovered, error.id);
        fixes.push(`Removed orphaned END for ${error.id}`);
        break;
        
      case 'corrupted-marker':
        // Try to repair marker
        recovered = repairMarker(recovered, error.line);
        fixes.push(`Repaired marker at line ${error.line}`);
        break;
        
      case 'checksum-mismatch':
        // Update checksum
        recovered = updateChecksum(recovered, error.id);
        fixes.push(`Updated checksum for ${error.id}`);
        break;
    }
  }
  
  return {
    success: fixes.length > 0,
    content: recovered,
    fixes,
    remainingErrors: errors.length - fixes.length
  };
}
```

## Advanced Round-Trip Features

### Incremental Updates

```typescript
// Only process changed sections
function incrementalRoundTrip(
  oldContent: string,
  newContent: string
): IncrementalResult {
  const diff = computeDiff(oldContent, newContent);
  const affectedMarkers = new Set<string>();
  
  // Find markers in changed regions
  for (const change of diff.changes) {
    const markers = findMarkersInRange(
      newContent,
      change.start,
      change.end
    );
    markers.forEach(m => affectedMarkers.add(m.id));
  }
  
  // Only process affected snippets
  const patches = [];
  for (const id of affectedMarkers) {
    const oldSection = extractSection(oldContent, id);
    const newSection = extractSection(newContent, id);
    
    if (oldSection !== newSection) {
      patches.push({
        id,
        oldContent: oldSection,
        newContent: newSection
      });
    }
  }
  
  return {
    patches,
    affectedCount: affectedMarkers.size,
    totalCount: countMarkers(newContent)
  };
}
```

### Batch Round-Trip

```typescript
// Process multiple files
async function batchRoundTrip(
  files: Map<string, string>
): Promise<BatchResult> {
  const results = new Map();
  const errors = [];
  
  for (const [path, content] of files) {
    try {
      // Get original
      const original = bridge.readFile(path);
      
      // Generate patches
      const patches = toPatches(content, original);
      
      // Validate patches
      const validation = validatePatches(patches);
      if (!validation.valid) {
        errors.push({ path, errors: validation.errors });
        continue;
      }
      
      // Apply patches
      applyPatches(patches);
      
      results.set(path, {
        success: true,
        patchCount: patches.length
      });
    } catch (error) {
      errors.push({ path, error: error.message });
    }
  }
  
  return {
    processed: results.size,
    succeeded: results.size,
    failed: errors.length,
    results,
    errors
  };
}
```

### Round-Trip with Transforms

```typescript
// Apply transforms during round-trip
function transformRoundTrip(
  content: string,
  transforms: Transform[]
): string {
  let processed = content;
  
  // Pre-parse transforms
  for (const transform of transforms.filter(t => t.phase === 'pre-parse')) {
    processed = transform.apply(processed);
  }
  
  // Parse
  const patches = toPatches(processed, getOriginal());
  
  // Transform patches
  const transformedPatches = patches.map(patch => {
    let content = patch.newContent;
    
    for (const transform of transforms.filter(t => t.phase === 'patch')) {
      content = transform.apply(content, patch);
    }
    
    return { ...patch, newContent: content };
  });
  
  // Apply
  applyPatches(transformedPatches);
  
  // Post-apply transforms
  let result = renderView();
  for (const transform of transforms.filter(t => t.phase === 'post-apply')) {
    result = transform.apply(result);
  }
  
  return result;
}
```

## Best Practices

### 1. Always Validate

```typescript
// Validate before applying
const validation = validateBeforeRoundTrip(content);
if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  return;
}
```

### 2. Preserve Checksums

```typescript
// Update checksums after edits
function updateChecksums(content: string): string {
  const sections = parseMarkers(content);
  
  return sections.map(section => {
    const newChecksum = calculateChecksum(section.content);
    return updateMarkerChecksum(section, newChecksum);
  }).join('\n');
}
```

### 3. Track Versions

```typescript
// Increment version on edit
function incrementVersion(patch: Patch): void {
  const location = findBySnippetId(patch.id);
  const node = $$(location.path).node();
  
  node.__meta.version = (node.__meta.version || 1) + 1;
  node.__meta.previousVersion = node.__meta.version - 1;
  node.__meta.modifiedAt = new Date();
}
```

### 4. Test Round-Trips

```typescript
// Test round-trip integrity
function testRoundTrip(snippetId: string): boolean {
  // Original
  const original = getSnippet(snippetId).val();
  
  // Render
  const rendered = wrapSnippet(snippetId, original);
  
  // Simulate edit
  const edited = rendered.replace('old', 'new');
  
  // Round-trip
  const patches = toPatches(edited, rendered);
  applyPatches(patches);
  
  // Verify
  const final = getSnippet(snippetId).val();
  return final.includes('new') && !final.includes('old');
}
```

## See Also

- [Markers System](markers.md) - Detailed marker documentation
- [Parsing API](api-parsing.md) - Parsing functions
- [Filesystem Bridge](api-bridge.md) - File operations
- [Examples](examples-basic.md) - Round-trip examples