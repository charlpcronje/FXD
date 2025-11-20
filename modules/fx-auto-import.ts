/**
 * @file fx-auto-import.ts
 * @version 1.0.0
 * @description Auto-import directory scanner for FXD
 *
 * Automatically imports code files from directories into FXD snippets,
 * with intelligent parsing, language detection, and metadata extraction.
 *
 * Features:
 * - Recursive directory scanning
 * - Language detection
 * - Function/class extraction
 * - Metadata preservation
 * - Git integration
 * - Watch mode
 * - Incremental updates
 * - Conflict resolution
 */

import { FXCore, FXNodeProxy } from "../fxn.ts";

/**
 * Import configuration
 */
export interface AutoImportConfig {
  /** Base directory to scan */
  baseDir: string;

  /** Scan recursively */
  recursive: boolean;

  /** File patterns to include */
  include: string[];

  /** File patterns to exclude */
  exclude: string[];

  /** Extract functions/classes */
  extractSymbols: boolean;

  /** Preserve file structure */
  preserveStructure: boolean;

  /** Overwrite existing snippets */
  overwrite: boolean;

  /** Watch for changes */
  watch: boolean;

  /** Watch debounce in milliseconds */
  watchDebounceMs: number;

  /** Maximum file size in bytes */
  maxFileSizeBytes: number;

  /** Extract comments as metadata */
  extractComments: boolean;

  /** Include hidden files */
  includeHidden: boolean;

  /** Git-aware scanning */
  gitAware: boolean;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  files: string[];
  snippets: string[];
  duration: number;
  errorDetails?: Array<{ file: string; error: string }>;
}

/**
 * File metadata
 */
export interface FileMetadata {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  created: number;
  modified: number;
  lines: number;
  symbols?: SymbolInfo[];
  comments?: CommentInfo[];
  gitInfo?: GitFileInfo;
}

/**
 * Symbol information (function, class, etc.)
 */
export interface SymbolInfo {
  type: "function" | "class" | "interface" | "type" | "const" | "let" | "var";
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  params?: string[];
  returnType?: string;
  docComment?: string;
  exported?: boolean;
  async?: boolean;
}

/**
 * Comment information
 */
export interface CommentInfo {
  type: "line" | "block" | "doc";
  content: string;
  line: number;
}

/**
 * Git file information
 */
export interface GitFileInfo {
  tracked: boolean;
  modified: boolean;
  branch: string;
  lastCommit?: string;
  author?: string;
}

/**
 * Auto-import manager
 */
export class AutoImportManager {
  private fx: FXCore;
  private config: AutoImportConfig;
  private watchers: Map<string, Deno.FsWatcher>;
  private debounceTimers: Map<string, number>;
  private importedFiles: Set<string>;

  constructor(fx: FXCore, config?: Partial<AutoImportConfig>) {
    this.fx = fx;
    this.config = {
      baseDir: "",
      recursive: true,
      include: ["*.js", "*.ts", "*.jsx", "*.tsx", "*.py", "*.rs", "*.go", "*.java"],
      exclude: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.test.*", "*.spec.*"],
      extractSymbols: true,
      preserveStructure: false,
      overwrite: false,
      watch: false,
      watchDebounceMs: 500,
      maxFileSizeBytes: 1024 * 1024, // 1MB
      extractComments: true,
      includeHidden: false,
      gitAware: true,
      ...config,
    };

    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.importedFiles = new Set();
  }

  /**
   * Scan and import directory
   */
  async importDirectory(directory?: string): Promise<ImportResult> {
    const startTime = Date.now();
    const baseDir = directory || this.config.baseDir;

    if (!baseDir) {
      throw new Error("Base directory not specified");
    }

    // Verify directory exists
    try {
      const stat = await Deno.stat(baseDir);
      if (!stat.isDirectory) {
        throw new Error(`Not a directory: ${baseDir}`);
      }
    } catch (error) {
      throw new Error(`Cannot access directory: ${error.message}`);
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
      files: [],
      snippets: [],
      duration: 0,
      errorDetails: [],
    };

    // Scan directory
    await this._scanDirectory(baseDir, baseDir, result);

    // Calculate duration
    result.duration = Date.now() - startTime;

    // Start watching if enabled
    if (this.config.watch) {
      await this._startWatching(baseDir);
    }

    // Store import result
    this.fx.proxy("system.autoImport.lastResult").val(result);

    return result;
  }

