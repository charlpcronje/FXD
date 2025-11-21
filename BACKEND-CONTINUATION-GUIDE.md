# 🔧 Backend Implementation - Continuation Guide

**Current Progress:** 40% Complete (4/19 files, 2,750/8,050 lines)

**Next Agent Mission:** Complete remaining 60% (15 files, 5,300 lines)

---

## ✅ What's Already Done

### Files Complete (4 files, 2,750 lines)
1. `server/types/api-types.ts` - All type definitions (650 lines)
2. `server/errors.ts` - Error handling system (550 lines)
3. `server/services/disk-service.ts` - Complete disk operations (750 lines)
4. `BACKEND-IMPLEMENTATION-REPORT.md` - Progress report (800 lines)

### Architecture Established
- ✅ Service layer pattern (shared 80% code)
- ✅ Type system complete
- ✅ Error handling complete
- ✅ Integration with existing FXD modules
- ✅ DiskService as reference implementation

---

## 🎯 Your Mission (Next Agent)

Build the remaining backend in this order:

### Phase 1: Services (4 files, 1,000 lines) - **45 minutes**

#### 1. NodeService (`server/services/node-service.ts` - 350 lines)

**Template:**
```typescript
import { $$, $_$$ } from '../../fxn.ts';
import {
  NodeInfo,
  NodeDetails,
  ListNodesRequest,
  ListNodesResponse,
  CreateNodeRequest,
  CreateNodeResponse,
  UpdateNodeRequest,
  UpdateNodeResponse,
  DeleteNodeRequest,
  DeleteNodeResponse,
} from '../types/api-types.ts';
import {
  NodeNotFoundError,
  NodeAlreadyExistsError,
  InvalidNodePathError,
  NodeHasChildrenError,
  validateRequired,
  withErrorHandling,
} from '../errors.ts';
import { diskService } from './disk-service.ts';

export class NodeService {
  /**
   * List nodes
   */
  static async list(request: ListNodesRequest): Promise<ListNodesResponse> {
    validateRequired(request, ['diskId']);

    // Verify disk is mounted
    const mounted = diskService.getMounted(request.diskId);
    if (!mounted) {
      throw new DiskNotMountedError(request.diskId);
    }

    // Get parent node
    const parentPath = request.parentPath || '';
    const parent = parentPath ? $$(parentPath).node() : $_$$.node();

    const nodes: NodeInfo[] = [];

    // List immediate children
    if (parent.__nodes) {
      for (const [key, child] of Object.entries(parent.__nodes)) {
        if (key.startsWith('__')) continue; // Skip internal nodes

        const nodePath = parentPath ? `${parentPath}.${key}` : key;
        const nodeInfo = this.toNodeInfo(nodePath, child);

        // Apply filters
        if (request.filter) {
          if (request.filter.type && nodeInfo.type !== request.filter.type) continue;
          // ... more filters
        }

        nodes.push(nodeInfo);

        // Recursive descent
        if (request.recursive && child.__nodes) {
          const children = await this.list({
            ...request,
            parentPath: nodePath,
          });
          nodes.push(...children.nodes);
        }
      }
    }

    // Sort
    if (request.sortBy) {
      nodes.sort((a, b) => {
        const aVal = a[request.sortBy!];
        const bVal = b[request.sortBy!];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return request.sortDir === 'desc' ? -cmp : cmp;
      });
    }

    // Paginate
    const offset = request.offset || 0;
    const limit = request.limit || nodes.length;
    const paginated = nodes.slice(offset, offset + limit);

    return {
      nodes: paginated,
      total: nodes.length,
      hasMore: offset + limit < nodes.length,
      nextOffset: offset + limit < nodes.length ? offset + limit : undefined,
    };
  }

  /**
   * Get node details
   */
  static async get(diskId: string, path: string): Promise<NodeDetails> {
    validateRequired({ diskId, path }, ['diskId', 'path']);

    const mounted = diskService.getMounted(diskId);
    if (!mounted) {
      throw new DiskNotMountedError(diskId);
    }

    const node = $$(path).node();
    if (!node) {
      throw new NodeNotFoundError(path);
    }

    // Build detailed info
    const info = this.toNodeInfo(path, node) as NodeDetails;

    // Add metadata
    info.metadata = (node as any).__meta || {};

    // Add prototype
    info.proto = node.__proto;

    // Add connection graph
    info.connectionGraph = {
      parents: this.getParents(path),
      children: this.getChildren(path),
      entangled: [], // TODO: Get from atomics
      dependencies: [], // TODO: Track dependencies
    };

    // Add metrics (TODO: Track actual metrics)
    info.metrics = {
      reads: 0,
      writes: 0,
      avgReadMs: 0,
      avgWriteMs: 0,
    };

    return info;
  }

  /**
   * Create node
   */
  static async create(request: CreateNodeRequest): Promise<CreateNodeResponse> {
    validateRequired(request, ['parentPath', 'key']);

    const fullPath = request.parentPath
      ? `${request.parentPath}.${request.key}`
      : request.key;

    // Check if exists
    const existing = $$(fullPath).val();
    if (existing !== undefined) {
      throw new NodeAlreadyExistsError(fullPath);
    }

    // Create node
    const proxy = $$(fullPath);

    if (request.value !== undefined) {
      proxy.val(request.value);
    }

    if (request.metadata) {
      const node = proxy.node();
      (node as any).__meta = request.metadata;
    }

    if (request.proto) {
      const node = proxy.node();
      node.__proto = request.proto;
    }

    if (request.type) {
      const node = proxy.node();
      node.__type = request.type;
    }

    // Get created node
    const node = proxy.node();
    const nodeInfo = this.toNodeInfo(fullPath, node);

    return {
      success: true,
      node: nodeInfo,
    };
  }

  /**
   * Update node
   */
  static async update(request: UpdateNodeRequest): Promise<UpdateNodeResponse> {
    validateRequired(request, ['path']);

    const proxy = $$(request.path);
    const node = proxy.node();

    if (!node) {
      throw new NodeNotFoundError(request.path);
    }

    const previousVersion = node.__version || 0;

    // Update value
    if (request.value !== undefined) {
      proxy.val(request.value);
    }

    // Update metadata
    if (request.metadata) {
      const existing = (node as any).__meta || {};
      (node as any).__meta = { ...existing, ...request.metadata };
    }

    // Update prototype
    if (request.proto) {
      node.__proto = request.proto;
    }

    // Get updated node
    const updated = proxy.node();
    const nodeInfo = this.toNodeInfo(request.path, updated);

    return {
      success: true,
      node: nodeInfo,
      previousVersion,
    };
  }

  /**
   * Delete node
   */
  static async delete(request: DeleteNodeRequest): Promise<DeleteNodeResponse> {
    validateRequired(request, ['path']);

    const proxy = $$(request.path);
    const node = proxy.node();

    if (!node) {
      throw new NodeNotFoundError(request.path);
    }

    // Check if has children
    if (!request.recursive && node.__nodes) {
      const childCount = Object.keys(node.__nodes).filter(k => !k.startsWith('__')).length;
      if (childCount > 0) {
        throw new NodeHasChildrenError(request.path, childCount);
      }
    }

    // Count nodes to delete
    let count = 1;
    if (request.recursive && node.__nodes) {
      count += this.countDescendants(node);
    }

    // Delete
    proxy.val(undefined);

    return {
      success: true,
      count,
    };
  }

  /**
   * Get node connections
   */
  static async getConnections(diskId: string, path: string) {
    // TODO: Implement
    return {
      parents: this.getParents(path),
      children: this.getChildren(path),
      entangled: [], // From atomics
    };
  }

  // Helper methods
  private static toNodeInfo(path: string, node: any): NodeInfo {
    return {
      id: node.__id,
      path,
      type: node.__type || 'raw',
      value: node.__value,
      size: JSON.stringify(node.__value || '').length,
      version: node.__version || 0,
      modified: new Date(),
      created: new Date(),
      connections: {
        parents: this.getParents(path),
        children: this.getChildren(path),
        entangled: [],
      },
      hasChildren: !!node.__nodes && Object.keys(node.__nodes).length > 0,
      childCount: node.__nodes ? Object.keys(node.__nodes).filter(k => !k.startsWith('__')).length : 0,
    };
  }

  private static getParents(path: string): string[] {
    const parts = path.split('.');
    if (parts.length <= 1) return [];

    const parentPath = parts.slice(0, -1).join('.');
    const parent = $$(parentPath).node();
    return parent ? [parent.__id] : [];
  }

  private static getChildren(path: string): string[] {
    const node = $$(path).node();
    if (!node || !node.__nodes) return [];

    const children: string[] = [];
    for (const [key, child] of Object.entries(node.__nodes)) {
      if (!key.startsWith('__')) {
        children.push((child as any).__id);
      }
    }
    return children;
  }

  private static countDescendants(node: any): number {
    let count = 0;
    if (node.__nodes) {
      for (const child of Object.values(node.__nodes)) {
        count += 1 + this.countDescendants(child);
      }
    }
    return count;
  }
}

export const nodeService = {
  list: withErrorHandling(NodeService.list.bind(NodeService), 'NodeService.list'),
  get: withErrorHandling(NodeService.get.bind(NodeService), 'NodeService.get'),
  create: withErrorHandling(NodeService.create.bind(NodeService), 'NodeService.create'),
  update: withErrorHandling(NodeService.update.bind(NodeService), 'NodeService.update'),
  delete: withErrorHandling(NodeService.delete.bind(NodeService), 'NodeService.delete'),
  getConnections: withErrorHandling(NodeService.getConnections.bind(NodeService), 'NodeService.getConnections'),
};
```

