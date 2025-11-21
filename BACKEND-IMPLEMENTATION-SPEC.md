# 🔧 FXD Backend Implementation Specification

**Agent Mission:** Build complete backend for FXD Electron app + fxd.dev web platform
**Time Estimate:** 1-1.5 hours
**Context:** 1M tokens
**Model:** Sonnet (best for API development)

---

## 🎯 MISSION OVERVIEW

**What You're Building:**
A dual-mode backend that works for:
1. **Electron IPC** - Main process handlers for desktop app
2. **REST API** - HTTP endpoints for web (fxd.dev)
3. **WebSocket** - Real-time signal streaming
4. **Shared Business Logic** - Works for both!

**Integration Points:**
- Use existing: FXDisk, FXDiskWAL, SignalStream, FXAtomicsPlugin
- Use from Agent 1: RAMDiskManager, VFSManager, AutoImport

---

## 📦 DELIVERABLES REQUIRED

### 1. Electron IPC Bridge (`electron/backend/ipc-handlers.ts` - 800+ lines)

**Implement ALL IPC handlers:**

```typescript
import { ipcMain } from 'electron';
import { FXDiskWAL } from '../../modules/fx-persistence-wal.ts';
import { RAMDiskManager } from '../../modules/fx-ramdisk.ts';
import { VFSManager } from '../../modules/fx-vfs.ts';
import { SignalStream } from '../../modules/fx-signals.ts';
import { FXAtomicsPlugin } from '../../plugins/fx-atomics.ts';

export class IPCHandlers {
  private disks = new Map<string, FXDiskWAL>();
  private mounts = new Map<string, RAMDiskManager>();
  private signalStreams = new Map<string, SignalStream>();

  registerAll() {
    // Disk operations
    ipcMain.handle('disk:list', this.listDisks);
    ipcMain.handle('disk:load', this.loadDisk);
    ipcMain.handle('disk:create', this.createDisk);
    ipcMain.handle('disk:delete', this.deleteDisk);
    ipcMain.handle('disk:mount', this.mountDisk);
    ipcMain.handle('disk:unmount', this.unmountDisk);
    ipcMain.handle('disk:stats', this.getDiskStats);

    // Node operations
    ipcMain.handle('nodes:list', this.listNodes);
    ipcMain.handle('nodes:get', this.getNode);
    ipcMain.handle('nodes:create', this.createNode);
    ipcMain.handle('nodes:update', this.updateNode);
    ipcMain.handle('nodes:delete', this.deleteNode);
    ipcMain.handle('nodes:connections', this.getConnections);

    // File operations
    ipcMain.handle('files:list', this.listFiles);
    ipcMain.handle('files:read', this.readFile);
    ipcMain.handle('files:write', this.writeFile);
    ipcMain.handle('files:delete', this.deleteFile);
    ipcMain.handle('files:import', this.importDirectory);

    // Binding operations
    ipcMain.handle('bindings:list', this.listBindings);
    ipcMain.handle('bindings:create', this.createBinding);
    ipcMain.handle('bindings:delete', this.deleteBinding);
    ipcMain.handle('bindings:update', this.updateBinding);

    // Signal operations
    ipcMain.handle('signals:subscribe', this.subscribeSignals);
    ipcMain.handle('signals:history', this.getSignalHistory);
    ipcMain.handle('signals:stats', this.getSignalStats);

    // View operations
    ipcMain.handle('views:list', this.listViews);
    ipcMain.handle('views:create', this.createView);
    ipcMain.handle('views:render', this.renderView);

    // System operations
    ipcMain.handle('system:health', this.systemHealth);
    ipcMain.handle('system:info', this.systemInfo);
  }

  // Implement each handler...
  private async listDisks(event): Promise<DiskInfo[]> {
    // Scan for .fxd and .fxwal files
    // Return metadata for each
  }

  private async loadDisk(event, path: string): Promise<LoadResult> {
    // Load .fxd or .fxwal
    // Parse into nodes
    // Return disk ID
  }

  // ... implement all 40+ handlers
}
```

### 2. Web API Server (`server/api-server.ts` - 700+ lines)

**RESTful API using Hono (or Express):**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Same business logic as IPC!
import { DiskService } from './services/disk-service.ts';
import { NodeService } from './services/node-service.ts';

// Disk endpoints
app.get('/api/disks', async (c) => {
  const disks = await DiskService.list();
  return c.json(disks);
});

