/**
 * @file fx-vfs.ts
 * @version 1.0.0
 * @description Virtual File System (VFS) integration for FXD
 *
 * Provides a layer between FXD's node tree and the operating system's
 * file system, enabling bidirectional synchronization and virtual mounting.
 *
 * Features:
 * - Map FXD nodes to virtual files
 * - Real-time sync between FXD and file system
 * - File watchers for external changes
 * - Virtual directory structure
 * - FUSE/WinFsp integration
 * - Permission management
 * - Metadata preservation
 */

import { FXCore, FXNodeProxy, FXNode } from "../fxn.ts";
import { RAMDiskManager, RAMDiskConfig } from "./fx-ramdisk.ts";

/**
 * Virtual file representation
 */
export interface VirtualFile {
  path: string;
  name: string;
  nodePath: string;
  content: string;
  size: number;
  modified: number;
  created: number;
  type: "file" | "directory";
  language?: string;
  readonly: boolean;
}

/**
 * VFS configuration
 */
export interface VFSConfig {
  /** Root directory for virtual files */
  rootDir: string;

  /** Enable file watching */
  watch: boolean;

  /** Watch interval in milliseconds */
  watchIntervalMs: number;

  /** Auto-save changes to FXD */
  autoSave: boolean;

  /** Auto-save debounce in milliseconds */
  autoSaveDebounceMs: number;

  /** Virtual file extensions */
  extensions: Record<string, string>;

  /** Exclude patterns */
  exclude: string[];

  /** Include hidden files */
  includeHidden: boolean;
}

/**
 * File change event
 */
export interface FileChangeEvent {
  type: "create" | "modify" | "delete" | "rename";
  path: string;
  oldPath?: string;
  timestamp: number;
}

/**
 * VFS statistics
 */
export interface VFSStats {
  totalFiles: number;
  totalSize: number;
  syncedFiles: number;
  pendingChanges: number;
  lastSync: number;
  watchers: number;
}

/**
 * Virtual File System Manager
 */
export class VFSManager {
  private fx: FXCore;
  private config: VFSConfig;
  private ramdiskManager?: RAMDiskManager;
  private watchers: Map<string, Deno.FsWatcher>;
  private pendingChanges: Map<string, FileChangeEvent>;
  private saveTimers: Map<string, number>;
  private virtualFiles: Map<string, VirtualFile>;

  constructor(fx: FXCore, config?: Partial<VFSConfig>) {
    this.fx = fx;
    this.config = {
      rootDir: "",
      watch: true,
      watchIntervalMs: 1000,
      autoSave: true,
      autoSaveDebounceMs: 500,
      extensions: {
        javascript: "js",
        typescript: "ts",
        python: "py",
        rust: "rs",
        go: "go",
        markdown: "md",
        json: "json",
        text: "txt",
      },
      exclude: ["\\.git", "node_modules", "\\.DS_Store", "Thumbs\\.db"],
      includeHidden: false,
      ...config,
    };

    this.watchers = new Map();
    this.pendingChanges = new Map();
    this.saveTimers = new Map();
    this.virtualFiles = new Map();
  }

  /**
   * Initialize VFS manager
   */
  async initialize(ramdiskManager?: RAMDiskManager): Promise<void> {
    this.ramdiskManager = ramdiskManager;

    // Load VFS configuration from FXD
    const vfsNode = this.fx.proxy("system.vfs");
    const vfsData = vfsNode.val();

    if (vfsData && typeof vfsData === 'object') {
      this.config = { ...this.config, ...vfsData };
    }

    // Initialize virtual file cache
    await this._buildVirtualFileCache();
  }

  /**
   * Mount a directory as virtual file system
   */
  async mount(directory: string, options?: {
    ramdiskId?: string;
    watch?: boolean;
  }): Promise<void> {
    // Verify directory exists
    try {
      const stat = await Deno.stat(directory);
      if (!stat.isDirectory) {
        throw new Error(`Not a directory: ${directory}`);
      }
    } catch (error) {
      throw new Error(`Cannot access directory: ${error.message}`);
    }

    // Set root directory
    this.config.rootDir = directory;

    // Start file watcher if enabled
    if (options?.watch !== false && this.config.watch) {
      await this._startWatcher(directory);
    }

    // Initial sync from directory to FXD
    await this.syncFromDirectory(directory);

    // Store mount configuration
    this.fx.proxy("system.vfs.mounted").val({
      directory,
      ramdiskId: options?.ramdiskId,
      mountedAt: Date.now(),
      watching: this.config.watch,
    });
  }