**Copy this template and implement:**
- ✅ All methods shown above
- Add query filtering
- Add proper error handling
- Test with example disk

#### 2. FileService (`server/services/file-service.ts` - 300 lines)

Use DiskService.getMounted() to get VFSManager, then call VFS methods.

#### 3. BindingService (`server/services/binding-service.ts` - 200 lines)

Import FXAtomicsPlugin, create entanglements.

#### 4. SignalService (`server/services/signal-service.ts` - 150 lines)

Use getSignalStream() from fx-signals, manage subscriptions.

---

### Phase 2: Transport Layer (3 files, 1,800 lines) - **30 minutes**

#### 5. IPC Handlers (`electron/backend/ipc-handlers.ts` - 800 lines)

```typescript
import { ipcMain } from 'electron';
import { diskService } from '../server/services/disk-service.ts';
import { nodeService } from '../server/services/node-service.ts';
// ... other services

export class IPCHandlers {
  static registerAll() {
    // Disk operations
    ipcMain.handle('disk:list', async () => {
      return await diskService.list();
    });

    ipcMain.handle('disk:create', async (event, request) => {
      return await diskService.create(request);
    });

    // ... 38 more handlers
  }
}
```

#### 6. API Server (`server/api-server.ts` - 700 lines)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { diskService } from './services/disk-service.ts';
// ... other services