  /**
   * Import single file
   */
  async importFile(filePath: string, options?: {
    overwrite?: boolean;
    extractSymbols?: boolean;
  }): Promise<{ snippetIds: string[]; symbols: number }> {
    // Extract metadata
    const metadata = await this._extractFileMetadata(filePath);

    if (!metadata) {
      throw new Error(`Failed to extract metadata from ${filePath}`);
    }

    const snippetIds: string[] = [];
    let symbolCount = 0;

    // Check if we should extract symbols
    const extractSymbols = options?.extractSymbols ?? this.config.extractSymbols;

    if (extractSymbols && metadata.symbols && metadata.symbols.length > 0) {
      // Import each symbol as a separate snippet
      for (const symbol of metadata.symbols) {
        const snippetId = this._generateSymbolId(metadata, symbol);

        // Check if exists
        const existing = this.fx.proxy(`snippets.${snippetId}`).val();

        if (existing && !(options?.overwrite ?? this.config.overwrite)) {
          continue; // Skip existing
        }

        // Create snippet
        this.fx.proxy(`snippets.${snippetId}`).val({
          id: snippetId,
          name: `${metadata.name}:${symbol.name}`,
          content: symbol.content,
          language: metadata.language,
          created: metadata.created,
          modified: metadata.modified,
          source: 'auto-import',
          sourcePath: filePath,
          symbolType: symbol.type,
          symbolName: symbol.name,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          docComment: symbol.docComment,
          exported: symbol.exported,
          async: symbol.async,
        });

        snippetIds.push(snippetId);
        symbolCount++;
      }
    } else {
      // Import entire file as one snippet
      const snippetId = this._generateFileId(metadata);

      // Check if exists
      const existing = this.fx.proxy(`snippets.${snippetId}`).val();

      if (!existing || (options?.overwrite ?? this.config.overwrite)) {
        const content = await Deno.readTextFile(filePath);

        this.fx.proxy(`snippets.${snippetId}`).val({
          id: snippetId,
          name: metadata.name,
          content,
          language: metadata.language,
          created: metadata.created,
          modified: metadata.modified,
          source: 'auto-import',
          sourcePath: filePath,
          relativePath: metadata.relativePath,
          size: metadata.size,
          lines: metadata.lines,
          comments: metadata.comments,
          gitInfo: metadata.gitInfo,
        });

        snippetIds.push(snippetId);
      }
    }

    // Mark as imported
    this.importedFiles.add(filePath);

    return { snippetIds, symbols: symbolCount };
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    for (const [path, watcher] of this.watchers.entries()) {
      watcher.close();
    }

    this.watchers.clear();

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    this.debounceTimers.clear();
  }

  /**
   * Get imported files
   */
  getImportedFiles(): string[] {
    return Array.from(this.importedFiles);
  }

