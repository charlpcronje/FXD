# FXD Phase 2: Unified Vision - "The Ecosystem"

## Executive Summary
This document combines two Phase 2 visions: one focused on persistence and Git integration (Sections 13-16), and another on real-time collaboration and enterprise scale (distributed systems approach). Where approaches differ, both options are presented with rationale.

## Core Objectives
1. **Persistence**: SQLite-based `.fxd` format for project storage
2. **Version Control**: Git-like history system operating on atomic nodes
3. **Interoperability**: Seamless Git import/export bridge
4. **Collaboration**: Real-time multi-user editing foundation
5. **Scale**: Enterprise-ready architecture for large teams
6. **Intelligence**: AI-powered features and analytics

## Timeline Considerations
**⚠️ DIVERGENCE POINT**: 
- **Original Vision**: 6-month phased rollout
- **Pragmatic Approach**: 3-4 month focused delivery
- **Recommendation**: Start with core persistence (Sections 13-16), then expand based on user feedback

---

## PART A: Core Infrastructure (Priority 1)

### Section 13: Persistence Layer (SQLite)
*Goal: Make projects persistent by saving and loading the entire FX graph to a `.fxd` (SQLite) file.*

#### Implementation Tasks
- `13.1.` Create `modules/fx-persistence.ts` with `save` and `load` function signatures
- `13.2.` Add `better-sqlite3` as a Node.js dependency for the Electron Main process
- `13.3.` Define the `.fxd` database schema:
  - `nodes` table: Core node properties
  - `values` table: Serialized values and metadata
  - `metadata` table: Project-level metadata
- `13.4.` Implement the `save(filePath)` function:
  - `13.4.1.` Open/create the SQLite database file
  - `13.4.2.` Create the necessary tables if they don't exist
  - `13.4.3.` Implement a recursive traversal of the `$_$$` graph
  - `13.4.4.` For each node, `INSERT OR REPLACE` its core properties
  - `13.4.5.` Serialize and store `__value` and `__meta`
- `13.5.` Implement the `load(filePath)` function:
  - `13.5.1.` Open the SQLite database file
  - `13.5.2.` Clear the existing in-memory graph
  - `13.5.3.` `SELECT` all rows from tables
  - `13.5.4.` Reconstruct the entire `$_$$` graph in memory
  - `13.5.5.` Rebuild the `__parentMap` in `FXCore`
- `13.6.` Integrate with Electron for File menu operations
- `13.7.` Implement file association for `.fxd` files
- `13.8.` Create unit tests for save/load cycle
- `13.9.` Document the `.fxd` file format and persistence API

### Section 14: Temporal History Layer (FX-Git)
*Goal: Create a powerful, Git-like version control system that operates on atomic nodes.*

#### Implementation Tasks
- `14.1.` Create `addons/fx-history.ts` loaded as `$history` global
- `14.2.` Add a `$history` tree to `$_$$` for versioning data
- `14.3.` Update persistence schema:
  - `commits` table
  - `branches` table
  - `snapshots` table
- `14.4.` Implement `$history.commit(message: string)`:
  - `14.4.1.` Create snapshot of current `$_$$('code')` tree
  - `14.4.2.` Store snapshot in `snapshots` table
  - `14.4.3.` Create commit record with hash, message, timestamp
- `14.5.` Implement `$history.branch(branchName: string)`
- `14.6.` Implement `$history.checkout(branchNameOrCommitHash: string)`:
  - `14.6.1.` Load target commit's snapshot
  - `14.6.2.` Diff live graph with snapshot
  - `14.6.3.` Apply only necessary changes
- `14.7.` Implement `$history.log()` for commit history
- `14.8.` **UI:** Create "History" panel in FX Composer
- `14.9.` **UI:** Use D3.js for interactive commit graph visualization
- `14.10.` **UI:** Visual diff on commit selection
- `14.11.` Create unit tests for all `$history` operations
- `14.12.` Document the FX-Git workflow

### Section 15: Git Bridge (Import/Export)
*Goal: Allow FXD to interoperate with standard, file-based Git repositories.*

#### Implementation Tasks
- `15.1.` Create `addons/fx-git-bridge.ts`
- `15.2.` Add `isomorphic-git` as dependency
- `15.3.` Implement `exportToGit(targetDirectory: string)`:
  - `15.3.1.` Use `$views` engine to render all file views
  - `15.3.2.` Write rendered files to target directory
