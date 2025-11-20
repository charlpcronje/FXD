# Changelog

All notable changes to the FXD project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2-alpha] - 2025-11-17

### Added
- **SQLite Persistence** - Complete .fxd file format with save/load capabilities
- **FXDisk API** - Simple save/load interface for project persistence
- **fx-atomics Plugin** - Quantum entanglement for reactive nodes
- **Reactive Snippet System** - Enhanced snippet reactivity
- **17 Persistence Tests** - Comprehensive testing of save/load functionality
- FXPersistence class with recursive graph traversal (689 lines)
- Deno SQLite adapter (145 lines)
- Persistence demo example (150+ lines)
- Project metadata storage
- Checksum validation for data integrity
- Transaction support for atomic operations
- Schema versioning and migrations

### Fixed
- FX value object structure (.raw extraction)
- Path reconstruction from parent/child relationships
- SQLite API compatibility (upgraded to v3.9.1)
- Statement finalization for proper resource cleanup
- Snippet index rebuilding with proper paths
- Object loading using .set() instead of .val()

### Changed
- Test count increased from 148 to 165 steps
- Test files increased from 5 to 6
- Full test suite time increased to 5.0 seconds (includes DB I/O)

### Technical Details
- Complete SQLite schema with 5 tables
- Recursive graph serialization
- Node type and metadata preservation
- Full round-trip verification
- Typical .fxd file size: 32-500 KB

## [0.1-alpha] - 2025-11-09

### Added
- **Core FX Framework** - Reactive nodes with proxy-based API (1,700 lines)
- **Snippet Management System** - Stable IDs, indexing, and metadata
- **Language-Agnostic Markers** - FX:BEGIN/END for 10+ languages
- **View Rendering** - Compose files from snippet groups
- **Round-trip Parsing** - Edit files and sync changes back to graph
- **Import Hoisting** - Automatic import organization for JS/TS
- **Group Operations** - Filter, sort, clone, diff, map, concat
- **Transaction Semantics** - Batch updates with rollback support
- **Conflict Detection** - Checksum-based change detection
- **148 Test Steps** - Across 5 test modules with 100% pass rate
- **Auto-discovering Test Runner** - JSON reporting and module breakdowns
- **4 Working Examples** - Demonstrating all core features

### Modules Created
- `fxn.ts` - Core reactive framework (1,700 lines)
- `modules/fx-snippets.ts` - Snippet system (169 lines)
- `modules/fx-view.ts` - View rendering (78 lines)
- `modules/fx-parse.ts` - Round-trip parsing (264 lines)
- `modules/fx-group-extras.ts` - Group extensions (279 lines)

### Tests Created
- `test/fx-markers.test.ts` - 36 steps
- `test/fx-snippets.test.ts` - 31 steps
- `test/fx-parse.test.ts` - 32 steps
- `test/fx-view.test.ts` - 28 steps
- `test/round-trip.test.ts` - 21 steps
- `test/run-all-tests.ts` - Test infrastructure

### Examples Created
- `examples/repo-js/demo.ts` - Round-trip workflow
- `examples/snippet-management/demo.ts` - Snippet API demonstration
- `examples/import-export-example.ts` - Import/Export functionality
- `examples/hello-world/demo.ts` - FX basics

### Fixed (Phase 1 Completion - 10 bugs)
1. HTML comment support in parser (added `<!--` and `-->`)
2. Test state pollution (added `clearSnippetIndex()`)
3. Transaction validation double-processing
4. Transaction rollback semantics (all-or-nothing)
5. Multi-language marker rendering (respect snippet's language)
6. Group clear() API issue (changed to return new groups)
7. Test selector ambiguity
8. Render options alias (support both `sep` and `separator`)
9. Resource leaks in group tests
10. Version preservation in orphan snippets

### Performance
- All operations sub-millisecond for typical use cases
- createSnippet: <1ms
- wrapSnippet: <1ms
- toPatches: ~2ms (2-3 snippets)
- applyPatches: ~1ms (2-3 nodes)
- renderView: ~2ms (2-3 snippets)
- Full round-trip: ~5ms
- Test suite: 810ms (148 steps)

### Technical Achievements
- CSS-like selector engine for node queries
- Reactive graph with automatic updates
- Language-agnostic code markers
- Checksum-based conflict detection
- Transaction support with rollback
- Import hoisting for JS/TS
- Multi-line content preservation
- Orphan handling for unknown snippets

## [Unreleased]

### Planned for v0.2-beta
- CLI integration with persistence
- Group persistence (save/load group configurations)
- View persistence
- Import/Export integration with .fxd files
- File watcher integration

### Planned for v0.3-rc
- Performance optimization for large graphs
- Basic web visualizer
- Git import/export bridge
- Complete API documentation
- Security review and input validation

### Planned for v1.0
- 200+ test steps
- Published to npm/deno.land
- Full documentation suite
- Community ready
- Production security review

---

## Version History Summary

- **v0.2-alpha (2025-11-17)**: Added SQLite persistence, 165 tests passing
- **v0.1-alpha (2025-11-09)**: Core framework complete, 148 tests passing
- **Total Development Time**: ~14.5 hours from concept to working persistence

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - See [LICENSE](LICENSE) file for details.