app.post('/api/disks', async (c) => {
  const data = await c.req.json();
  const disk = await DiskService.create(data);
  return c.json(disk, 201);
});

// ... 40+ more endpoints (mirrors IPC handlers)

export default app;
```

### 3. Shared Business Logic (`server/services/` - 1,200+ lines)

**Service layer that both IPC and API use:**

```typescript
// server/services/disk-service.ts (400 lines)
export class DiskService {
  static async list(): Promise<DiskInfo[]> {
    // Implementation shared by IPC and API
  }

  static async load(path: string): Promise<LoadResult> {
    // Implementation shared by IPC and API
  }

  // ... all disk operations
}

// server/services/node-service.ts (300 lines)
export class NodeService {
  static async list(diskId: string): Promise<NodeInfo[]>
  static async get(diskId: string, nodeId: string): Promise<NodeDetails>
  static async create(diskId: string, data: NodeCreate): Promise<NodeInfo>
  // ... all node operations
}

// server/services/file-service.ts (250 lines)
export class FileService {
  static async list(diskId: string, path: string): Promise<FileInfo[]>
  static async read(diskId: string, path: string): Promise<string>
  static async write(diskId: string, path: string, content: string): Promise<void>
  // ... all file operations
}

// server/services/binding-service.ts (150 lines)
export class BindingService {
  static async create(diskId: string, config: BindConfig): Promise<string>
  static async list(diskId: string): Promise<BindingInfo[]>
  // ... all binding operations
}

// server/services/signal-service.ts (100 lines)
export class SignalService {
  static async subscribe(diskId: string, callback: Function): Promise<void>
  static async history(diskId: string, cursor?: number): Promise<SignalRecord[]>
  // ... signal operations
}
```

### 4. WebSocket Server (`server/websocket-server.ts` - 300+ lines)

**Real-time signal streaming:**

```typescript
import { WebSocketServer } from 'ws';

export class SignalWebSocket {
  private wss: WebSocketServer;
  private subscriptions = new Map<string, Set<WebSocket>>();

  start(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      ws.on('message', (msg) => {
        const { type, diskId, kind } = JSON.parse(msg);

        if (type === 'subscribe') {
          this.subscribeClient(diskId, kind, ws);
        } else if (type === 'unsubscribe') {
          this.unsubscribeClient(diskId, ws);
        }
      });

      ws.on('close', () => {
        this.cleanupClient(ws);
      });
    });
  }

  private subscribeClient(diskId: string, kind: string, ws: WebSocket) {
    // Get signal stream for disk
    const stream = SignalService.getStream(diskId);

    // Subscribe to signals
    stream.tail(kind, (signal) => {
      ws.send(JSON.stringify({ type: 'signal', signal }));
    });
  }

  // ... implementation
}
```

### 5. Type Definitions (`server/types/api-types.ts` - 400+ lines)

**Complete type definitions for all requests/responses:**

```typescript
// Disk types
export interface DiskInfo {
  id: string;
  name: string;
  path: string;
  format: 'sqlite' | 'wal';
  size: number;
  nodeCount: number;
  fileCount: number;
  mounted: boolean;
  mountPoint?: string;
  lastModified: Date;
  created: Date;
  syncState: 'synced' | 'pending' | 'error';
  autoSync: boolean;
}

export interface DiskStats {
  nodes: number;
  snippets: number;
  views: number;
  signals: number;
  totalSize: number;
  memoryUsage: number;
  diskUsage: number;
  compression: number;
  lastSync: Date;
}

export interface CreateDiskRequest {
  name: string;
  path?: string;
  format?: 'sqlite' | 'wal';
  autoImport?: boolean;
  extractSymbols?: boolean;
  createViews?: boolean;
}

// Node types
export interface NodeInfo {
  id: string;
  path: string;
  type: string;
  value: any;
  size: number;
  version: number;
  modified: Date;
  connections: {
    parents: string[];
    children: string[];
    entangled: string[];
  };
}

// ... 20+ more interfaces
```

### 6. Error Handling (`server/errors.ts` - 150+ lines)

```typescript
export class DiskNotFoundError extends Error {
  constructor(id: string) {
    super(`Disk not found: ${id}`);
    this.name = 'DiskNotFoundError';
  }
}

export class MountError extends Error {
  constructor(reason: string) {
    super(`Mount failed: ${reason}`);
    this.name = 'MountError';
  }
}

