# FXD Phase 1 Test Suite

Comprehensive test suite for FXD (FX Disk) Phase 1 implementation.

## Test Structure

The test suite is organized into 5 main test files covering all Phase 1 components:

### 1. `fx-snippets.test.ts`
Tests the core snippet functionality:
- Snippet creation with default and custom options
- ID-based indexing and retrieval
- Lifecycle management (moves, renames)
- Type guards and validation
- Text utilities (EOL normalization, hashing)
- Marker value escaping/unescaping
- Comment style definitions

### 2. `fx-markers.test.ts`
Tests the FX:BEGIN/END marker system:
- Marker generation for different languages
- Comment style selection (block, line, HTML)
- Attribute handling (id, lang, file, checksum, version)
- Special character escaping in markers
- Checksum integration
- Multi-line content preservation

### 3. `fx-view.test.ts`
Tests the view rendering system:
- Basic view rendering with snippets
- CSS selector-based filtering
- Group extensions (listSnippets, mapSnippets, etc.)
- View registry and discovery
- Round-trip compatibility
- Language-specific rendering

### 4. `fx-parse.test.ts`
Tests patch parsing and application:
- Parsing wrapped snippets from text
- Applying patches to existing snippets
- Creating orphan snippets for missing IDs
- Batch patch application with transactions
- Conflict detection using checksums
- Rollback capabilities

### 5. `round-trip.test.ts`
Tests the complete edit cycle:
- Full cycle: create → render → edit → parse → apply
- Multi-language support
- Formatting and indentation preservation
- New snippet creation
- Conflict handling
- Reordering and deletion scenarios
- Version tracking
- Error recovery

## Running Tests

### Run All Tests
```bash
deno run -A test/run-tests.ts
```

### Run Individual Test Files
```bash
deno test -A test/fx-snippets.test.ts
deno test -A test/fx-markers.test.ts
deno test -A test/fx-view.test.ts
deno test -A test/fx-parse.test.ts
deno test -A test/round-trip.test.ts
```

### Run with Different Reporters
```bash
# TAP format
deno test -A --reporter=tap test/fx-snippets.test.ts

# Pretty format (default)
deno test -A --reporter=pretty test/fx-snippets.test.ts

# Dot format
deno test -A --reporter=dot test/fx-snippets.test.ts
```

## Test Coverage

The test suite covers:

- **Core FX Integration**: Proper initialization and usage of the FX framework
- **Snippet Management**: Creation, indexing, and lifecycle of code snippets
- **Marker System**: Generation and parsing of FX:BEGIN/END markers
- **View Rendering**: Dynamic file generation from snippet collections
- **Round-Trip Editing**: Complete edit cycle with persistence
- **Error Handling**: Graceful degradation and recovery
- **Multi-Language Support**: JS, Python, HTML, and other languages
- **Conflict Detection**: Checksum-based change detection
- **Transaction Support**: Atomic batch operations with rollback

## Key Features Tested

1. **Stable IDs**: Snippets maintain consistent IDs through edits
2. **Marker Preservation**: Comments preserve snippet boundaries
3. **Format Preservation**: Indentation and whitespace maintained
4. **Orphan Handling**: Unknown snippets create orphans
5. **Checksum Validation**: Detect concurrent modifications
6. **Group Operations**: Filter, sort, reorder snippet collections
7. **View Discovery**: Automatic detection of view nodes
8. **Version Tracking**: Snippet version management

## Test Utilities

### `run-tests.ts`
Main test runner that:
- Runs all test files in sequence
- Provides colored output
- Shows summary statistics
- Returns appropriate exit codes

### Test Helpers
- `beforeEach`: Clears test namespace between tests
- `extendGroups`: Ensures group extensions are loaded
- FX initialization: Sets up `$$` and `$` globals

## Dependencies

- **Deno Standard Library**: Testing framework and assertions
- **FX Framework**: Core reactive system
- **FXD Modules**: Snippets, parsing, views, groups

## Notes

- Tests use the `test.*` namespace to avoid conflicts
- Each test file is self-contained and can run independently
- The test suite validates Phase 1 requirements completely
- All tests should pass before deploying Phase 1

## Future Enhancements (Phase 2+)

- Performance benchmarks
- Stress testing with large snippet collections
- Integration tests with file system plugin
- WebSocket synchronization tests
- Multi-user conflict resolution tests
- Browser-based testing for web components