- `15.4.` Implement `importFromGit(sourceDirectory: string)`:
  - `15.4.1.` Use `fx-scan` to process all files
  - `15.4.2.` Create snippet nodes in `$_$$('code')`
  - `15.4.3.` Generate default file views
- `15.5.` **UI:** Add Import/Export menu items
- `15.6.` **UI:** Create "Git Sync" panel
- `15.7.` **UI:** Show diff between FXD and Git repo
- `15.8.` Create unit tests for import/export cycle
- `15.9.` Document Git interoperability workflow

### Section 16: Collaboration Foundation
*Goal: Prepare the architecture for real-time multi-user collaboration.*

#### Implementation Tasks
- `16.1.` Create `addons/fx-auth.ts` for session management
- `16.2.` Add `__meta.owner` and `__meta.lastModifiedBy`
- `16.3.` Modify `FXCore.set` to stamp ownership
- `16.4.` Update persistence schema for ownership tracking
- `16.5.` Design WebSocket protocol for real-time sync
- `16.6.` Implement basic WebSocket server in Electron
- `16.7.` Implement client-side bridge for WebSocket messages
- `16.8.` Create unit tests for multi-user scenarios
- `16.9.` Document collaboration model and protocol

---

## PART B: Advanced Features (Priority 2)

### Section 17: Real-Time Synchronization Engine
*Extended from original vision - adds advanced sync capabilities*

**⚠️ DIVERGENCE POINT**: 
- **Option A**: Simple WebSocket broadcast (as in Section 16)
- **Option B**: Full OT/CRDT system with conflict resolution
- **Recommendation**: Start with A, migrate to B when needed

#### Advanced Sync Features
- `17.1.` Operational Transform (OT) System
  - Transform functions for concurrent edits
  - Operation history and undo/redo
  - Intention preservation
- `17.2.` CRDT Integration
  - CRDT-based snippet ordering
  - Tombstone system for deletions
  - Vector clocks for causality
- `17.3.` Sync Protocol Enhancement
  - Delta compression for patches
  - Merkle tree for efficient diff detection
  - Partial sync for large repositories

### Section 18: Advanced Conflict Resolution
*Builds on basic collaboration to handle complex merge scenarios*

#### Conflict Management
- `18.1.` Three-Way Merge
  - Semantic merge for code structures
  - Syntax-aware conflict detection
  - Visual merge conflict UI
- `18.2.` Conflict Prevention
  - Optimistic locking mechanism
  - Field-level conflict detection
  - Pre-merge validation system
- `18.3.` Resolution Strategies
  - Pluggable resolution strategies
  - AI-powered conflict resolution
  - Team-defined policies

### Section 19: Performance & Scale
*Optimization for large codebases and teams*

**⚠️ DIVERGENCE POINT**: 
- **SQLite Approach**: Single-file database, good for <100MB projects
- **PostgreSQL Approach**: Distributed database, unlimited scale
- **Recommendation**: SQLite first, PostgreSQL adapter later

#### Performance Features
- `19.1.` Indexing and Search
  - Full-text search with FTS5
  - AST-based code search
  - Search query DSL
- `19.2.` Caching Strategy
  - Multi-tier caching
  - Smart prefetching
  - Distributed cache with Redis (optional)
- `19.3.` Database Optimization
  - Connection pooling
  - Query optimization
  - Read replicas (PostgreSQL only)

### Section 20: Plugin Architecture
*Extensibility framework for third-party developers*

#### Plugin System
- `20.1.` Plugin Core
  - Plugin manifest schema
  - Lifecycle management
  - Dependency resolution
- `20.2.` Plugin APIs
  - Snippet manipulation APIs
  - View extension points
  - Event subscription system
- `20.3.` Built-in Plugins
  - Git integration plugin
  - GitHub/GitLab sync
  - VS Code extension
  - Formatter/linter integrations

### Section 21: Security & Permissions
*Enterprise-ready security features*

**⚠️ DIVERGENCE POINT**: 
- **Local-First**: File-based permissions, no auth needed
- **Cloud-Ready**: Full auth/authz system
- **Recommendation**: Make auth optional/pluggable

#### Security Features
- `21.1.` Authentication (Optional)
  - JWT-based authentication
  - OAuth2 integration
  - SSO support
