# Marker System

## Overview

The marker system is the cornerstone of FXD's round-trip editing capability. Markers are special comments that preserve snippet boundaries and metadata in rendered files, allowing changes to flow back to source snippets.

## Marker Format

### Basic Structure

```javascript
/* FX:BEGIN id=snippet-001 lang=js file=app.js checksum=a1b2c3 order=0 version=1 */
// Your code content here
/* FX:END id=snippet-001 */
```

### Components

- **FX:BEGIN** - Opening boundary marker
- **FX:END** - Closing boundary marker  
- **id** - Unique snippet identifier (required)
- **lang** - Language for syntax highlighting
- **file** - Associated file path
- **checksum** - Content integrity hash
- **order** - Rendering sequence
- **version** - Snippet version number

## Language-Specific Formats

Different languages use different comment styles:

### JavaScript/TypeScript
```javascript
/* FX:BEGIN id=func-001 */
function example() {}
/* FX:END id=func-001 */
```

### Python
```python
# FX:BEGIN id=func-001
def example():
    pass
# FX:END id=func-001
```

### HTML
```html
<!-- FX:BEGIN id=template-001 -->
<div>Content</div>
<!-- FX:END id=template-001 -->
```

### CSS
```css
/* FX:BEGIN id=style-001 */
.example { color: red; }
/* FX:END id=style-001 */
```

### Shell/Bash
```bash
# FX:BEGIN id=script-001
echo "Hello"
# FX:END id=script-001
```

## Marker Generation

### Creating Markers

```typescript
function makeBegin(marker: Marker): string {
  const parts = [`id=${marker.id}`];
  
  if (marker.lang) parts.push(`lang=${marker.lang}`);
  if (marker.file) parts.push(`file=${marker.file}`);
  if (marker.checksum) parts.push(`checksum=${marker.checksum}`);
  if (marker.order !== undefined) parts.push(`order=${marker.order}`);
  parts.push(`version=${marker.version ?? 1}`);
  
  return `FX:BEGIN ${parts.join(" ")}`;
}

function makeEnd(marker: Marker): string {
  return `FX:END id=${marker.id}`;
}
```

### Wrapping Content

```typescript
function wrapWithMarkers(
  id: string,
  content: string,
  lang: string = "js",
  metadata: Partial<Marker> = {}
): string {
  const comment = COMMENT[lang] ?? COMMENT.js;
  const checksum = calculateChecksum(content);
  
  const begin = makeBegin({
    id,
    lang,
    checksum,
    ...metadata,
    version: metadata.version ?? 1
  });
  
  const end = makeEnd({ id });
  
  if (comment.open && comment.close) {
    // Block comment style
    return `${comment.open} ${begin} ${comment.close}\n${content}\n${comment.open} ${end} ${comment.close}`;
  } else {
    // Line comment style
    const prefix = comment.line ?? "//";
    return `${prefix} ${begin}\n${content}\n${prefix} ${end}`;
  }
}
```

## Marker Parsing

### Extracting Markers

```typescript
function parseMarkers(content: string): MarkerSection[] {
  const sections: MarkerSection[] = [];
  const lines = content.split('\n');
  
  let current: MarkerSection | null = null;
  let contentLines: string[] = [];
  
  for (const line of lines) {
    if (line.includes('FX:BEGIN')) {
      // Parse begin marker
      const marker = parseBeginMarker(line);
      current = {
        marker,
        startLine: lines.indexOf(line),
        content: []
      };
      contentLines = [];
    } else if (line.includes('FX:END')) {
      // Complete section
      if (current) {
        current.content = contentLines.join('\n');
        current.endLine = lines.indexOf(line);
        sections.push(current);
        current = null;
      }
    } else if (current) {
      // Collect content
      contentLines.push(line);
    }
  }
  
  return sections;
}
```

### Parsing Marker Attributes

