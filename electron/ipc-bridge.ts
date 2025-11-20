/**
 * FXD Electron - IPC Bridge
 *
 * Secure IPC communication layer between main and renderer processes
 * Provides typed, validated message passing with error handling
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { fxdApp } from './main';

// ============================================================================
// Type Definitions
// ============================================================================

export interface IPCMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DiskInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  nodeCount: number;
  mounted: boolean;
  lastModified: number;
}

export interface NodeData {
  __id: string;
  __parent_id: string | null;
  __type: string | null;
  __value: any;
  __nodes: Record<string, any>;
  __proto: string[];
}

export interface FileOpenRequest {
  path: string;
}

export interface FileSaveRequest {
  path: string;
  data: any;
}

export interface DiskMountRequest {
  diskId: string;
  mountPoint?: string;
}

export interface DiskUnmountRequest {
  diskId: string;
}

export interface NodeQueryRequest {
  diskId: string;
  selector: string;
}

export interface NodeUpdateRequest {
  diskId: string;
  nodeId: string;
  updates: Partial<NodeData>;
}

// ============================================================================
// IPC Bridge Class
// ============================================================================

export class IPCBridge {
  private handlers: Map<string, (payload: any) => Promise<IPCResponse>>;
  private disks: Map<string, DiskInfo>;

  constructor() {
    this.handlers = new Map();
    this.disks = new Map();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  public initialize(): void {
    console.log('[IPC Bridge] Initializing...');

    this.registerHandlers();
    this.setupIPCHandlers();

    console.log('[IPC Bridge] Ready');
  }

  private registerHandlers(): void {
    // File operations
    this.handlers.set('file:open', this.handleFileOpen.bind(this));
    this.handlers.set('file:save', this.handleFileSave.bind(this));
    this.handlers.set('file:recent', this.handleFileRecent.bind(this));

    // Disk operations
    this.handlers.set('disk:list', this.handleDiskList.bind(this));
    this.handlers.set('disk:mount', this.handleDiskMount.bind(this));
    this.handlers.set('disk:unmount', this.handleDiskUnmount.bind(this));
    this.handlers.set('disk:stats', this.handleDiskStats.bind(this));

    // Node operations
    this.handlers.set('node:query', this.handleNodeQuery.bind(this));
    this.handlers.set('node:update', this.handleNodeUpdate.bind(this));
    this.handlers.set('node:create', this.handleNodeCreate.bind(this));
    this.handlers.set('node:delete', this.handleNodeDelete.bind(this));

    // System operations
    this.handlers.set('system:info', this.handleSystemInfo.bind(this));
    this.handlers.set('system:config', this.handleSystemConfig.bind(this));
    this.handlers.set('system:update-config', this.handleSystemUpdateConfig.bind(this));
  }

  private setupIPCHandlers(): void {
    // Generic handler for all IPC messages
    ipcMain.handle('ipc-message', async (event, message: IPCMessage) => {
      try {
        console.log(`[IPC] ${message.type}`, message.payload);

        const handler = this.handlers.get(message.type);
        if (!handler) {
          return {
            success: false,
            error: `Unknown message type: ${message.type}`,
          };
        }

        const response = await handler(message.payload);
        return response;
      } catch (error: any) {
        console.error(`[IPC] Error handling ${message.type}:`, error);
        return {
          success: false,
          error: error.message || 'Unknown error',
        };
      }
    });
  }

  // --------------------------------------------------------------------------
  // File Handlers
  // --------------------------------------------------------------------------

  private async handleFileOpen(payload: FileOpenRequest): Promise<IPCResponse> {
    try {
      const { path: filePath } = payload;

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Add to disks
      const diskInfo: DiskInfo = {
        id: this.generateDiskId(),
        name: path.basename(filePath, '.fxd'),
        path: filePath,
        size: Buffer.byteLength(content),
        nodeCount: this.countNodes(data),
        mounted: false,
        lastModified: fs.statSync(filePath).mtime.getTime(),
      };

      this.disks.set(diskInfo.id, diskInfo);

      return {
        success: true,
        data: {
          disk: diskInfo,
          content: data,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleFileSave(payload: FileSaveRequest): Promise<IPCResponse> {
    try {
      const { path: filePath, data } = payload;

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');

      return {
        success: true,
        data: {
          path: filePath,
          size: Buffer.byteLength(content),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleFileRecent(payload: any): Promise<IPCResponse> {
    try {
      const config = fxdApp.getConfig();
      return {
        success: true,
        data: config.recentFiles,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Disk Handlers
  // --------------------------------------------------------------------------

  private async handleDiskList(payload: any): Promise<IPCResponse> {
    try {
      const disks = Array.from(this.disks.values());
      return {
        success: true,
        data: disks,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleDiskMount(payload: DiskMountRequest): Promise<IPCResponse> {
    try {
      const { diskId, mountPoint } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // TODO: Implement actual mounting logic with fx-ramdisk
      disk.mounted = true;

      return {
        success: true,
        data: disk,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleDiskUnmount(payload: DiskUnmountRequest): Promise<IPCResponse> {
    try {
      const { diskId } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // TODO: Implement actual unmounting logic with fx-ramdisk
      disk.mounted = false;

      return {
        success: true,
        data: disk,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleDiskStats(payload: { diskId: string }): Promise<IPCResponse> {
    try {
      const { diskId } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // Get file stats
      const stats = fs.statSync(disk.path);

      return {
        success: true,
        data: {
          ...disk,
          size: stats.size,
          lastModified: stats.mtime.getTime(),
          lastAccessed: stats.atime.getTime(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Node Handlers
  // --------------------------------------------------------------------------

  private async handleNodeQuery(payload: NodeQueryRequest): Promise<IPCResponse> {
    try {
      const { diskId, selector } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // Load disk data
      const content = fs.readFileSync(disk.path, 'utf-8');
      const data = JSON.parse(content);

      // TODO: Implement CSS-style selector query
      // For now, return all nodes
      const nodes = this.extractNodes(data);

      return {
        success: true,
        data: nodes,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleNodeUpdate(payload: NodeUpdateRequest): Promise<IPCResponse> {
    try {
      const { diskId, nodeId, updates } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // Load disk data
      const content = fs.readFileSync(disk.path, 'utf-8');
      const data = JSON.parse(content);

      // Find and update node
      const node = this.findNode(data, nodeId);
      if (!node) {
        throw new Error('Node not found');
      }

      Object.assign(node, updates);

      // Save back to disk
      fs.writeFileSync(disk.path, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        data: node,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleNodeCreate(payload: any): Promise<IPCResponse> {
    try {
      const { diskId, parentId, nodeData } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // Load disk data
      const content = fs.readFileSync(disk.path, 'utf-8');
      const data = JSON.parse(content);

      // Find parent node
      const parent = this.findNode(data, parentId) || data;

      // Create new node
      const newNode: NodeData = {
        __id: this.generateNodeId(),
        __parent_id: parentId,
        __type: nodeData.__type || null,
        __value: nodeData.__value || null,
        __nodes: {},
        __proto: nodeData.__proto || [],
      };

      // Add to parent
      if (!parent.__nodes) {
        parent.__nodes = {};
      }
      parent.__nodes[newNode.__id] = newNode;

      // Save back to disk
      fs.writeFileSync(disk.path, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        data: newNode,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleNodeDelete(payload: any): Promise<IPCResponse> {
    try {
      const { diskId, nodeId } = payload;
      const disk = this.disks.get(diskId);

      if (!disk) {
        throw new Error('Disk not found');
      }

      // Load disk data
      const content = fs.readFileSync(disk.path, 'utf-8');
      const data = JSON.parse(content);

      // Find and delete node
      const deleted = this.deleteNode(data, nodeId);
      if (!deleted) {
        throw new Error('Node not found');
      }

      // Save back to disk
      fs.writeFileSync(disk.path, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        data: { nodeId },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // --------------------------------------------------------------------------
  // System Handlers
  // --------------------------------------------------------------------------

  private async handleSystemInfo(payload: any): Promise<IPCResponse> {
    try {
      return {
        success: true,
        data: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          chromeVersion: process.versions.chrome,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleSystemConfig(payload: any): Promise<IPCResponse> {
    try {
      const config = fxdApp.getConfig();
      return {
        success: true,
        data: config,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleSystemUpdateConfig(payload: any): Promise<IPCResponse> {
    try {
      fxdApp.updateConfig(payload);
      return {
        success: true,
        data: fxdApp.getConfig(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private generateDiskId(): string {
    return `disk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private countNodes(data: any): number {
    let count = 0;
    const traverse = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (obj.__id) count++;
        if (obj.__nodes) {
          Object.values(obj.__nodes).forEach(traverse);
        }
      }
    };
    traverse(data);
    return count;
  }

  private extractNodes(data: any): NodeData[] {
    const nodes: NodeData[] = [];
    const traverse = (obj: any) => {
      if (obj && typeof obj === 'object' && obj.__id) {
        nodes.push(obj);
        if (obj.__nodes) {
          Object.values(obj.__nodes).forEach(traverse);
        }
      }
    };
    traverse(data);
    return nodes;
  }

  private findNode(data: any, nodeId: string): NodeData | null {
    const traverse = (obj: any): NodeData | null => {
      if (obj && typeof obj === 'object') {
        if (obj.__id === nodeId) return obj;
        if (obj.__nodes) {
          for (const child of Object.values(obj.__nodes)) {
            const found = traverse(child);
            if (found) return found;
          }
        }
      }
      return null;
    };
    return traverse(data);
  }

  private deleteNode(data: any, nodeId: string): boolean {
    const traverse = (obj: any): boolean => {
      if (obj && typeof obj === 'object' && obj.__nodes) {
        for (const key of Object.keys(obj.__nodes)) {
          if (obj.__nodes[key].__id === nodeId) {
            delete obj.__nodes[key];
            return true;
          }
          if (traverse(obj.__nodes[key])) {
            return true;
          }
        }
      }
      return false;
    };
    return traverse(data);
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  public broadcast(type: string, payload: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('broadcast', { type, payload });
    });
  }
}