  /**
   * Unmount the virtual file system
   */
  async unmount(): Promise<void> {
    // Stop all watchers
    this._stopAllWatchers();

    // Save pending changes
    await this._flushPendingChanges();

    // Clear root directory
    this.config.rootDir = "";

    // Clear mount configuration
    this.fx.proxy("system.vfs.mounted").val(undefined);

    // Clear caches
    this.virtualFiles.clear();
    this.pendingChanges.clear();
  }

  /**
   * Sync directory contents to FXD
   */
  async syncFromDirectory(directory: string, options?: {
    overwrite?: boolean;
    recursive?: boolean;
  }): Promise<{ imported: number; skipped: number; errors: number }> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    try {
      for await (const entry of Deno.readDir(directory)) {
        // Check exclusions
        if (this._shouldExclude(entry.name)) {
          skipped++;
          continue;
        }

        // Skip hidden files unless included
        if (!this.config.includeHidden && entry.name.startsWith('.')) {
          skipped++;
          continue;
        }

        const fullPath = `${directory}/${entry.name}`;

        if (entry.isFile) {
          try {
            await this._importFile(fullPath, options?.overwrite);
            imported++;
          } catch (error) {
            console.error(`Failed to import ${entry.name}:`, error);
            errors++;
          }
        } else if (entry.isDirectory && options?.recursive !== false) {
          // Recursively import subdirectory
          const result = await this.syncFromDirectory(fullPath, options);
          imported += result.imported;
          skipped += result.skipped;
          errors += result.errors;
        }
      }

      // Update last sync time
      this.fx.proxy("system.vfs.lastSync").val(Date.now());
    } catch (error) {
      throw new Error(`Sync from directory failed: ${error.message}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Sync FXD contents to directory
   */
  async syncToDirectory(directory: string, options?: {
    filter?: (node: FXNode) => boolean;
  }): Promise<{ exported: number; skipped: number; errors: number }> {
    let exported = 0;
    let skipped = 0;
    let errors = 0;

    // Ensure directory exists
    try {
      await Deno.mkdir(directory, { recursive: true });
    } catch {
      // Already exists
    }

    // Get all snippets
    const snippets = this.fx.proxy("snippets").val() || {};

    for (const [id, snippet] of Object.entries(snippets)) {
      if (!snippet || typeof snippet !== 'object') {
        continue;
      }

      const s = snippet as any;

      // Apply filter if specified
      if (options?.filter) {
        const node = this.fx.proxy(`snippets.${id}`).node();
        if (!options.filter(node)) {
          skipped++;
          continue;
        }
      }

      try {
        const ext = this._getFileExtension(s.language || 'text');
        const filename = `${id}.${ext}`;
        const filePath = `${directory}/${filename}`;

        await Deno.writeTextFile(filePath, s.content || '');

        // Update virtual file cache
        this._cacheVirtualFile(filePath, id, s);

        exported++;
      } catch (error) {
        console.error(`Failed to export ${id}:`, error);
        errors++;
      }
    }

    return { exported, skipped, errors };
  }

  /**
   * Get virtual file representation
   */
  getVirtualFile(path: string): VirtualFile | undefined {
    return this.virtualFiles.get(path);
  }

  /**
   * List all virtual files
   */
  listVirtualFiles(): VirtualFile[] {
    return Array.from(this.virtualFiles.values());
  }

  /**
   * Get VFS statistics
   */
  getStats(): VFSStats {
    let totalSize = 0;

    for (const file of this.virtualFiles.values()) {
      totalSize += file.size;
    }

    return {
      totalFiles: this.virtualFiles.size,
      totalSize,
      syncedFiles: this.virtualFiles.size,
      pendingChanges: this.pendingChanges.size,
      lastSync: this.fx.proxy("system.vfs.lastSync").val() || 0,
      watchers: this.watchers.size,
    };
  }

  /**
   * Watch file for changes
   */
  async watchFile(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }

    try {
      const watcher = Deno.watchFs(filePath);

      this.watchers.set(filePath, watcher);

      // Handle file changes
      (async () => {
        try {
          for await (const event of watcher) {
            await this._handleFileChange(event, filePath);
          }
        } catch (error) {
          console.error(`Watcher error for ${filePath}:`, error);
        }
      })();
    } catch (error) {
      console.error(`Failed to watch ${filePath}:`, error);
    }
  }

  /**
   * Stop watching file
   */
  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);

    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  /**
   * Create virtual file from FXD node
   */
  async createVirtualFile(nodePath: string, filePath: string): Promise<void> {
    const node = this.fx.proxy(nodePath);
    const value = node.val();

    if (!value || typeof value !== 'object') {
      throw new Error(`Invalid node for virtual file: ${nodePath}`);
    }

    const content = value.content || '';
    const language = value.language || 'text';

    // Write file
    await Deno.writeTextFile(filePath, content);

    // Cache virtual file
    this._cacheVirtualFile(filePath, nodePath, value);

    // Start watching
    if (this.config.watch) {
      await this.watchFile(filePath);
    }
  }

  /**
   * Delete virtual file
   */
  async deleteVirtualFile(filePath: string): Promise<void> {
    // Stop watching
    this.unwatchFile(filePath);

    // Delete file
    try {
      await Deno.remove(filePath);
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error);
    }

    // Remove from cache
    this.virtualFiles.delete(filePath);
  }

  /**
   * Update virtual file from FXD node
   */
  async updateVirtualFile(nodePath: string): Promise<void> {
    // Find virtual file for this node
    let filePath: string | undefined;

    for (const [path, file] of this.virtualFiles.entries()) {
      if (file.nodePath === nodePath) {
        filePath = path;
        break;
      }
    }

    if (!filePath) {
      return; // No virtual file for this node
    }

    const node = this.fx.proxy(nodePath);
    const value = node.val();

    if (!value || typeof value !== 'object') {
      return;
    }

    const content = value.content || '';

    // Write file
    try {
      await Deno.writeTextFile(filePath, content);

      // Update cache
      this._cacheVirtualFile(filePath, nodePath, value);
    } catch (error) {
      console.error(`Failed to update ${filePath}:`, error);
    }
  }

  // Private helper methods

  private async _buildVirtualFileCache(): Promise<void> {
    if (!this.config.rootDir) {
      return;
    }

    try {
      for await (const entry of Deno.readDir(this.config.rootDir)) {
        if (entry.isFile && !this._shouldExclude(entry.name)) {
          const filePath = `${this.config.rootDir}/${entry.name}`;

          try {
            const content = await Deno.readTextFile(filePath);
            const stat = await Deno.stat(filePath);

            const snippetId = entry.name.replace(/\.[^.]+$/, '');
            const language = this._detectLanguage(entry.name);

            const virtualFile: VirtualFile = {
              path: filePath,
              name: entry.name,
              nodePath: `snippets.${snippetId}`,
              content,
              size: stat.size,
              modified: stat.mtime?.getTime() || Date.now(),
              created: stat.birthtime?.getTime() || Date.now(),
              type: "file",
              language,
              readonly: false,
            };

            this.virtualFiles.set(filePath, virtualFile);
          } catch (error) {
            console.error(`Failed to cache ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to build virtual file cache:", error);
    }
  }