```typescript
function parseBeginMarker(line: string): Marker {
  const match = line.match(/FX:BEGIN\s+(.+?)(?:\s*\*\/|\s*-->|\s*$)/);
  if (!match) throw new Error('Invalid marker');
  
  const marker: Marker = { id: '' };
  const parts = match[1].split(/\s+/);
  
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=');
    const value = valueParts.join('='); // Handle values with =
    
    switch (key) {
      case 'id':
        marker.id = value;
        break;
      case 'lang':
        marker.lang = value;
        break;
      case 'file':
        marker.file = value.replace(/"/g, ''); // Remove quotes
        break;
      case 'checksum':
        marker.checksum = value;
        break;
      case 'order':
        marker.order = parseInt(value);
        break;
      case 'version':
        marker.version = parseInt(value);
        break;
      default:
        // Store unknown attributes
        marker[key] = value;
    }
  }
  
  return marker;
}
```

## Checksum System

### Checksum Calculation

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
  const normalized = content
    .replace(/\r\n/g, '\n')  // Windows to Unix
    .replace(/\r/g, '\n')    // Old Mac to Unix
    .trim();                 // Remove trailing whitespace
  
  return simpleHash(normalized);
}
```

### Checksum Validation

```typescript
function validateChecksum(
  content: string,
  expectedChecksum: string
): ValidationResult {
  const actualChecksum = calculateChecksum(content);
  
  if (actualChecksum === expectedChecksum) {
    return { valid: true };
  }
  
  return {
    valid: false,
    expected: expectedChecksum,
    actual: actualChecksum,
    message: 'Content has been modified'
  };
}
```

## Round-Trip Process

### Edit Detection

```typescript
function detectEdits(
  original: string,
  edited: string
): Edit[] {
  const originalSections = parseMarkers(original);
  const editedSections = parseMarkers(edited);
  
  const edits: Edit[] = [];
  
  // Map sections by ID
  const originalMap = new Map(
    originalSections.map(s => [s.marker.id, s])
  );
  const editedMap = new Map(
    editedSections.map(s => [s.marker.id, s])
  );
  
  // Find modifications
  for (const [id, editedSection] of editedMap) {
    const originalSection = originalMap.get(id);
    
    if (!originalSection) {
      // New snippet
      edits.push({
        type: 'added',
        id,
        content: editedSection.content
      });
    } else if (originalSection.content !== editedSection.content) {
      // Modified snippet
      edits.push({
        type: 'modified',
        id,
        oldContent: originalSection.content,
        newContent: editedSection.content,
        checksumValid: validateChecksum(
          originalSection.content,
          originalSection.marker.checksum
        ).valid
      });
    }
  }
  
  // Find deletions
  for (const [id, originalSection] of originalMap) {
    if (!editedMap.has(id)) {
      edits.push({
        type: 'deleted',
        id,
        content: originalSection.content
      });
    }
  }
  
  return edits;
}
```

### Applying Edits

```typescript
function applyEdits(edits: Edit[]): ApplyResult {
  const results: ApplyResult = {
    succeeded: [],
    failed: [],
    warnings: []
  };
  
  for (const edit of edits) {
    try {
      const location = findBySnippetId(edit.id);
      
      if (!location && edit.type !== 'added') {
        results.failed.push({
          edit,
          reason: 'Snippet not found'
        });
        continue;
      }
      
      switch (edit.type) {
        case 'modified':
          // Update existing snippet
          $$(location.path).val(edit.newContent);
          updateSnippetMetadata(location.path, {
            checksum: calculateChecksum(edit.newContent),
            version: incrementVersion(location.path),
            modifiedAt: new Date()
          });
          results.succeeded.push(edit);
          break;
          
        case 'added':
          // Create new snippet
          createSnippet(
            `snippets.new.${edit.id}`,
            edit.content,
            { id: edit.id }
          );
          results.succeeded.push(edit);
          break;
          
        case 'deleted':
          // Mark as deleted (don't actually remove)
          updateSnippetMetadata(location.path, {
            deleted: true,
            deletedAt: new Date()
          });
          results.warnings.push({
            edit,
            message: 'Snippet marked as deleted'
          });
          break;
      }
    } catch (error) {
      results.failed.push({
        edit,
        reason: error.message
      });
    }
  }
  
  return results;
}
```

## Marker Preservation

### Safe Editing Rules

1. **Don't modify marker lines** - Keep FX:BEGIN and FX:END intact
2. **Preserve marker attributes** - Don't change id, checksum, etc.
3. **Edit only between markers** - Content between markers is safe to edit
4. **Maintain pairing** - Every BEGIN needs a matching END
5. **Keep order** - Don't reorder marked sections

### Editor Integration

```typescript
// Protect markers in editor
function protectMarkers(editor: Editor) {
  editor.onBeforeChange((change) => {
    const line = editor.getLine(change.line);
    
    if (line.includes('FX:BEGIN') || line.includes('FX:END')) {
      // Prevent editing marker lines
      change.cancel();
      editor.showWarning('Cannot edit marker lines');
    }
  });
}
```

## Advanced Marker Features

### Nested Markers

```javascript
/* FX:BEGIN id=outer-001 */
function outer() {
  /* FX:BEGIN id=inner-001 */
  function inner() {}
  /* FX:END id=inner-001 */
}
/* FX:END id=outer-001 */
```

### Marker Metadata Extensions

```typescript
// Custom metadata in markers
/* FX:BEGIN id=api-001 method=GET route=/users auth=true */
router.get('/users', authenticate, getUsers);
/* FX:END id=api-001 */
```

### Conditional Markers

```typescript
// Future: Conditional rendering
/* FX:BEGIN id=debug-001 if=DEBUG */
console.log('Debug mode');
/* FX:END id=debug-001 */
```

## Error Handling

### Malformed Markers

```typescript
function fixMalformedMarkers(content: string): string {
  let fixed = content;
  
  // Fix unclosed markers
  const begins = [...fixed.matchAll(/FX:BEGIN.*?id=(\S+)/g)];
  const ends = [...fixed.matchAll(/FX:END.*?id=(\S+)/g)];
  
  const beginIds = new Set(begins.map(m => m[1]));
  const endIds = new Set(ends.map(m => m[1]));
  
  // Add missing END markers
  for (const id of beginIds) {
    if (!endIds.has(id)) {
      fixed += `\n/* FX:END id=${id} */`;
      console.warn(`Added missing END marker for ${id}`);
    }
  }
  
  // Remove orphaned END markers
  for (const id of endIds) {
    if (!beginIds.has(id)) {
      fixed = fixed.replace(
        new RegExp(`.*FX:END.*id=${id}.*\n?`, 'g'),
        ''
      );
      console.warn(`Removed orphaned END marker for ${id}`);
    }
  }
  
  return fixed;
}
```

### Recovery Strategies

```typescript
function recoverFromCorruption(content: string): RecoveryResult {
  const strategies = [
    fixMalformedMarkers,
    repairChecksums,
    reconstructFromBackup,
    inferFromContext
  ];
  
  for (const strategy of strategies) {
    try {
      const recovered = strategy(content);
      if (validateMarkers(recovered)) {
        return {
          success: true,
          content: recovered,
          strategy: strategy.name
        };
      }
    } catch (error) {
      continue;
    }
  }
  
  return {
    success: false,
    originalContent: content,
    errors: ['All recovery strategies failed']
  };
}
```

## Best Practices

### 1. Always Validate Markers

```typescript
function validateBeforeApply(content: string): boolean {
  // Check marker pairing
  const begins = (content.match(/FX:BEGIN/g) || []).length;
  const ends = (content.match(/FX:END/g) || []).length;
  
  if (begins !== ends) return false;
  
  // Check marker structure
  const sections = parseMarkers(content);
  for (const section of sections) {
    if (!section.marker.id) return false;
  }
  
  return true;
}
```

### 2. Preserve Marker Integrity

```typescript
// Never modify markers programmatically
const MARKER_REGEX = /.*FX:(BEGIN|END).*\n?/g;

function isMarkerLine(line: string): boolean {
  return MARKER_REGEX.test(line);
}
```

### 3. Handle Edge Cases

```typescript
// Handle empty content
if (!content.trim()) {
  content = '// Empty snippet';
}

// Handle binary content
if (isBinary(content)) {
  content = base64Encode(content);
  marker.encoding = 'base64';
}
```

## See Also

- [Parsing API](api-parsing.md) - Detailed parsing functions
- [Round-Trip Guide](guide-roundtrip.md) - Complete editing workflow
- [Architecture](architecture.md) - How markers fit in the system
- [Examples](examples-basic.md) - Marker usage examples