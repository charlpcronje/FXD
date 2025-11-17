# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

FXD (FX Disk) is an experimental quantum reactive code framework that represents code as a graph of reactive nodes (FXNodes) with CSS-like selectors for querying and manipulation. The project implements a novel approach to code organization and reactive programming.

### Key Concepts
- **FXNodes**: Reactive objects that store values and metadata with proxy-based APIs
- **CSS Selectors**: Query nodes using familiar CSS syntax like `$$('#id')` and `$$('[type="function"]')`
- **Reactive System**: Live data bindings and watchers for real-time updates
- **Snippet System**: Code organization and management layer
- **View System**: Virtual file composition from snippets

## Architecture Overview

### Core Framework (`fx.ts` / `fxn.ts`)
- **Primary File**: `fxn.ts` - The main FX core runtime (~1,700 lines, 90% complete)
- **FXNode Structure**: Nodes with `__id`, `__value`, `__nodes`, `__type`, `__proto`, `__behaviors`, etc.
- **Proxy Layer**: Access via `$$(path)` for reactive operations
- **Selector Engine**: CSS-style queries for node selection and filtering
- **Module Loader**: Synchronous module loading with Worker+SharedArrayBuffer support

### Module System (`modules/`)
The codebase contains 58+ modules providing extended functionality:
- **Core Modules**: `fx-snippets.ts`, `fx-view.ts`, `fx-parse.ts`, `fx-group-extras.ts`
- **Import/Export**: `fx-import.ts`, `fx-export.ts` for file system integration
- **Persistence**: `fx-persistence.ts`, `fx-metadata-persistence.ts` for SQLite storage
- **Development Tools**: `fx-visualizer-3d.ts`, `fx-diagnostic-tools.ts`
- **Integrations**: `fx-vscode-integration.ts`, `fx-git-scanner.ts`

### CLI Interface (`fxd-cli.ts`)
Command-line interface for FXD operations with disk state management, progress indicators, and comprehensive command set.

### Testing Infrastructure
- **Deno Tests**: Located in `test/` directory
- **Node Tests**: Located in `test-node/` directory  
- **Integration Tests**: Cross-platform validation and workflow testing
- **Performance Tests**: Benchmarking and scalability testing

## Development Commands

### Primary Development (Deno-based)
```powershell
# Start development server
deno task dev

# Build the framework
deno task build

# Run with serving
deno task serve

# Run demo with build and serve
deno task demo

# Materialize server
deno task materialize
```

### Testing
```powershell
# Run Deno tests
deno test -A test/
npm run test:deno

# Run all Node.js tests  
npm run test:all

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:ui
npm run test:sqlite

# Run with coverage
npm run test:coverage

# Run with watch mode
npm run test:watch
```

### CLI Operations
```powershell
# Show CLI help
deno run -A fxd-cli.ts help

# Create new FXD disk
deno run -A fxd-cli.ts create <name>

# Import files into FXD
deno run -A fxd-cli.ts import <path>

# List disk contents
deno run -A fxd-cli.ts list

# Run snippet or view
deno run -A fxd-cli.ts run <snippet-id>

# Start visualizer
deno run -A fxd-cli.ts visualize
```

### Build and Installation (Windows)
```powershell
# Build standalone executable
./build-fxd.bat

# Install system integration (Run as Administrator)
./install-fxd.bat
```

### Code Quality
```powershell
# Lint code
npm run lint
deno lint

# Format code
npm run format
deno fmt

# Generate coverage reports
npm run coverage
```

## Project Status and Architecture Notes

### Current State (Alpha v0.1)
- **Core Framework**: 90% complete and functional
- **Module Integration**: 40% complete, needs import fixes
- **Testing**: Written but blocked by import issues
- **Documentation**: Comprehensive but being updated

### Development Priorities
1. Fix module import system (2-3 hours estimated)
2. Get test suite passing (depends on imports)
3. Complete snippet and view system integration
4. Implement persistence layer (SQLite backend exists)

### Key Files for Understanding
- `fx.ts`/`fxn.ts` - Core reactive framework
- `fxd-cli.ts` - Command line interface
- `modules/fx-snippets.ts` - Snippet management
- `modules/fx-view.ts` - View rendering system
- `modules/fx-persistence.ts` - Data persistence
- `README.md` - Comprehensive project overview

### Module Import Issues
Many modules in the `modules/` directory have import path issues that prevent them from loading correctly. When working on module integration:
- Check import paths are relative to root
- Ensure fx.ts exports are accessible
- Test module loading before implementing features

### Testing Strategy
The project has dual testing infrastructure:
- **Deno tests** for core framework functionality
- **Node.js tests** for compatibility and extended features
- Always run both test suites when making core changes

### File System Layout
```
├── fx.ts / fxn.ts           # Core framework
├── fxd-cli.ts               # CLI interface
├── modules/                 # Extended functionality (58+ files)
├── test/                    # Deno test files
├── test-node/               # Node.js test files
├── docs/                    # Comprehensive documentation
├── examples/                # Usage examples
├── server/                  # Server implementations
└── dist/                    # Build outputs
```

### Performance Considerations
- FXNodes are designed for high-throughput operations
- CSS selectors are optimized for real-time queries
- SharedArrayBuffer used for cross-thread module loading
- SQLite backend planned for efficient persistence

### Integration Points
- VS Code integration stub available
- Git scanner for repository analysis
- Terminal integration for development workflow
- 3D visualizer for code exploration (experimental)