// ... all error types

export function handleError(error: Error): ErrorResponse {
  // Convert to API-friendly error
  // Log appropriately
  // Return user-friendly message
}
```

### 7. Comprehensive Tests (`server/test/` - 1,000+ lines, 60+ tests)

**Required test files:**

```typescript
// server/test/disk-service.test.ts (20 tests)
describe("DiskService", () => {
  it("should list all disks")
  it("should load .fxd file")
  it("should load .fxwal file")
  it("should create new disk")
  it("should handle corrupt files")
  // ... 15 more
});

// server/test/node-service.test.ts (15 tests)
describe("NodeService", () => {
  it("should list nodes")
  it("should get node details with connections")
  it("should create node")
  it("should update node")
  // ... 11 more
});

// server/test/file-service.test.ts (10 tests)
// server/test/binding-service.test.ts (8 tests)
// server/test/signal-service.test.ts (7 tests)
// server/test/ipc-handlers.test.ts (15 tests)
// server/test/api-endpoints.test.ts (20 tests)
```

### 8. API Documentation (`docs/API-REFERENCE-BACKEND.md` - 1,500+ lines)

**Complete OpenAPI/Swagger spec:**

```markdown
# FXD Backend API Reference

## Disk Operations

### GET /api/disks
List all FXD disks

**Response:**
\`\`\`json
{
  "disks": [
    {
      "id": "disk_abc123",
      "name": "MyProject",
      "path": "/path/to/MyProject.fxd",
      "format": "wal",
      "size": 47483648,
      "nodeCount": 1234,
      "mounted": true,
      "mountPoint": "R:\\",
      // ... complete schema
    }
  ]
}
\`\`\`

**Example:**
\`\`\`bash
curl http://localhost:3000/api/disks
\`\`\`

### POST /api/disks
Create new disk

**Request:**
\`\`\`json
{
  "name": "MyProject",
  "path": "/path/to/directory",
  "format": "wal",
  "autoImport": true,
  "extractSymbols": true
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "disk_abc123",
  "status": "created",
  "stats": { ... }
}
\`\`\`

(Document all 40+ endpoints like this)
```

### 9. Integration Layer (`server/integration/` - 300+ lines)

**Bridge to existing FXD modules:**

```typescript
// server/integration/fxd-bridge.ts
export class FXDBridge {
  // Load FXD modules
  async initialize() {
    // Import fxn.ts and set up globals
    const { $$, $_$$, fx } = await import('../../fxn.ts');
    globalThis.$$ = $$;
    globalThis.$_$$ = $_$$;
    globalThis.fx = fx;
  }

  // Use FXDisk
  async loadDisk(path: string) {
    const disk = new FXDiskWAL(path);
    await disk.load();
    return disk;
  }

  // Use Signals
  getSignalStream(diskId: string) {
    return getSignalStream();
  }

  // Use Atomics
  createBinding(sourceId: string, targetId: string, config: any) {
    const atomics = loadAtomicsPlugin();
    return atomics.entangle(sourceId, targetId, config);
  }
}
```

### 10. Performance Monitoring (`server/monitoring.ts` - 200+ lines)

```typescript
export class PerformanceMonitor {
  // Track all operations
  private metrics = new Map<string, Metric>();

  track(operation: string, duration: number, success: boolean) {
    // Store metrics
  }

  getStats() {
    return {
      totalOperations: this.metrics.size,
      avgDuration: this.calculateAverage(),
      successRate: this.calculateSuccessRate(),
      // ...
    };
  }

  // Real-time metrics for frontend
  getRealtimeMetrics(): RealtimeMetrics {
    return {
      opsPerSecond: this.calculateOPS(),
      memoryUsage: process.memoryUsage(),
      activeDisks: this.getActiveDiskCount(),
      // ...
    };
  }
}
```

---

## 🧪 TESTING REQUIREMENTS

### Test Coverage Goals

**Unit Tests:** 80%+ coverage
- Every service method
- Every error case
- Every edge case

**Integration Tests:** Key workflows
- Create disk → Load → Mount → Edit → Save
- Multi-disk management
- Concurrent operations
- Error recovery

**Performance Tests:**
- 1000 nodes: Load time <1s
- API response: <50ms average
- Signal streaming: 1000+/sec
- Memory: <200MB for 10 disks

### Test Framework

