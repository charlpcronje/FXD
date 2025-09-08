# Parsing API

## Overview

The Parsing API enables round-trip editing by extracting changes from marked content and applying them back to source snippets.

## Core Functions

### `toPatches()`

Extracts patches from edited content with FX markers.

```typescript
function toPatches(
  editedContent: string,
  originalContent: string
): Patch[]

interface Patch {
  id: string;           // Snippet ID
  newContent: string;   // Updated content
  checksum?: string;    // Validation checksum
  marker?: Marker;      // Full marker metadata
}
```

#### Example
```typescript
import { toPatches } from "./modules/fx-parse.ts";

const original = `
/* FX:BEGIN id=user-001 checksum=abc123 */
class User {}
/* FX:END id=user-001 */
`;

const edited = `
/* FX:BEGIN id=user-001 checksum=abc123 */
class User {
  constructor() {} // Added
}
/* FX:END id=user-001 */
`;

const patches = toPatches(edited, original);
// [{ id: "user-001", newContent: "class User {\n  constructor() {}\n}" }]
```

### `applyPatches()`

Applies patches to update source snippets.

```typescript
function applyPatches(patches: Patch[]): void
```

#### Example
```typescript
import { applyPatches } from "./modules/fx-parse.ts";

const patches = [
  { id: "user-001", newContent: "class User { updated }" },
  { id: "auth-001", newContent: "function auth() { new }" }
];

applyPatches(patches);
// Snippets are updated in FX tree
```

## Marker System

### Marker Format

```javascript
/* FX:BEGIN id=snippet-001 lang=js file=app.js checksum=a1b2c3 order=0 version=1 */
// Content here
/* FX:END id=snippet-001 */
```

### Marker Components

```typescript
interface Marker {
  id: string;        // Unique snippet identifier
  lang?: string;     // Language for syntax
  file?: string;     // Associated file
  checksum?: string; // Content integrity check
  order?: number;    // Rendering order
  version?: number;  // Version tracking
}
```

### Marker Parsing

```typescript
function parseMarker(line: string): Marker | null {
  const match = line.match(/FX:BEGIN\s+(.+)/);
  if (!match) return null;
  
  const parts = match[1].split(/\s+/);
  const marker: Marker = { id: "" };
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    marker[key] = value;
  }
  
  return marker;
}
```

## Content Extraction

### Extract Between Markers

```typescript
function extractContent(text: string): Map<string, string> {
  const contents = new Map();
  const lines = text.split('\n');
  
  let currentId: string | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    if (line.includes('FX:BEGIN')) {
      const marker = parseMarker(line);
      currentId = marker?.id || null;
      currentContent = [];
    } else if (line.includes('FX:END')) {
      if (currentId) {
        contents.set(currentId, currentContent.join('\n'));
        currentId = null;
      }
    } else if (currentId) {
      currentContent.push(line);
    }
  }
  
  return contents;
}
```

### Validate Markers

```typescript
function validateMarkers(content: string): boolean {
  const beginCount = (content.match(/FX:BEGIN/g) || []).length;
  const endCount = (content.match(/FX:END/g) || []).length;
  
  if (beginCount !== endCount) {
    console.error("Mismatched markers");
    return false;
  }
  
  // Check for proper nesting
  const stack: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.includes('FX:BEGIN')) {
      const marker = parseMarker(line);
      if (marker?.id) stack.push(marker.id);
    } else if (line.includes('FX:END')) {
      const id = line.match(/id=(\S+)/)?.[1];
      if (stack[stack.length - 1] !== id) {
        console.error(`Mismatched END for ${id}`);
        return false;
      }
      stack.pop();
    }
  }
  
  return stack.length === 0;
}
```

## Checksum Validation

### Calculate Checksum

```typescript
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

function calculateChecksum(content: string): string {
  // Normalize line endings before hashing
  const normalized = content.replace(/\r\n/g, '\n');
  return simpleHash(normalized);
}
```