  private async _startWatcher(directory: string): Promise<void> {
    if (this.watchers.has(directory)) {
      return; // Already watching
    }

    try {
      const watcher = Deno.watchFs(directory);

      this.watchers.set(directory, watcher);

      // Handle directory changes
      (async () => {
        try {
          for await (const event of watcher) {
            for (const path of event.paths) {
              await this._handleFileChange(event, path);
            }
          }
        } catch (error) {
          console.error(`Watcher error for ${directory}:`, error);
        }
      })();
    } catch (error) {
      console.error(`Failed to watch ${directory}:`, error);
    }
  }

  private _stopAllWatchers(): void {
    for (const [path, watcher] of this.watchers.entries()) {
      watcher.close();
    }

    this.watchers.clear();
  }

  private async _handleFileChange(event: Deno.FsEvent, filePath: string): Promise<void> {
    // Ignore if excluded
    const filename = filePath.split(/[/\\]/).pop() || '';
    if (this._shouldExclude(filename)) {
      return;
    }

    // Create change event
    const changeEvent: FileChangeEvent = {
      type: event.kind === "create" ? "create" :
            event.kind === "modify" ? "modify" :
            event.kind === "remove" ? "delete" : "modify",
      path: filePath,
      timestamp: Date.now(),
    };

    // Store pending change
    this.pendingChanges.set(filePath, changeEvent);

    // Debounce auto-save
    if (this.config.autoSave) {
      this._scheduleAutoSave(filePath);
    }
  }

