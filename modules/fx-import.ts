/**
 * FX Import System - Convert existing codebases to FXD
 * Leverages fx-flow for cross-realm processing and fx-safe for resilience
 * @agent: agent-modules-io
 * @timestamp: 2025-10-02
 * @task: TRACK-B-MODULES.md#B3.1
 */

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy } from '../fxn.ts';

interface ImportOptions {
  recursive?: boolean;
  filter?: (path: string) => boolean;
  chunkSize?: number;
  createGroups?: boolean;
  autoDetectStructure?: boolean;
  preserveComments?: boolean;
  maxFileSize?: number;
  concurrency?: number;
}

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  language: string;
  content: string;
  structure?: CodeStructure;
  snippets?: SnippetInfo[];
}

interface CodeStructure {
  imports: ImportStatement[];
  exports: ExportStatement[];
  functions: FunctionDeclaration[];
  classes: ClassDeclaration[];
  variables: VariableDeclaration[];
  types: TypeDeclaration[];
  comments: CommentBlock[];
}

interface SnippetInfo {
  id: string;
  name: string;
  content: string;
  language: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'import' | 'export' | 'block';
  startLine: number;
  endLine: number;
  dependencies: string[];
  exports: string[];
}

export class FXImportEngine {
  private supportedExtensions = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.py', '.pyx', '.pyi',
    '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm', '.vue', '.svelte',
    '.md', '.mdx', '.json', '.yaml', '.yml', '.toml',
    '.sql', '.graphql', '.gql'
  ]);

  constructor() {
    // Basic import engine - no plugin dependencies
  }

  async importDirectory(dirPath: string, targetView: string, options: ImportOptions = {}): Promise<{
    filesProcessed: number;
    snippetsCreated: number;
    viewsCreated: number;
    errors: string[];
    stats: ImportStats;
  }> {
    const opts = this.normalizeOptions(options);

    console.log(`📥 Starting import from: ${dirPath}`);
    console.log(`🎯 Target view: ${targetView}`);
    console.log(`⚙️ Options:`, opts);

    const stats: ImportStats = {
      startTime: Date.now(),
      filesScanned: 0,
      filesProcessed: 0,
      snippetsCreated: 0,
      viewsCreated: 0,
      errors: [],
      warnings: [],
      totalSize: 0,
      processingTime: 0
    };

    try {
      // Scan directory structure
      const files = await this.scanDirectory(dirPath, opts);
      stats.filesScanned = files.length;
      stats.totalSize = files.reduce((sum, f) => sum + f.size, 0);

      console.log(`📊 Found ${files.length} files (${this.formatBytes(stats.totalSize)})`);

      // Process files in chunks
      const chunks = this.chunkArray(files, opts.chunkSize);

      for (const chunk of chunks) {
        const chunkResults = await this.processFileChunk(chunk, targetView, opts);
        this.mergeStats(stats, chunkResults);
      }

      // Create final views and groups
      if (opts.createGroups) {
        await this.createGroupStructure(targetView, files, opts);
        stats.viewsCreated++;
      }

      stats.processingTime = Date.now() - stats.startTime;

      console.log(`✅ Import completed:`);
      console.log(`   📄 Files: ${stats.filesProcessed}/${stats.filesScanned}`);
      console.log(`   ✂️ Snippets: ${stats.snippetsCreated}`);
      console.log(`   👁️ Views: ${stats.viewsCreated}`);
      console.log(`   ⏱️ Time: ${stats.processingTime}ms`);

      return {
        filesProcessed: stats.filesProcessed,
        snippetsCreated: stats.snippetsCreated,
        viewsCreated: stats.viewsCreated,
        errors: stats.errors,
        stats
      };

    } catch (error) {
      console.error(`❌ Import failed:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Import failed: ${errorMsg}`);
      throw error;
    }
  }

  async importFile(filePath: string, targetView: string, options: ImportOptions = {}): Promise<FileInfo> {
    const content = await Deno.readTextFile(filePath);
    const stat = await Deno.stat(filePath);

    const fileInfo: FileInfo = {
      path: filePath,
      relativePath: filePath,
      size: stat.size,
      language: this.detectLanguage(filePath),
      content
    };

    // Parse code structure
    if (this.isCodeFile(filePath)) {
      fileInfo.structure = await this.parseCodeStructure(content, fileInfo.language);
      fileInfo.snippets = await this.extractSnippets(fileInfo);
    }

    // Create snippets in FXD
    if (fileInfo.snippets) {
      for (const snippet of fileInfo.snippets) {
        await this.createSnippetFromInfo(snippet, targetView);
      }
    }

    // Create view
    await this.createViewFromFile(fileInfo, targetView);

    return fileInfo;
  }

  private async scanDirectory(dirPath: string, options: ImportOptions): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      for await (const entry of Deno.readDir(dirPath)) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory && options.recursive) {
          if (this.shouldProcessDirectory(entry.name)) {
            const subFiles = await this.scanDirectory(fullPath, options);
            files.push(...subFiles);
          }
        } else if (entry.isFile) {
          if (this.shouldProcessFile(fullPath, options)) {
            try {
              const stat = await Deno.stat(fullPath);
              const content = await Deno.readTextFile(fullPath);

              files.push({
                path: fullPath,
                relativePath: fullPath.replace(dirPath + '/', ''),
                size: stat.size,
                language: this.detectLanguage(fullPath),
                content
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.warn(`⚠️ Skipped ${fullPath}: ${errorMsg}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Failed to scan directory ${dirPath}:`, error);
    }

    return files;
  }

  private async parseCodeStructure(content: string, language: string): Promise<CodeStructure> {
    const structure: CodeStructure = {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      variables: [],
      types: [],
      comments: []
    };

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse imports
      if (line.startsWith('import ') || line.includes(' from ')) {
        structure.imports.push(this.parseImport(line, i));
      }

      // Parse exports
      if (line.startsWith('export ')) {
        structure.exports.push(this.parseExport(line, i));
      }

      // Parse functions
      if (this.isFunctionDeclaration(line, language)) {
        structure.functions.push(this.parseFunction(lines, i, language));
      }

      // Parse classes
      if (this.isClassDeclaration(line, language)) {
        structure.classes.push(this.parseClass(lines, i, language));
      }

      // Parse variables
      if (this.isVariableDeclaration(line, language)) {
        structure.variables.push(this.parseVariable(line, i, language));
      }

      // Parse types (TypeScript)
      if (language === 'typescript' && this.isTypeDeclaration(line)) {
        structure.types.push(this.parseType(line, i));
      }

      // Parse comments
      if (this.isComment(line, language)) {
        const comment = this.parseComment(lines, i, language);
        if (comment) structure.comments.push(comment);
      }
    }

    return structure;
  }

  private async extractSnippets(fileInfo: FileInfo): Promise<SnippetInfo[]> {
    const snippets: SnippetInfo[] = [];

    if (!fileInfo.structure) return snippets;

    // Create snippets from functions
    fileInfo.structure.functions.forEach(func => {
      snippets.push({
        id: this.generateSnippetId(fileInfo.relativePath, func.name),
        name: func.name,
        content: func.body,
        language: fileInfo.language,
        type: 'function',
        startLine: func.startLine,
        endLine: func.endLine,
        dependencies: func.dependencies || [],
        exports: [func.name]
      });
    });

    // Create snippets from classes
    fileInfo.structure.classes.forEach(cls => {
      snippets.push({
        id: this.generateSnippetId(fileInfo.relativePath, cls.name),
        name: cls.name,
        content: cls.body,
        language: fileInfo.language,
        type: 'class',
        startLine: cls.startLine,
        endLine: cls.endLine,
        dependencies: cls.dependencies || [],
        exports: [cls.name, ...cls.methods]
      });
    });

    // Create import/export snippets
    if (fileInfo.structure.imports.length > 0) {
      const importContent = fileInfo.structure.imports.map(imp => imp.statement).join('\n');
      snippets.push({
        id: this.generateSnippetId(fileInfo.relativePath, 'imports'),
        name: 'imports',
        content: importContent,
        language: fileInfo.language,
        type: 'import',
        startLine: 0,
        endLine: fileInfo.structure.imports.length,
        dependencies: [],
        exports: fileInfo.structure.imports.map(imp => imp.specifier).flat()
      });
    }

    return snippets;
  }

  private async createSnippetFromInfo(snippet: SnippetInfo, targetView: string): Promise<void> {
    const snippetPath = `snippets.${snippet.id}`;

    $$(`${snippetPath}.content`).val(snippet.content);
    $$(`${snippetPath}.name`).val(snippet.name);
    $$(`${snippetPath}.language`).val(snippet.language);
    $$(`${snippetPath}.type`).val(snippet.type);
    $$(`${snippetPath}.created`).val(Date.now());
    $$(`${snippetPath}.dependencies`).val(snippet.dependencies);
    $$(`${snippetPath}.exports`).val(snippet.exports);
    $$(`${snippetPath}.sourceFile`).val(targetView);
    $$(`${snippetPath}.lineRange`).val([snippet.startLine, snippet.endLine]);

    console.log(`  ✓ Created snippet: ${snippet.id} (${snippet.type})`);
  }

  private async createViewFromFile(fileInfo: FileInfo, targetView: string): Promise<void> {
    const viewPath = `views.${targetView}`;

    $$(`${viewPath}.content`).val(fileInfo.content);
    $$(`${viewPath}.language`).val(fileInfo.language);
    $$(`${viewPath}.size`).val(fileInfo.size);
    $$(`${viewPath}.created`).val(Date.now());
    $$(`${viewPath}.sourceFile`).val(fileInfo.path);

    if (fileInfo.snippets) {
      $$(`${viewPath}.snippets`).val(fileInfo.snippets.map(s => s.id));
    }

    console.log(`  ✓ Created view: ${targetView}`);
  }

  // Utility methods for parsing different languages
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
      'py': 'python', 'pyx': 'python', 'pyi': 'python',
      'rs': 'rust', 'go': 'go', 'java': 'java',
      'c': 'c', 'cpp': 'cpp', 'cxx': 'cpp', 'cc': 'cpp',
      'h': 'c', 'hpp': 'cpp', 'hxx': 'cpp',
      'css': 'css', 'scss': 'scss', 'sass': 'sass', 'less': 'less',
      'html': 'html', 'htm': 'html', 'vue': 'vue', 'svelte': 'svelte',
      'md': 'markdown', 'mdx': 'markdown',
      'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml',
      'sql': 'sql', 'graphql': 'graphql', 'gql': 'graphql'
    };
    return langMap[ext || ''] || 'text';
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go', '.java', '.c', '.cpp'];
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  private shouldProcessFile(filePath: string, options: ImportOptions): boolean {
    // Skip binary files, temp files, etc.
    const skipPatterns = [
      /node_modules/, /\.git/, /dist/, /build/, /coverage/,
      /\.log$/, /\.tmp$/, /\.cache$/, /thumbs\.db$/i, /\.ds_store$/i
    ];

    if (skipPatterns.some(pattern => pattern.test(filePath))) {
      return false;
    }

    // Check file size
    if (options.maxFileSize) {
      try {
        const stat = Deno.statSync(filePath);
        if (stat.size > options.maxFileSize) return false;
      } catch {}
    }

    // Check extension
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    if (!this.supportedExtensions.has(ext)) return false;

    // Apply custom filter
    if (options.filter && !options.filter(filePath)) return false;

    return true;
  }

  private shouldProcessDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'];
    return !skipDirs.includes(dirName) && !dirName.startsWith('.');
  }

  private normalizeOptions(options: ImportOptions): Required<ImportOptions> {
    return {
      recursive: options.recursive ?? true,
      filter: options.filter ?? (() => true),
      chunkSize: options.chunkSize ?? 10,
      createGroups: options.createGroups ?? true,
      autoDetectStructure: options.autoDetectStructure ?? true,
      preserveComments: options.preserveComments ?? true,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      concurrency: options.concurrency ?? 4
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private generateSnippetId(relativePath: string, name: string): string {
    const pathKey = relativePath.replace(/[^a-zA-Z0-9]/g, '.');
    return `${pathKey}.${name}`;
  }

  // Language-specific parsing methods
  private isFunctionDeclaration(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      javascript: [/^(async\s+)?function\s+\w+/, /^(const|let|var)\s+\w+\s*=\s*(\(|async)/],
      typescript: [/^(async\s+)?function\s+\w+/, /^(const|let|var)\s+\w+\s*=\s*(\(|async)/, /^(export\s+)?(async\s+)?function/],
      python: [/^(async\s+)?def\s+\w+/, /^\s*(async\s+)?def\s+\w+/],
      rust: [/^(pub\s+)?fn\s+\w+/, /^(pub\s+)?(async\s+)?fn\s+\w+/],
      go: [/^func\s+(\w+\s*)?\w+/, /^func\s*\(/]
    };

    return patterns[language]?.some(pattern => pattern.test(line)) || false;
  }

  private isClassDeclaration(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      javascript: [/^class\s+\w+/, /^export\s+class\s+\w+/],
      typescript: [/^(export\s+)?(abstract\s+)?class\s+\w+/, /^(export\s+)?interface\s+\w+/],
      python: [/^class\s+\w+/],
      rust: [/^(pub\s+)?struct\s+\w+/, /^(pub\s+)?enum\s+\w+/, /^(pub\s+)?trait\s+\w+/],
      java: [/^(public|private|protected)?\s*class\s+\w+/],
      cpp: [/^class\s+\w+/, /^struct\s+\w+/]
    };

    return patterns[language]?.some(pattern => pattern.test(line)) || false;
  }

  private isVariableDeclaration(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      javascript: [/^(const|let|var)\s+\w+/, /^export\s+(const|let|var)\s+\w+/],
      typescript: [/^(const|let|var)\s+\w+/, /^export\s+(const|let|var)\s+\w+/, /^type\s+\w+/],
      python: [/^\w+\s*=/, /^global\s+\w+/],
      rust: [/^(pub\s+)?(const|static)\s+\w+/, /^let\s+(mut\s+)?\w+/],
      go: [/^(var|const)\s+\w+/, /^\w+\s*:=/]
    };

    return patterns[language]?.some(pattern => pattern.test(line)) || false;
  }

  private isTypeDeclaration(line: string): boolean {
    return /^(export\s+)?(type|interface)\s+\w+/.test(line);
  }

  private isComment(line: string, language: string): boolean {
    const commentStarts: Record<string, string[]> = {
      javascript: ['//', '/*'],
      typescript: ['//', '/*'],
      python: ['#', '"""', "'''"],
      rust: ['//', '/*'],
      go: ['//', '/*'],
      java: ['//', '/*'],
      c: ['//', '/*'],
      cpp: ['//', '/*'],
      css: ['/*'],
      html: ['<!--'],
      sql: ['--', '/*']
    };

    const starts = commentStarts[language] || ['//'];
    return starts.some(start => line.trimStart().startsWith(start));
  }

  // Parser implementations (simplified for now)
  private parseImport(line: string, lineNumber: number): ImportStatement {
    const match = line.match(/import\s+(.+?)\s+from\s+['"](.+?)['"]/);
    return {
      statement: line,
      specifier: match?.[1]?.split(',').map(s => s.trim()) || [],
      source: match?.[2] || '',
      lineNumber
    };
  }

  private parseExport(line: string, lineNumber: number): ExportStatement {
    return {
      statement: line,
      specifier: line.match(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/)?.[1] || '',
      lineNumber
    };
  }

  private parseFunction(lines: string[], startLine: number, language: string): FunctionDeclaration {
    const line = lines[startLine];
    const name = this.extractFunctionName(line, language);
    const endLine = this.findBlockEnd(lines, startLine, language);
    const body = lines.slice(startLine, endLine + 1).join('\n');

    return {
      name,
      body,
      startLine,
      endLine,
      parameters: this.extractParameters(line),
      dependencies: this.extractDependencies(body)
    };
  }

  private parseClass(lines: string[], startLine: number, language: string): ClassDeclaration {
    const line = lines[startLine];
    const name = this.extractClassName(line, language);
    const endLine = this.findBlockEnd(lines, startLine, language);
    const body = lines.slice(startLine, endLine + 1).join('\n');

    return {
      name,
      body,
      startLine,
      endLine,
      methods: this.extractMethods(body, language),
      dependencies: this.extractDependencies(body)
    };
  }

  private parseVariable(line: string, lineNumber: number, language: string): VariableDeclaration {
    const name = this.extractVariableName(line, language);
    return {
      name,
      body: line,
      startLine: lineNumber,
      endLine: lineNumber,
      type: this.extractVariableType(line, language),
      dependencies: []
    };
  }

  private parseType(line: string, lineNumber: number): TypeDeclaration {
    const name = line.match(/(?:type|interface)\s+(\w+)/)?.[1] || 'unknown';
    return {
      name,
      body: line,
      startLine: lineNumber,
      endLine: lineNumber
    };
  }

  private parseComment(lines: string[], startLine: number, language: string): CommentBlock | null {
    // Extract multi-line comments
    const line = lines[startLine];

    if (line.includes('/*') || line.includes('"""') || line.includes("'''")) {
      const endLine = this.findCommentEnd(lines, startLine, language);
      const content = lines.slice(startLine, endLine + 1).join('\n');

      return {
        content,
        startLine,
        endLine,
        type: 'block'
      };
    }

    return null;
  }

  // Helper methods for extraction
  private extractFunctionName(line: string, language: string): string {
    const patterns: Record<string, RegExp> = {
      javascript: /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\()/,
      typescript: /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\()/,
      python: /def\s+(\w+)/,
      rust: /fn\s+(\w+)/,
      go: /func\s+(\w+)/
    };

    const match = patterns[language]?.exec(line);
    return match?.[1] || match?.[2] || 'anonymous';
  }

  private extractClassName(line: string, language: string): string {
    const patterns: Record<string, RegExp> = {
      javascript: /class\s+(\w+)/,
      typescript: /(?:class|interface)\s+(\w+)/,
      python: /class\s+(\w+)/,
      rust: /(?:struct|enum|trait)\s+(\w+)/,
      java: /class\s+(\w+)/,
      cpp: /(?:class|struct)\s+(\w+)/
    };

    return patterns[language]?.exec(line)?.[1] || 'Unknown';
  }

  private extractVariableName(line: string, language: string): string {
    const patterns: Record<string, RegExp> = {
      javascript: /(?:const|let|var)\s+(\w+)/,
      typescript: /(?:const|let|var)\s+(\w+)/,
      python: /(\w+)\s*=/,
      rust: /(?:const|static|let)\s+(?:mut\s+)?(\w+)/,
      go: /(?:var|const)?\s*(\w+)\s*:?=/
    };

    return patterns[language]?.exec(line)?.[1] || 'unknown';
  }

  private extractParameters(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) return [];

    return match[1].split(',')
      .map(p => p.trim().split(/\s+/)[0].replace(/[:\?]/g, ''))
      .filter(p => p && p !== '');
  }

  private extractMethods(body: string, language: string): string[] {
    const methods: string[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      if (this.isFunctionDeclaration(line.trim(), language)) {
        const name = this.extractFunctionName(line, language);
        if (name !== 'constructor' && name !== 'anonymous') {
          methods.push(name);
        }
      }
    }

    return methods;
  }

  private extractDependencies(code: string): string[] {
    const deps = new Set<string>();

    // Extract function calls, variable references, etc.
    const functionCalls = code.match(/\b(\w+)\(/g);
    if (functionCalls) {
      functionCalls.forEach(call => {
        const name = call.slice(0, -1);
        if (name.length > 1) deps.add(name);
      });
    }

    return Array.from(deps);
  }

  private extractVariableType(line: string, language: string): string {
    if (language === 'typescript') {
      const match = line.match(/:\s*([^=]+?)(?:\s*=|$)/);
      return match?.[1]?.trim() || 'any';
    }
    return 'unknown';
  }

  private findBlockEnd(lines: string[], startLine: number, language: string): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j-1] : '';

        if (inString) {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
          }
          continue;
        }

        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
          continue;
        }

        if (char === '{') braceCount++;
        if (char === '}') braceCount--;

        if (braceCount === 0 && i > startLine) {
          return i;
        }
      }
    }

    return startLine; // Fallback
  }

  private findCommentEnd(lines: string[], startLine: number, language: string): number {
    const startLine_text = lines[startLine];

    if (startLine_text.includes('/*')) {
      for (let i = startLine; i < lines.length; i++) {
        if (lines[i].includes('*/')) return i;
      }
    }

    if (startLine_text.includes('"""') || startLine_text.includes("'''")) {
      const quote = startLine_text.includes('"""') ? '"""' : "'''";
      for (let i = startLine + 1; i < lines.length; i++) {
        if (lines[i].includes(quote)) return i;
      }
    }

    return startLine;
  }

  private async processFileChunk(
    files: FileInfo[],
    targetView: string,
    options: Required<ImportOptions>
  ): Promise<Partial<ImportStats>> {
    const chunkStats: Partial<ImportStats> = {
      filesProcessed: 0,
      snippetsCreated: 0,
      errors: [],
      warnings: []
    };

    for (const file of files) {
      try {
        if (options.autoDetectStructure && this.isCodeFile(file.path)) {
          file.structure = await this.parseCodeStructure(file.content, file.language);
          file.snippets = await this.extractSnippets(file);
        }

        // Create snippets
        if (file.snippets) {
          for (const snippet of file.snippets) {
            await this.createSnippetFromInfo(snippet, targetView);
            chunkStats.snippetsCreated = (chunkStats.snippetsCreated || 0) + 1;
          }
        }

        // Create view
        await this.createViewFromFile(file, file.relativePath);

        chunkStats.filesProcessed = (chunkStats.filesProcessed || 0) + 1;

      } catch (error) {
        console.error(`❌ Failed to process ${file.path}:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        chunkStats.errors?.push(`${file.path}: ${errorMsg}`);
      }
    }

    return chunkStats;
  }

  private async createGroupStructure(targetView: string, files: FileInfo[], options: Required<ImportOptions>): Promise<void> {
    // Create language-based groups
    const languageGroups = new Map<string, FileInfo[]>();

    files.forEach(file => {
      const lang = file.language;
      if (!languageGroups.has(lang)) {
        languageGroups.set(lang, []);
      }
      languageGroups.get(lang)!.push(file);
    });

    // Create FX groups for each language
    for (const [language, langFiles] of languageGroups) {
      const groupPath = `groups.${targetView}.${language}`;
      const snippetPaths = langFiles
        .filter(f => f.snippets)
        .flatMap(f => f.snippets!)
        .map(s => `snippets.${s.id}`);

      // Initialize group with paths
      $$(groupPath).group(snippetPaths);
      console.log(`  ✓ Created group: ${language} (${snippetPaths.length} snippets)`);
    }
  }

  private mergeStats(target: ImportStats, source: Partial<ImportStats>): void {
    target.filesProcessed += source.filesProcessed || 0;
    target.snippetsCreated += source.snippetsCreated || 0;
    target.errors.push(...(source.errors || []));
    target.warnings.push(...(source.warnings || []));
  }
}

// Type definitions for parsing results
interface ImportStatement {
  statement: string;
  specifier: string[];
  source: string;
  lineNumber: number;
}

interface ExportStatement {
  statement: string;
  specifier: string;
  lineNumber: number;
}

interface FunctionDeclaration {
  name: string;
  body: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  dependencies: string[];
}

interface ClassDeclaration {
  name: string;
  body: string;
  startLine: number;
  endLine: number;
  methods: string[];
  dependencies: string[];
}

interface VariableDeclaration {
  name: string;
  body: string;
  startLine: number;
  endLine: number;
  type: string;
  dependencies: string[];
}

interface TypeDeclaration {
  name: string;
  body: string;
  startLine: number;
  endLine: number;
}

interface CommentBlock {
  content: string;
  startLine: number;
  endLine: number;
  type: 'line' | 'block';
}

interface ImportStats {
  startTime: number;
  filesScanned: number;
  filesProcessed: number;
  snippetsCreated: number;
  viewsCreated: number;
  errors: string[];
  warnings: string[];
  totalSize: number;
  processingTime: number;
}

// Export helper functions
export function importCodebase(
  dirPath: string,
  targetView: string = 'imported',
  options: ImportOptions = {}
): Promise<any> {
  const importer = new FXImportEngine();
  return importer.importDirectory(dirPath, targetView, options);
}

export function importSingleFile(
  filePath: string,
  targetView: string = 'imported',
  options: ImportOptions = {}
): Promise<FileInfo> {
  const importer = new FXImportEngine();
  return importer.importFile(filePath, targetView, options);
}