### Verify Checksum

```typescript
function verifyChecksum(
  content: string, 
  expectedChecksum: string
): boolean {
  const actual = calculateChecksum(content);
  return actual === expectedChecksum;
}
```

## Patch Generation

### Detect Changes

```typescript
function detectChanges(
  original: string,
  edited: string
): Change[] {
  const originalContent = extractContent(original);
  const editedContent = extractContent(edited);
  
  const changes: Change[] = [];
  
  for (const [id, newContent] of editedContent) {
    const oldContent = originalContent.get(id);
    
    if (oldContent !== newContent) {
      changes.push({
        id,
        oldContent,
        newContent,
        type: oldContent ? 'modified' : 'added'
      });
    }
  }
  
  // Check for deletions
  for (const [id, oldContent] of originalContent) {
    if (!editedContent.has(id)) {
      changes.push({
        id,
        oldContent,
        newContent: null,
        type: 'deleted'
      });
    }
  }
  
  return changes;
}
```

### Create Patches

```typescript
function createPatches(changes: Change[]): Patch[] {
  return changes.map(change => ({
    id: change.id,
    newContent: change.newContent || '',
    operation: change.type,
    checksum: calculateChecksum(change.newContent || '')
  }));
}
```

## Patch Application

### Apply Single Patch

```typescript
function applySinglePatch(patch: Patch): boolean {
  const location = findBySnippetId(patch.id);
  if (!location) {
    console.error(`Snippet ${patch.id} not found`);
    return false;
  }
  
  // Update snippet content
  $$(location.path).val(patch.newContent);
  
  // Update metadata
  const node = $$(location.path).node();
  if (node.__meta) {
    node.__meta.checksum = patch.checksum;
    node.__meta.version = (node.__meta.version || 1) + 1;
    node.__meta.updatedAt = new Date();
  }
  
  return true;
}
```

### Batch Application

```typescript
function applyBatchPatches(
  patches: Patch[],
  options?: {
    stopOnError?: boolean;
    validate?: boolean;
  }
): ApplyResult {
  const results: ApplyResult = {
    applied: [],
    failed: [],
    skipped: []
  };
  
  for (const patch of patches) {
    try {
      // Optional validation
      if (options?.validate) {
        const location = findBySnippetId(patch.id);
        if (location) {
          const current = $$(location.path).val();
          const currentChecksum = calculateChecksum(current);
          
          if (patch.oldChecksum && patch.oldChecksum !== currentChecksum) {
            results.skipped.push({
              patch,
              reason: 'Checksum mismatch'
            });
            continue;
          }
        }
      }
      
      if (applySinglePatch(patch)) {
        results.applied.push(patch);
      } else {
        results.failed.push(patch);
        if (options?.stopOnError) break;
      }
    } catch (error) {
      results.failed.push(patch);
      if (options?.stopOnError) break;
    }
  }
  
  return results;
}
```

## Conflict Resolution

### Detect Conflicts

```typescript
function detectConflicts(
  localPatches: Patch[],
  remotePatches: Patch[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  
  for (const local of localPatches) {
    const remote = remotePatches.find(p => p.id === local.id);
    
    if (remote && local.newContent !== remote.newContent) {
      conflicts.push({
        id: local.id,
        localContent: local.newContent,
        remoteContent: remote.newContent,
        baseContent: getBaseContent(local.id)
      });
    }
  }
  
  return conflicts;
}
```

### Merge Strategies

```typescript
enum MergeStrategy {
  LOCAL_WINS = 'local',
  REMOTE_WINS = 'remote',
  MANUAL = 'manual',
  AUTO_MERGE = 'auto'
}

function resolveConflict(
  conflict: Conflict,
  strategy: MergeStrategy
): string {
  switch (strategy) {
    case MergeStrategy.LOCAL_WINS:
      return conflict.localContent;
    
    case MergeStrategy.REMOTE_WINS:
      return conflict.remoteContent;
    
    case MergeStrategy.AUTO_MERGE:
      // Try three-way merge
      return threeWayMerge(
        conflict.baseContent,
        conflict.localContent,
        conflict.remoteContent
      );
    
    case MergeStrategy.MANUAL:
      // Return conflict markers
      return `