  private _scheduleAutoSave(filePath: string): void {
    // Clear existing timer
    const existingTimer = this.saveTimers.get(filePath);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Schedule new save
    const timer = setTimeout(async () => {
      await this._saveFileToFXD(filePath);
      this.saveTimers.delete(filePath);
    }, this.config.autoSaveDebounceMs);

    this.saveTimers.set(filePath, timer as any);
  }

  private async _saveFileToFXD(filePath: string): Promise<void> {
    const changeEvent = this.pendingChanges.get(filePath);

    if (!changeEvent) {
      return;
    }

    try {
      if (changeEvent.type === "delete") {
        // Remove from FXD
        const virtualFile = this.virtualFiles.get(filePath);
        if (virtualFile) {
          this.fx.proxy(virtualFile.nodePath).val(undefined);
          this.virtualFiles.delete(filePath);
        }
      } else {
        // Update or create in FXD
        await this._importFile(filePath, true);
      }

      // Remove from pending changes
      this.pendingChanges.delete(filePath);
    } catch (error) {
      console.error(`Failed to save ${filePath} to FXD:`, error);
    }
  }

  private async _flushPendingChanges(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const filePath of this.pendingChanges.keys()) {
      promises.push(this._saveFileToFXD(filePath));
    }

    await Promise.all(promises);
  }

  private async _importFile(filePath: string, overwrite?: boolean): Promise<void> {
    const filename = filePath.split(/[/\\]/).pop() || '';
    const snippetId = filename.replace(/\.[^.]+$/, '');

    // Check if snippet exists
    const existingSnippet = this.fx.proxy(`snippets.${snippetId}`).val();

    if (existingSnippet && !overwrite) {
      return; // Skip existing
    }

    // Read file
    const content = await Deno.readTextFile(filePath);
    const stat = await Deno.stat(filePath);
    const language = this._detectLanguage(filename);

    // Import as snippet
    this.fx.proxy(`snippets.${snippetId}`).val({
      id: snippetId,
      name: filename,
      content,
      language,
      created: stat.birthtime?.getTime() || Date.now(),
      modified: stat.mtime?.getTime() || Date.now(),
      source: 'vfs',
      vfsPath: filePath,
    });

    // Cache virtual file
    this._cacheVirtualFile(filePath, `snippets.${snippetId}`, {
      content,
      language,
    });
  }

  private _cacheVirtualFile(filePath: string, nodePath: string, data: any): void {
    const filename = filePath.split(/[/\\]/).pop() || '';

    const virtualFile: VirtualFile = {
      path: filePath,
      name: filename,
      nodePath,
      content: data.content || '',
      size: data.content?.length || 0,
      modified: data.modified || Date.now(),
      created: data.created || Date.now(),
      type: "file",
      language: data.language || this._detectLanguage(filename),
      readonly: false,
    };

    this.virtualFiles.set(filePath, virtualFile);
  }

  private _shouldExclude(filename: string): boolean {
    for (const pattern of this.config.exclude) {
      const regex = new RegExp(pattern);
      if (regex.test(filename)) {
        return true;
      }
    }

    return false;
  }

  private _detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';

    const langMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'txt': 'text',
    };

    return langMap[ext] || 'text';
  }

  private _getFileExtension(language: string): string {
    return this.config.extensions[language] || 'txt';
  }
}

/**
 * Create and initialize VFS manager
 */
export function createVFSManager(fx: FXCore, config?: Partial<VFSConfig>): VFSManager {
  return new VFSManager(fx, config);
}
