# FXD - FX Disk Virtual Filesystem

## Overview

FXD (FX Disk) is an innovative virtual filesystem that reimagines how code is stored, organized, and edited. Built on top of the FX reactive node framework, FXD enables files to be composed from multiple reusable code snippets while maintaining full round-trip editing capabilities.

### Key Innovation

Traditional filesystems store code as monolithic files. FXD instead treats files as **views** over collections of **snippets** - reusable pieces of code with stable identities. This enables:

- **Code Reuse**: Same snippet can appear in multiple files
- **Granular Versioning**: Track changes at the snippet level
- **Smart Composition**: Files assembled from snippets using CSS-like selectors
- **Round-Trip Editing**: Edit rendered files normally, changes flow back to snippets
- **Reactive Updates**: Files automatically update when snippets change

### How It Works

1. **Snippets** are created with unique IDs and metadata
2. **Views** collect snippets using powerful selectors
3. **Rendering** combines snippets into files with special markers
4. **Editing** preserves markers allowing changes to flow back
5. **Bridge** maps virtual files to actual filesystem operations

## Phase 1 Documentation

Phase 1 establishes the core foundation of FXD with essential functionality for snippet management, view composition, and round-trip editing.

### Documentation Index

#### Getting Started
- [**Installation & Setup**](phase_1/installation.md) - How to install and configure FXD
- [**Quick Start Guide**](phase_1/quickstart.md) - Your first FXD project in 5 minutes
- [**Core Concepts**](phase_1/concepts.md) - Understanding snippets, views, and markers

#### API Reference
- [**Snippets API**](phase_1/api-snippets.md) - Creating and managing code snippets
- [**Views API**](phase_1/api-views.md) - Composing files from snippets
- [**Filesystem Bridge API**](phase_1/api-bridge.md) - Virtual filesystem operations
- [**Parsing API**](phase_1/api-parsing.md) - Round-trip editing support

#### Architecture
- [**System Architecture**](phase_1/architecture.md) - How FXD is built
- [**FX Framework Integration**](phase_1/fx-integration.md) - Leveraging the reactive foundation
- [**Marker System**](phase_1/markers.md) - How round-trip editing works

#### Guides
- [**Working with Snippets**](phase_1/guide-snippets.md) - Best practices for snippet design
- [**CSS Selectors**](phase_1/guide-selectors.md) - Powerful snippet selection
- [**Round-Trip Editing**](phase_1/guide-roundtrip.md) - Editing files while preserving structure

#### Examples
- [**Basic Examples**](phase_1/examples-basic.md) - Simple use cases
- [**Advanced Patterns**](phase_1/examples-advanced.md) - Complex compositions
- [**Demo Application**](phase_1/demo.md) - Complete working example

## System Requirements

- **Runtime**: Deno 1.40+ or Node.js 20+
- **Memory**: 512MB minimum
- **OS**: Windows, macOS, Linux

## Current Status

Phase 1 is **functional** with core features working:
- ✅ Snippet creation and management
- ✅ View composition with selectors
- ✅ File rendering with markers
- ✅ Round-trip editing
- ✅ Filesystem bridge
- ✅ Demo server

## Future Phases

- **Phase 2**: Git integration, conflict resolution, advanced merging
- **Phase 3**: Web UI, visual snippet management
- **Phase 4**: Collaboration features, real-time sync
- **Phase 5**: AI-assisted code organization

## Contributing

FXD is an experimental project exploring new approaches to code organization. Contributions, ideas, and feedback are welcome.

## License

MIT License - See LICENSE file for details