<<<<<<< LOCAL
${conflict.localContent}
=======
${conflict.remoteContent}
>>>>>>> REMOTE
      `.trim();
  }
}
```

## Advanced Parsing

### Custom Marker Formats

```typescript
// Support different comment styles
const MARKER_PATTERNS = {
  js: {
    begin: /\/\*\s*FX:BEGIN\s+(.+?)\s*\*\//,
    end: /\/\*\s*FX:END\s+(.+?)\s*\*\//
  },
  python: {
    begin: /#\s*FX:BEGIN\s+(.+)/,
    end: /#\s*FX:END\s+(.+)/
  },
  html: {
    begin: /<!--\s*FX:BEGIN\s+(.+?)\s*-->/,
    end: /<!--\s*FX:END\s+(.+?)\s*-->/
  }
};

function parseWithLanguage(
  content: string,
  lang: string
): Map<string, string> {
  const pattern = MARKER_PATTERNS[lang] || MARKER_PATTERNS.js;
  // Use language-specific patterns
}
```

### Incremental Parsing

```typescript
// Parse only changed sections
function incrementalParse(
  oldContent: string,
  newContent: string
): IncrementalPatch[] {
  const diff = calculateDiff(oldContent, newContent);
  const patches: IncrementalPatch[] = [];
  
  for (const change of diff.changes) {
    // Only parse affected markers
    const markers = findMarkersInRange(
      newContent,
      change.start,
      change.end
    );
    
    for (const marker of markers) {
      patches.push({
        id: marker.id,
        newContent: extractMarkerContent(newContent, marker),
        range: change
      });
    }
  }
  
  return patches;
}
```

## Error Recovery

### Malformed Markers

```typescript
function recoverFromMalformed(content: string): string {
  // Fix common issues
  let fixed = content;
  
  // Missing END markers
  fixed = fixed.replace(
    /\/\*\s*FX:BEGIN\s+id=(\S+).*?\*\/[\s\S]*?(?=\/\*\s*FX:BEGIN|$)/g,
    (match, id) => {
      if (!match.includes('FX:END')) {
        return match + `\n/* FX:END id=${id} */`;
      }
      return match;
    }
  );
  
  // Mismatched IDs
  const begins = [...fixed.matchAll(/FX:BEGIN\s+.*?id=(\S+)/g)];
  const ends = [...fixed.matchAll(/FX:END\s+.*?id=(\S+)/g)];
  
  // Attempt to fix mismatches
  // ...
  
  return fixed;
}
```

### Partial Parsing

```typescript
// Parse even with errors
function partialParse(
  content: string,
  options?: { strict?: boolean }
): ParseResult {
  const results: ParseResult = {
    patches: [],
    errors: [],
    warnings: []
  };
  
  try {
    // Try full parse
    const patches = toPatches(content, '');
    results.patches = patches;
  } catch (error) {
    if (options?.strict) throw error;
    
    // Fallback to partial parse
    const sections = content.split(/FX:BEGIN/);
    
    for (const section of sections) {
      try {
        // Parse individual sections
        const patch = parseSection(section);
        if (patch) results.patches.push(patch);
      } catch (sectionError) {
        results.errors.push(sectionError);
      }
    }
  }
  
  return results;
}
```

## See Also

- [Markers System](markers.md) - Detailed marker documentation
- [Round-Trip Guide](guide-roundtrip.md) - Complete editing workflow
- [Filesystem Bridge API](api-bridge.md) - File operations
- [Conflict Resolution](guide-conflicts.md) - Handling conflicts