  /**
   * Get configuration
   */
  getConfig(): AutoImportConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoImportConfig>): void {
    this.config = { ...this.config, ...config };

    // Persist configuration
    this.fx.proxy("system.autoImport.config").val(this.config);
  }

  // Private helper methods

  private async _scanDirectory(
    dir: string,
    baseDir: string,
    result: ImportResult
  ): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        // Skip hidden files unless included
        if (!this.config.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = `${dir}/${entry.name}`;
        const relativePath = fullPath.substring(baseDir.length + 1);

        // Check exclusions
        if (this._shouldExclude(relativePath)) {
          result.skipped++;
          continue;
        }

        if (entry.isFile) {
          // Check if file matches include patterns
          if (!this._shouldInclude(relativePath)) {
            result.skipped++;
            continue;
          }

          // Import file
          try {
            const importResult = await this.importFile(fullPath);

            result.imported++;
            result.files.push(fullPath);
            result.snippets.push(...importResult.snippetIds);
          } catch (error) {
            result.errors++;
            result.errorDetails?.push({
              file: fullPath,
              error: error.message,
            });
          }
        } else if (entry.isDirectory && this.config.recursive) {
          // Recursively scan subdirectory
          await this._scanDirectory(fullPath, baseDir, result);
        }
      }
    } catch (error) {
      result.errors++;
      result.errorDetails?.push({
        file: dir,
        error: `Directory scan failed: ${error.message}`,
      });
    }
  }

  private async _startWatching(directory: string): Promise<void> {
    if (this.watchers.has(directory)) {
      return; // Already watching
    }

    try {
      const watcher = Deno.watchFs(directory, { recursive: this.config.recursive });

      this.watchers.set(directory, watcher);

      // Handle file changes
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

  private async _handleFileChange(event: Deno.FsEvent, filePath: string): Promise<void> {
    // Check if file should be imported
    if (!this._shouldInclude(filePath)) {
      return;
    }

    // Check exclusions
    if (this._shouldExclude(filePath)) {
      return;
    }

    // Debounce the import
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        if (event.kind === "remove") {
          // Remove snippets for this file
          await this._removeFileSnippets(filePath);
        } else {
          // Re-import file
          await this.importFile(filePath, { overwrite: true });
        }
      } catch (error) {
        console.error(`Failed to handle change for ${filePath}:`, error);
      }

      this.debounceTimers.delete(filePath);
    }, this.config.watchDebounceMs);

    this.debounceTimers.set(filePath, timer as any);
  }

  private async _removeFileSnippets(filePath: string): Promise<void> {
    // Find all snippets with this source path
    const snippets = this.fx.proxy("snippets").val() || {};

    for (const [id, snippet] of Object.entries(snippets)) {
      if (snippet && typeof snippet === 'object') {
        const s = snippet as any;

        if (s.sourcePath === filePath) {
          this.fx.proxy(`snippets.${id}`).val(undefined);
        }
      }
    }

    // Remove from imported files
    this.importedFiles.delete(filePath);
  }

  private async _extractFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const stat = await Deno.stat(filePath);

      // Check file size
      if (stat.size > this.config.maxFileSizeBytes) {
        console.warn(`File too large, skipping: ${filePath}`);
        return null;
      }

      const content = await Deno.readTextFile(filePath);
      const filename = filePath.split(/[/\\]/).pop() || '';
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      const language = this._detectLanguage(extension);

      const metadata: FileMetadata = {
        path: filePath,
        relativePath: filePath.substring(this.config.baseDir.length + 1),
        name: filename,
        extension,
        language,
        size: stat.size,
        created: stat.birthtime?.getTime() || Date.now(),
        modified: stat.mtime?.getTime() || Date.now(),
        lines: content.split('\n').length,
      };

      // Extract symbols if enabled
      if (this.config.extractSymbols) {
        metadata.symbols = this._extractSymbols(content, language);
      }

      // Extract comments if enabled
      if (this.config.extractComments) {
        metadata.comments = this._extractComments(content, language);
      }

      // Get Git info if enabled
      if (this.config.gitAware) {
        metadata.gitInfo = await this._getGitInfo(filePath);
      }

      return metadata;
    } catch (error) {
      console.error(`Failed to extract metadata from ${filePath}:`, error);
      return null;
    }
  }

  private _extractSymbols(content: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    if (language === 'javascript' || language === 'typescript') {
      // Extract JavaScript/TypeScript functions and classes
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Function declarations
        if (/^(export\s+)?(async\s+)?function\s+(\w+)/.test(line)) {
          const match = line.match(/^(export\s+)?(async\s+)?function\s+(\w+)/);
          if (match) {
            const symbol = this._extractFunctionSymbol(lines, i, match[3], !!match[1], !!match[2]);
            if (symbol) symbols.push(symbol);
          }
        }

        // Arrow functions
        if (/^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/.test(line)) {
          const match = line.match(/^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/);
          if (match) {
            const symbol = this._extractFunctionSymbol(lines, i, match[2], !!match[1], !!match[3]);
            if (symbol) symbols.push(symbol);
          }
        }

        // Class declarations
        if (/^(export\s+)?(abstract\s+)?class\s+(\w+)/.test(line)) {
          const match = line.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)/);
          if (match) {
            const symbol = this._extractClassSymbol(lines, i, match[3], !!match[1]);
            if (symbol) symbols.push(symbol);
          }
        }
      }
    }

    return symbols;
  }

  private _extractFunctionSymbol(
    lines: string[],
    startLine: number,
    name: string,
    exported: boolean,
    async: boolean
  ): SymbolInfo | null {
    // Find function body
    let braceCount = 0;
    let endLine = startLine;
    let started = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        endLine = i;
        break;
      }
    }

    const content = lines.slice(startLine, endLine + 1).join('\n');

    return {
      type: "function",
      name,
      startLine,
      endLine,
      content,
      exported,
      async,
    };
  }

  private _extractClassSymbol(
    lines: string[],
    startLine: number,
    name: string,
    exported: boolean
  ): SymbolInfo | null {
    // Find class body
    let braceCount = 0;
    let endLine = startLine;
    let started = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        endLine = i;
        break;
      }
    }

    const content = lines.slice(startLine, endLine + 1).join('\n');

    return {
      type: "class",
      name,
      startLine,
      endLine,
      content,
      exported,
    };
  }

  private _extractComments(content: string, language: string): CommentInfo[] {
    const comments: CommentInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Line comments
      if (line.startsWith('//')) {
        comments.push({
          type: "line",
          content: line.substring(2).trim(),
          line: i + 1,
        });
      }

      // Doc comments
      if (line.startsWith('/**')) {
        let docContent = '';
        let j = i;

        while (j < lines.length && !lines[j].includes('*/')) {
          docContent += lines[j] + '\n';
          j++;
        }

        if (j < lines.length) {
          docContent += lines[j];
          comments.push({
            type: "doc",
            content: docContent,
            line: i + 1,
          });
        }
      }
    }

    return comments;
  }

  private async _getGitInfo(filePath: string): Promise<GitFileInfo | undefined> {
    try {
      // Check if file is tracked
      const statusCmd = new Deno.Command("git", {
        args: ["status", "--porcelain", filePath],
        stdout: "piped",
        stderr: "piped",
      });

      const statusResult = await statusCmd.output();
      const status = new TextDecoder().decode(statusResult.stdout).trim();

      // Get current branch
      const branchCmd = new Deno.Command("git", {
        args: ["branch", "--show-current"],
        stdout: "piped",
        stderr: "piped",
      });

      const branchResult = await branchCmd.output();
      const branch = new TextDecoder().decode(branchResult.stdout).trim();

      return {
        tracked: statusResult.success,
        modified: status.length > 0,
        branch,
      };
    } catch {
      return undefined;
    }
  }

  private _shouldInclude(path: string): boolean {
    for (const pattern of this.config.include) {
      if (this._matchPattern(path, pattern)) {
        return true;
      }
    }

    return false;
  }

  private _shouldExclude(path: string): boolean {
    for (const pattern of this.config.exclude) {
      if (this._matchPattern(path, pattern)) {
        return true;
      }
    }

    return false;
  }

  private _matchPattern(path: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$'
    );

    return regex.test(path);
  }

  private _generateFileId(metadata: FileMetadata): string {
    // Use relative path to generate ID
    return metadata.relativePath
      .replace(/[/\\]/g, '_')
      .replace(/\.[^.]+$/, '');
  }

  private _generateSymbolId(metadata: FileMetadata, symbol: SymbolInfo): string {
    const fileId = this._generateFileId(metadata);
    return `${fileId}_${symbol.name}`;
  }

  private _detectLanguage(extension: string): string {
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
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

    return langMap[extension] || 'text';
  }
}

/**
 * Create and initialize auto-import manager
 */
export function createAutoImportManager(
  fx: FXCore,
  config?: Partial<AutoImportConfig>
): AutoImportManager {
  return new AutoImportManager(fx, config);
}