Use existing pattern from FXD tests:
```typescript
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";

describe("DiskService", () => {
  let service: DiskService;

  beforeEach(() => {
    service = new DiskService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it("should list disks", async () => {
    const disks = await service.list();
    assertExists(disks);
    assertEquals(Array.isArray(disks), true);
  });

  // ... more tests
});
```

---

## 📊 API ENDPOINT IMPLEMENTATION PRIORITY

### Tier 1: Critical (Implement First)

**Must work for MVP:**
1. GET /api/disks - List disks
2. POST /api/disks - Create disk
3. POST /api/disks/:id/mount - Mount disk
4. POST /api/disks/:id/unmount - Unmount disk
5. GET /api/disks/:id/nodes - Get nodes
6. GET /api/disks/:id/stats - Get statistics
7. WS /api/disks/:id/signals - Signal stream

### Tier 2: Important (Implement Second)

8. GET /api/disks/:id/files - List files
9. GET /api/disks/:id/files/:path - Read file
10. PUT /api/disks/:id/files/:path - Write file
11. POST /api/disks/:id/bindings - Create binding
12. GET /api/disks/:id/bindings - List bindings

### Tier 3: Nice to Have (If Time)

13-40. All remaining endpoints

---

## 🔒 SECURITY REQUIREMENTS

### Input Validation

```typescript
import { z } from 'zod';

const CreateDiskSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string().optional(),
  format: z.enum(['sqlite', 'wal']).optional(),
  autoImport: z.boolean().optional(),
});

// Validate all inputs
const validated = CreateDiskSchema.parse(request.body);
```

### Path Safety

```typescript
// Prevent directory traversal
function sanitizePath(userPath: string): string {
  const normalized = path.normalize(userPath);
  if (normalized.includes('..')) {
    throw new Error('Invalid path');
  }
  return normalized;
}
```

### Rate Limiting

```typescript
// Limit API calls
import { rateLimit } from 'hono-rate-limiter';

app.use('/api/*', rateLimit({
  windowMs: 60000,  // 1 minute
  max: 100,         // 100 requests per minute
}));
```

---

## 📝 REFLECTION QUESTIONS (Answer in Report)

1. **Architecture:** How did you structure the dual-mode backend (IPC + API)?
2. **Shared Logic:** What percentage of code is shared between Electron and Web?
3. **Performance:** What's the slowest endpoint and how did you optimize it?
4. **Error Handling:** How do you handle disk corruption or missing files?
5. **Concurrency:** How do you prevent race conditions with multiple clients?
6. **Testing:** What's your test coverage and what gaps remain?
7. **Security:** What security measures did you implement?
8. **Integration:** How easy is it for the integration agent to wire up the UI?

---

## 📋 SUCCESS CRITERIA

**All must pass:**
- ✅ 60+ tests written (unit + integration)
- ✅ 80%+ test coverage
- ✅ All Tier 1 endpoints working
- ✅ All Tier 2 endpoints working
- ✅ IPC bridge complete
- ✅ WebSocket signal streaming works
- ✅ API documentation complete
- ✅ Error handling comprehensive
- ✅ Performance targets met
- ✅ Integration with existing FXD modules verified
- ✅ Reflection questions answered
- ✅ Ready for UI integration

---

## 🚀 DEPLOYMENT INSTRUCTION

**READ FIRST:**
- This spec (complete understanding)
- `IDEAL-APP-VISION.md` (understand the UI you're supporting)
- Existing FXD modules (know what to integrate)

**IMPLEMENT:**
- Start with service layer (shared logic)
- Then IPC handlers
- Then API endpoints
- Then WebSocket
- Then tests
- Then docs

**TEST:**
- Run all tests
- Manual testing with curl/Postman
- Verify integration points

**DOCUMENT:**
- Every endpoint
- Every type
- Every error
- Examples for integration agent

**REFLECT:**
- Answer all 8 questions
- Identify challenges
- Suggest improvements

**REPORT:**
```markdown
# Backend Implementation Report

## Executive Summary
[Your summary]

## Deliverables
[List all files with line counts]

## Test Results
[X/Y tests passing]

## API Endpoints Implemented
[List all 40+ with status]

## Integration Points
[How UI agent should wire this up]

## Reflection
[Answer all 8 questions]

## Performance
[Benchmarks]

## Known Issues
[Any limitations]

## Handoff
[Instructions for integration agent]
```

---

**You have 1M context and 1 hour. Build the complete backend!** 🔧

**Deploy now!**