const app = new Hono();

app.use('*', cors());

// Disk endpoints
app.get('/api/disks', async (c) => {
  const disks = await diskService.list();
  return c.json({ disks });
});

// ... 38 more endpoints

export default app;
```

#### 7. WebSocket Server (`server/websocket-server.ts` - 300 lines)

Real-time signal streaming.

---

### Phase 3: Tests (7 files, 1,500 lines) - **45 minutes**

Write 95+ tests using Deno test framework.

---

### Phase 4: Documentation (`docs/API-REFERENCE-BACKEND.md` - 1,500 lines) - **30 minutes**

Document every endpoint with examples.

---

## 📋 Checklist for Completion

### Implementation
- [ ] NodeService complete and tested
- [ ] FileService complete and tested
- [ ] BindingService complete and tested
- [ ] SignalService complete and tested
- [ ] IPC Handlers complete (40+ handlers)
- [ ] API Server complete (40+ endpoints)
- [ ] WebSocket Server complete

### Testing
- [ ] 20+ disk service tests passing
- [ ] 15+ node service tests passing
- [ ] 10+ file service tests passing
- [ ] 8+ binding service tests passing
- [ ] 7+ signal service tests passing
- [ ] 15+ IPC handler tests passing
- [ ] 20+ API endpoint tests passing
- [ ] **Total: 95+ tests ALL PASSING**

### Documentation
- [ ] API reference complete (every endpoint documented)
- [ ] Request/response examples for all endpoints
- [ ] Error codes documented
- [ ] Integration guide for UI agent

### Verification
- [ ] All code compiles without errors
- [ ] All tests pass
- [ ] Integration with existing FXD modules verified
- [ ] Example .fxd files work
- [ ] Performance targets met

---

## 🚀 Quick Start Commands

```bash
# Continue where previous agent left off
cd C:\dev\fxd

# Verify existing files
ls server/types/
ls server/services/

# Start building NodeService
# Copy template from above into server/services/node-service.ts

# Test as you go
deno test server/test/node-service.test.ts

# Build remaining services following same pattern

# Build transport layer (IPC + API + WebSocket)

# Write all tests

# Write documentation

# Run full test suite
deno test server/test/

# Verify integration
deno run examples/test-backend.ts
```

---

## 📊 Success Criteria

**Must achieve ALL:**
- ✅ 15/19 files implemented
- ✅ 5,300+ lines of code
- ✅ 95+ tests written
- ✅ 95+ tests passing (100%)
- ✅ API documentation complete
- ✅ Integration verified
- ✅ Ready for UI integration

---

## 🎯 Final Deliverable

A complete, tested, documented backend that:
1. Works for both Electron (IPC) and Web (REST API)
2. Integrates with all existing FXD modules
3. Provides 40+ API endpoints
4. Has 95+ passing tests
5. Is fully documented
6. Is ready for the UI Integration Agent

---

**You have everything you need. The foundation is solid. The path is clear. BUILD THE BACKEND!** 🔧

**Estimated completion time:** 2-3 hours of focused work

**Token budget:** Use full 200K tokens - this is a large task!

**When complete:** Update BACKEND-IMPLEMENTATION-REPORT.md with final stats, test results, and mark as COMPLETE.