- `21.2.` Authorization
  - Role-based access control
  - Snippet-level permissions
  - Audit logging
- `21.3.` Encryption
  - At-rest encryption for `.fxd` files
  - Encrypted sync protocol
  - Key management system

### Section 22: Developer Experience
*Tools and integrations for productivity*

#### DX Enhancements
- `22.1.` CLI Enhancements
  - Interactive mode
  - Watch mode
  - Batch operations
- `22.2.` IDE Integration
  - Language Server Protocol
  - IntelliSense support
  - Refactoring tools
- `22.3.` Debugging Tools
  - Time-travel debugging
  - State inspection
  - Performance profiler

### Section 23: Analytics & Intelligence
*AI-powered insights and visualizations*

#### Intelligence Features
- `23.1.` Usage Analytics
  - Snippet usage patterns
  - Dependency graphs
  - Technical debt tracking
- `23.2.` Visualization
  - Code relationship diagrams
  - Heat maps
  - Timeline views
- `23.3.` AI-Powered Insights
  - Code smell detection
  - Refactoring suggestions
  - Security scanning

### Section 24: Testing & Quality
*Comprehensive testing strategy*

#### Quality Assurance
- `24.1.` Advanced Testing
  - Property-based tests
  - Mutation testing
  - Contract tests
- `24.2.` Performance Testing
  - Load testing framework
  - Latency benchmarks
  - Scalability tests
- `24.3.` Quality Gates
  - Pre-commit hooks
  - CI/CD integration
  - Release validation

---

## Implementation Strategy

### Phase 2.1: Foundation (Months 1-2)
**Priority: Sections 13-16**
- SQLite persistence layer ✅
- FX-Git history system ✅
- Git import/export bridge ✅
- Basic collaboration foundation ✅

### Phase 2.2: Enhancement (Month 3)
**Priority: Sections 17-19**
- Advanced sync (if needed)
- Conflict resolution
- Performance optimizations

### Phase 2.3: Ecosystem (Month 4+)
**Priority: Sections 20-24**
- Plugin architecture
- Security features
- Developer tools
- Analytics

## Success Metrics

### Essential (Phase 2.1)
- ✅ Projects persist to `.fxd` files
- ✅ Full Git interoperability
- ✅ Basic multi-user support
- ✅ <1s save/load for 10MB projects

### Stretch Goals (Phase 2.2+)
- Support 100+ concurrent users
- Sub-100ms sync latency
- <1% conflict rate
- 20+ plugins available

## Technical Stack

### Required
- Deno/Node.js runtime
- SQLite for persistence
- WebSockets for sync
- Electron for desktop app

### Optional (for scale)
- PostgreSQL for large deployments
- Redis for distributed cache
- Docker/Kubernetes for cloud
- TimescaleDB for analytics

## Migration Path
- Full backward compatibility with Phase 1
- `.fxd` files are self-contained and portable
- Progressive enhancement approach
- Zero-downtime upgrades

## Key Decisions

### Where Visions Align ✅
- Persistence as foundation
- Git integration essential
- Real-time collaboration needed
- Plugin architecture important
- Performance optimization critical

### Where Visions Differ ⚠️
1. **Database Choice**
   - Option A: SQLite (simple, portable)
   - Option B: PostgreSQL (scalable, complex)
   - Decision: Start with SQLite, add PostgreSQL adapter later

2. **Sync Complexity**
   - Option A: Simple broadcast (Section 16)
   - Option B: Full OT/CRDT (Section 17)
   - Decision: Simple first, upgrade if needed

3. **Timeline**
   - Option A: 3-4 months focused
   - Option B: 6 months comprehensive
   - Decision: 4 months with clear priorities

4. **Authentication**
   - Option A: File-based, no auth
   - Option B: Full auth system
   - Decision: Make it optional/pluggable

## Next Steps
1. Complete Phase 1 final integration (Sections 11-12)
2. Begin Section 13 (SQLite persistence)
3. Implement Sections 14-16 sequentially
4. Evaluate need for Sections 17+ based on user feedback
5. Maintain backward compatibility throughout

## Future Considerations (Phase 3)
- Blockchain-based version control
- Natural language programming
- Advanced AI code generation
- Cloud-native architecture
- Mobile/tablet support