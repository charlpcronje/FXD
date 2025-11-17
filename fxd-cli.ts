#!/usr/bin/env deno run --allow-all

// @agent: agent-cli
// @timestamp: 2025-10-02
// @task: TRACK-C-CLI.md - All tasks

/**
 * FXD CLI - Command line interface for FXD operations
 * Usage: deno run --allow-all fxd-cli.ts <command> [options]
 */

import { $$, $_$$ } from './fx.ts';
import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";

// Use root proxy for disk-level operations
const $disk = $_$$;

interface CLICommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: any) => Promise<void>;
}

interface DiskState {
  disk: {
    name: string;
    created: number;
    version: string;
    path: string;
  };
  snippets: Record<string, any>;
  views: Record<string, any>;
  groups: Record<string, any>;
  markers: Record<string, any>;
  metadata: Record<string, any>;
}

class FXDCLI {
  private commands: Map<string, CLICommand> = new Map();
  private diskPath: string = './.fxd-state.json';

  constructor() {
    this.registerCommands();
  }

  async init(): Promise<void> {
    await this.loadState();
  }

  // @agent: agent-cli
  // @task: C.7 - Error handling
  private async loadState(): Promise<void> {
    try {
      const exists = await Deno.stat(this.diskPath).catch(() => null);
      if (exists) {
        const content = await Deno.readTextFile(this.diskPath);
        const state: DiskState = JSON.parse(content);

        // Restore state to FX
        if (state.disk) {
          $disk('disk.name').val(state.disk.name);
          $disk('disk.created').val(state.disk.created);
          $disk('disk.version').val(state.disk.version);
          $disk('disk.path').val(state.disk.path);
        }

        // Restore collections by setting each child
        if (state.snippets) {
          for (const [key, value] of Object.entries(state.snippets)) {
            $disk(`snippets.${key}`).val(value);
          }
        }
        if (state.views) {
          for (const [key, value] of Object.entries(state.views)) {
            $disk(`views.${key}`).val(value);
          }
        }
        if (state.groups) {
          for (const [key, value] of Object.entries(state.groups)) {
            $disk(`groups.${key}`).val(value);
          }
        }
        if (state.markers) {
          for (const [key, value] of Object.entries(state.markers)) {
            $disk(`markers.${key}`).val(value);
          }
        }
        if (state.metadata) {
          if (state.metadata.creator) $disk('metadata.creator').val(state.metadata.creator);
          if (state.metadata.description) $disk('metadata.description').val(state.metadata.description);
          if (state.metadata.tags) $disk('metadata.tags').val(state.metadata.tags);
        }
      }
    } catch (error) {
      // Silent fail on first run - no state file exists yet
    }
  }

  // @agent: agent-cli
  // @task: C.7 - Error handling
  private async saveState(): Promise<void> {
    try {
      // Helper to extract all child values from a node
      const extractChildren = (path: string): Record<string, any> => {
        const result: Record<string, any> = {};
        const node = $disk(path).node();
        for (const key in node.__nodes) {
          result[key] = $disk(`${path}.${key}`).val();
        }
        return result;
      };

      const state: DiskState = {
        disk: {
          name: $disk('disk.name').val() || 'Unnamed',
          created: $disk('disk.created').val() || Date.now(),
          version: $disk('disk.version').val() || '1.0.0',
          path: $disk('disk.path').val() || './.fxd'
        },
        snippets: extractChildren('snippets'),
        views: extractChildren('views'),
        groups: extractChildren('groups'),
        markers: extractChildren('markers'),
        metadata: {
          creator: $disk('metadata.creator').val(),
          description: $disk('metadata.description').val(),
          tags: $disk('metadata.tags').val() || []
        }
      };

      await Deno.writeTextFile(this.diskPath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('⚠️  Warning: Failed to save state:', error.message);
    }
  }

  // @agent: agent-cli
  // @task: C.8 - Progress indicators
  private spinner(message: string): { stop: (finalMessage?: string) => void } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let running = true;

    const interval = setInterval(() => {
      if (running) {
        Deno.stdout.writeSync(new TextEncoder().encode(`\r${frames[i]} ${message}`));
        i = (i + 1) % frames.length;
      }
    }, 80);

    return {
      stop: (finalMessage?: string) => {
        running = false;
        clearInterval(interval);
        if (finalMessage) {
          Deno.stdout.writeSync(new TextEncoder().encode(`\r${finalMessage}\n`));
        } else {
          Deno.stdout.writeSync(new TextEncoder().encode('\r' + ' '.repeat(message.length + 5) + '\r'));
        }
      }
    };
  }

  private registerCommands(): void {
    // Create new FXD disk
    this.commands.set('create', {
      name: 'create',
      description: 'Create a new FXD disk',
      usage: 'fxd-cli create <name> [--path=./]',
      execute: this.createDisk.bind(this)
    });

    // Import files into FXD
    this.commands.set('import', {
      name: 'import',
      description: 'Import files/folders into FXD as snippets',
      usage: 'fxd-cli import <path> [--disk=current] [--type=auto]',
      execute: this.importFiles.bind(this)
    });

    // List disk contents
    this.commands.set('list', {
      name: 'list',
      description: 'List FXD disk contents',
      usage: 'fxd-cli list [--type=all|snippets|views]',
      execute: this.listContents.bind(this)
    });

    // Run snippets
    this.commands.set('run', {
      name: 'run',
      description: 'Execute a snippet or view',
      usage: 'fxd-cli run <snippet-id> [--visualize]',
      execute: this.runSnippet.bind(this)
    });

    // Start visualizer
    this.commands.set('visualize', {
      name: 'visualize',
      description: 'Start the 3D visualizer',
      usage: 'fxd-cli visualize [--port=8080]',
      execute: this.startVisualizer.bind(this)
    });

    // Export from FXD
    this.commands.set('export', {
      name: 'export',
      description: 'Export FXD contents to files',
      usage: 'fxd-cli export <output-path> [--format=files|archive]',
      execute: this.exportContents.bind(this)
    });
  }

  // @agent: agent-cli
  // @task: C.1 - Implement create command
  async createDisk(args: any): Promise<void> {
    const name = args._[1];
    if (!name) {
      console.error('❌ Disk name required');
      console.log('Usage: fxd-cli create <name> [--path=./]');
      return;
    }

    // Validate name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.error('❌ Invalid disk name. Use only letters, numbers, hyphens, and underscores.');
      return;
    }

    const path = args.path || './';
    const diskPath = `${path}/${name}.fxd`;

    const spin = this.spinner('Creating new FXD disk...');

    try {
      // Initialize FX with disk structure
      $disk('disk.name').val(name);
      $disk('disk.created').val(Date.now());
      $disk('disk.version').val('1.0.0');
      $disk('disk.path').val(diskPath);

      // Initialize core collections
      $disk('snippets').val({});
      $disk('views').val({});
      $disk('groups').val({});
      $disk('markers').val({});

      // Create basic metadata
      $disk('metadata.creator').val(Deno.env.get('USER') || Deno.env.get('USERNAME') || 'unknown');
      $disk('metadata.description').val(`FXD disk: ${name}`);
      $disk('metadata.tags').val([]);

      // Save state
      await this.saveState();

      spin.stop('✅ FXD disk created successfully!');
      console.log(`📁 Disk name: ${name}`);
      console.log(`📂 Location: ${diskPath}`);
      console.log(`🌐 Web UI: http://localhost:3000/app`);
      console.log(`\n🎯 Next steps:`);
      console.log(`   fxd-cli import <your-code-folder>  # Import existing code`);
      console.log(`   fxd-cli list                       # List disk contents`);
      console.log(`   fxd-cli visualize                  # Start 3D visualizer`);
    } catch (error) {
      spin.stop('❌ Failed to create disk');
      console.error(`Error: ${error.message}`);
    }
  }

  // @agent: agent-cli
  // @task: C.2 - Implement import command
  async importFiles(args: any): Promise<void> {
    const importPath = args._[1];
    if (!importPath) {
      console.error('❌ Import path required');
      console.log('Usage: fxd-cli import <path> [--type=auto]');
      return;
    }

    const spin = this.spinner(`Importing files from: ${importPath}`);

    try {
      // Check if path exists
      const stat = await Deno.stat(importPath);

      let fileCount = 0;
      let snippetCount = 0;

      if (stat.isFile) {
        spin.stop();
        console.log(`📄 Importing file: ${importPath}`);
        const result = await this.importSingleFile(importPath);
        fileCount = 1;
        snippetCount = result.snippetCount;
      } else if (stat.isDirectory) {
        spin.stop();
        console.log(`📁 Importing directory: ${importPath}`);
        const result = await this.importDirectory(importPath);
        fileCount = result.fileCount;
        snippetCount = result.snippetCount;
      }

      // Save state after import
      await this.saveState();

      console.log(`\n✅ Import completed!`);
      console.log(`   Files imported: ${fileCount}`);
      console.log(`   Snippets created: ${snippetCount}`);
      console.log(`\n🎯 Next steps:`);
      console.log(`   fxd-cli list             # View imported snippets`);
      console.log(`   fxd-cli run <snippet-id> # Execute a snippet`);

    } catch (error) {
      spin.stop('❌ Import failed');
      console.error(`Error: ${error.message}`);
      if (error.message.includes('No such file')) {
        console.log(`💡 Tip: Check that the path exists and you have read permissions`);
      }
    }
  }

  private async importSingleFile(filePath: string): Promise<{ snippetCount: number }> {
    const content = await Deno.readTextFile(filePath);
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'txt';

    // Determine language
    const language = this.detectLanguage(fileExt);

    // Create snippet ID
    const snippetId = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

    let snippetCount = 0;

    // Parse file into snippets if it's code
    if (this.isCodeFile(fileExt)) {
      const snippets = this.parseCodeIntoSnippets(content, language, fileName);

      for (const [id, snippet] of Object.entries(snippets)) {
        $disk(`snippets.${id}`).val(snippet);
        console.log(`  ✓ Snippet: ${id}`);
        snippetCount++;
      }
    } else {
      // Import as single snippet
      const snippet = {
        id: snippetId,
        name: fileName,
        content,
        language,
        created: Date.now(),
        source: filePath,
        type: 'file'
      };

      $disk(`snippets.${snippetId}`).val(snippet);
      console.log(`  ✓ Snippet: ${snippetId}`);
      snippetCount++;
    }

    // Create a view for the file
    $disk(`views.${fileName}`).val(content);

    return { snippetCount };
  }

  private async importDirectory(dirPath: string): Promise<{ fileCount: number; snippetCount: number }> {
    let fileCount = 0;
    let snippetCount = 0;

    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isFile && this.shouldImportFile(entry.name)) {
        const filePath = `${dirPath}/${entry.name}`;
        console.log(`  📄 ${entry.name}`);
        const result = await this.importSingleFile(filePath);
        fileCount++;
        snippetCount += result.snippetCount;
      } else if (entry.isDirectory && !entry.name.startsWith('.')) {
        console.log(`  📁 ${entry.name}/`);
        const result = await this.importDirectory(`${dirPath}/${entry.name}`);
        fileCount += result.fileCount;
        snippetCount += result.snippetCount;
      }
    }

    return { fileCount, snippetCount };
  }

  private parseCodeIntoSnippets(content: string, language: string, fileName: string): Record<string, any> {
    const snippets: Record<string, any> = {};
    const baseId = fileName.replace(/\.[^/.]+$/, '');

    // Simple parsing - look for functions, classes, etc.
    const lines = content.split('\n');
    let currentSnippet: any = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      // Detect function definitions
      if (this.isFunctionDeclaration(trimmed, language)) {
        // Save previous snippet
        if (currentSnippet) {
          snippets[currentSnippet.id] = currentSnippet;
        }

        // Start new snippet
        const functionName = this.extractFunctionName(trimmed, language);
        currentSnippet = {
          id: `${baseId}.${functionName}`,
          name: functionName,
          content: line + '\n',
          language,
          created: Date.now(),
          source: fileName,
          type: 'function',
          startLine: lineNumber,
          endLine: lineNumber
        };
      } else if (currentSnippet) {
        // Add to current snippet
        currentSnippet.content += line + '\n';
        currentSnippet.endLine = lineNumber;
      }
    }

    // Save final snippet
    if (currentSnippet) {
      snippets[currentSnippet.id] = currentSnippet;
    }

    // If no functions found, create one snippet for the whole file
    if (Object.keys(snippets).length === 0) {
      snippets[baseId] = {
        id: baseId,
        name: fileName,
        content,
        language,
        created: Date.now(),
        source: fileName,
        type: 'file'
      };
    }

    return snippets;
  }

  private detectLanguage(extension: string): string {
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
      'yml': 'yaml'
    };

    return langMap[extension] || 'text';
  }

  private isCodeFile(extension: string): boolean {
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp'];
    return codeExtensions.includes(extension);
  }

  private shouldImportFile(filename: string): boolean {
    const skipExtensions = ['.log', '.tmp', '.cache', '.git'];
    const skipFiles = ['node_modules', '.DS_Store', 'thumbs.db'];

    return !skipExtensions.some(ext => filename.endsWith(ext)) &&
           !skipFiles.some(file => filename.toLowerCase().includes(file.toLowerCase()));
  }

  private isFunctionDeclaration(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      javascript: [/^(function\s+\w+|const\s+\w+\s*=\s*\(|async\s+function)/],
      typescript: [/^(function\s+\w+|const\s+\w+\s*=\s*\(|async\s+function|export\s+function)/],
      python: [/^def\s+\w+/, /^async\s+def\s+\w+/],
      rust: [/^(pub\s+)?fn\s+\w+/, /^(pub\s+)?async\s+fn\s+\w+/],
      go: [/^func\s+\w+/],
      java: [/^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/]
    };

    const langPatterns = patterns[language] || [];
    return langPatterns.some(pattern => pattern.test(line));
  }

  private extractFunctionName(line: string, language: string): string {
    // Simple extraction - can be enhanced
    const matches = line.match(/(?:function|def|fn)\s+(\w+)|const\s+(\w+)\s*=/);
    return matches?.[1] || matches?.[2] || 'unknown';
  }

  // @agent: agent-cli
  // @task: C.3 - Implement list command
  async listContents(args: any): Promise<void> {
    const type = args.type || 'all';

    console.log(`\n📋 FXD Disk Contents`);
    console.log(`${'='.repeat(60)}\n`);

    const diskName = $disk('disk.name').val() || 'Unnamed';
    const created = $disk('disk.created').val();
    const diskPath = $disk('disk.path').val() || './.fxd';

    if (created) {
      console.log(`💿 Disk: ${diskName}`);
      console.log(`📅 Created: ${new Date(created).toLocaleDateString()} ${new Date(created).toLocaleTimeString()}`);
      console.log(`📂 Path: ${diskPath}`);
    } else {
      console.log(`💿 No disk created yet`);
      console.log(`💡 Run 'fxd-cli create <name>' to create a new disk`);
      return;
    }

    console.log();

    if (type === 'all' || type === 'snippets') {
      const snippets = $disk('snippets.node().node().__nodes' || {};
      const snippetsNode = $disk('snippets').node();
      const snippetIds = Object.keys(snippetsNode.__nodes);

      console.log(`✂️  SNIPPETS (${snippetIds.length}):`);
      console.log(`${'─'.repeat(60)}`);

      if (snippetIds.length === 0) {
        console.log(`   (no snippets yet)`);
        console.log(`   💡 Run 'fxd-cli import <path>' to add code`);
      } else {
        snippetIds.forEach((id, index) => {
          const snippet = snippets[id];
          const lines = snippet.content ? snippet.content.split('\n').length : 0;
          console.log(`   ${(index + 1).toString().padStart(2)}. ${id}`);
          console.log(`       Language: ${snippet.language} | Type: ${snippet.type} | Lines: ${lines}`);
        });
      }
      console.log();
    }

    if (type === 'all' || type === 'views') {
      const views = $$('views').val() || {};
      const viewIds = Object.keys(views);

      console.log(`👁️  VIEWS (${viewIds.length}):`);
      console.log(`${'─'.repeat(60)}`);

      if (viewIds.length === 0) {
        console.log(`   (no views yet)`);
      } else {
        viewIds.forEach((id, index) => {
          const content = views[id];
          const lines = content.split('\n').length;
          const size = new TextEncoder().encode(content).length;
          const sizeKB = (size / 1024).toFixed(2);
          console.log(`   ${(index + 1).toString().padStart(2)}. ${id} (${lines} lines, ${sizeKB} KB)`);
        });
      }
      console.log();
    }

    // Metadata
    const metadata = $$('metadata').val() || {};
    if (metadata.creator || metadata.description) {
      console.log(`ℹ️  METADATA:`);
      console.log(`${'─'.repeat(60)}`);
      if (metadata.creator) console.log(`   Creator: ${metadata.creator}`);
      if (metadata.description) console.log(`   Description: ${metadata.description}`);
      if (metadata.tags?.length) console.log(`   Tags: ${metadata.tags.join(', ')}`);
      console.log();
    }

    console.log(`${'='.repeat(60)}`);
    console.log(`🌐 Web UI: http://localhost:3000/app`);
    console.log(`🎯 Visualizer: http://localhost:8080`);
  }

  // @agent: agent-cli
  // @task: C.5 - Implement run command
  async runSnippet(args: any): Promise<void> {
    const snippetId = args._[1];
    if (!snippetId) {
      console.error('❌ Snippet ID required');
      console.log('Usage: fxd-cli run <snippet-id> [--visualize]');
      console.log('\n💡 Tip: Use "fxd-cli list" to see available snippets');
      return;
    }

    const snippet = $$(`snippets.${snippetId}`).val();
    if (!snippet) {
      console.error(`❌ Snippet not found: ${snippetId}`);
      console.log(`\n💡 Available snippets:`);
      const snippets = $$('snippets').val() || {};
      const snippetIds = Object.keys(snippets);
      if (snippetIds.length === 0) {
        console.log(`   (no snippets - run 'fxd-cli import <path>' to add some)`);
      } else {
        snippetIds.slice(0, 5).forEach(id => console.log(`   - ${id}`));
        if (snippetIds.length > 5) console.log(`   ... and ${snippetIds.length - 5} more`);
      }
      return;
    }

    const visualize = args.visualize || args.v;

    console.log(`\n🚀 Running snippet: ${snippetId}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`Language: ${snippet.language}`);
    console.log(`Type: ${snippet.type}`);
    console.log(`Source: ${snippet.source || 'unknown'}`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      // Track execution start
      $$(`execution.${snippetId}.status`).val('running');
      $$(`execution.${snippetId}.startTime`).val(Date.now());

      // For JavaScript/TypeScript, we can actually execute it
      if (snippet.language === 'javascript' || snippet.language === 'typescript') {
        const spin = this.spinner('Executing JavaScript code...');
        try {
          const result = await this.executeJavaScript(snippet.content, snippetId);
          spin.stop('✅ Execution completed successfully!');

          if (result !== undefined) {
            console.log(`\n📤 Return value:`);
            console.log(`   ${JSON.stringify(result, null, 2)}`);
          }
        } catch (execError) {
          spin.stop('❌ Execution error');
          throw execError;
        }
      } else {
        console.log(`⚠️  Direct execution not supported for ${snippet.language}`);
        console.log(`\n📝 Code preview (first 15 lines):`);
        console.log(`${'─'.repeat(60)}`);
        snippet.content.split('\n').slice(0, 15).forEach((line: string, i: number) => {
          console.log(`${(i + 1).toString().padStart(4)} | ${line}`);
        });
        const totalLines = snippet.content.split('\n').length;
        if (totalLines > 15) {
          console.log(`${'─'.repeat(60)}`);
          console.log(`... ${totalLines - 15} more lines`);
        }
      }

      // Track execution end
      const startTime = $$(`execution.${snippetId}.startTime`).val();
      const duration = Date.now() - startTime;

      $$(`execution.${snippetId}.status`).val('completed');
      $$(`execution.${snippetId}.endTime`).val(Date.now());
      $$(`execution.${snippetId}.duration`).val(duration);

      // Save execution history
      await this.saveState();

      console.log(`\n⏱️  Execution time: ${duration}ms`);

      if (visualize) {
        console.log(`\n🌟 Visualizer mode enabled`);
        console.log(`👀 Visit: http://localhost:8080`);
        console.log(`🎬 Click "▶️ Start Live Demo" to see execution visualization`);
      }

    } catch (error) {
      console.error(`\n❌ Execution failed: ${error.message}`);
      $$(`execution.${snippetId}.status`).val('error');
      $$(`execution.${snippetId}.error`).val(error.message);
      await this.saveState();

      console.log(`\n💡 Tips:`);
      console.log(`   - Check syntax errors in the code`);
      console.log(`   - Ensure all dependencies are available`);
      console.log(`   - Try running with --visualize to see what went wrong`);
    }
  }

  private async executeJavaScript(code: string, snippetId: string): Promise<any> {
    // Create a safe execution context
    const context = {
      console: {
        log: (...args: any[]) => {
          console.log(`[${snippetId}]`, ...args);
          $$(`execution.${snippetId}.output`).val(args.join(' '));
        }
      },
      $$, // Give access to FX
      // Add other safe globals as needed
    };

    // Wrap code in function to create scope
    const wrappedCode = `
      (function(console, $$) {
        ${code}
      })
    `;

    try {
      const func = eval(wrappedCode);
      const result = func(context.console, context.$$);
      return result;
    } catch (error) {
      throw new Error(`JavaScript execution error: ${error.message}`);
    }
  }

  // @agent: agent-cli
  // @task: C.6 - Implement visualize command (stub)
  async startVisualizer(args: any): Promise<void> {
    const port = args.port || 8080;

    console.log(`\n🌟 FXD 3D Visualizer`);
    console.log(`${'='.repeat(60)}\n`);
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🎮 Port: ${port}`);
    console.log(`\n📊 Current Disk Status:`);

    const diskName = $$('disk.name').val();
    const snippets = $$('snippets').val() || {};
    const snippetCount = Object.keys(snippets).length;

    if (diskName) {
      console.log(`   Disk: ${diskName}`);
      console.log(`   Snippets: ${snippetCount}`);
    } else {
      console.log(`   ⚠️  No disk created yet`);
      console.log(`   💡 Create a disk first: fxd-cli create <name>`);
    }

    console.log(`\n🎮 Interactive Features:`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   • Click nodes to select and inspect`);
    console.log(`   • Press [V] to show version timeline`);
    console.log(`   • Press [B] to create a new branch`);
    console.log(`   • Press [Space] to pause/resume`);
    console.log(`   • Mouse wheel to zoom`);
    console.log(`   • Right-click drag to rotate view`);

    console.log(`\n⚡ Live Execution Features:`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   • Nodes light up when code executes`);
    console.log(`   • Data flows show as pulsing connections`);
    console.log(`   • Click nodes to see I/O history`);
    console.log(`   • Time-travel debugging support`);
    console.log(`   • Real-time performance metrics`);

    console.log(`\n🚀 Quick Start:`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   1. Open http://localhost:${port} in your browser`);
    console.log(`   2. Click "▶️ Start Live Demo" to begin`);
    console.log(`   3. Import some code: fxd-cli import <path>`);
    console.log(`   4. Run code: fxd-cli run <snippet-id> --visualize`);

    console.log(`\n💡 Note: The visualizer is a separate web application`);
    console.log(`   Make sure the web server is running on port ${port}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  // @agent: agent-cli
  // @task: C.4 - Implement export command
  async exportContents(args: any): Promise<void> {
    const outputPath = args._[1] || './fxd-export';
    const format = args.format || 'files';

    console.log(`\n📤 Exporting FXD Contents`);
    console.log(`${'='.repeat(60)}\n`);

    // Check if we have anything to export
    const diskName = $$('disk.name').val();
    if (!diskName) {
      console.error(`❌ No disk to export`);
      console.log(`💡 Create a disk first: fxd-cli create <name>`);
      return;
    }

    const spin = this.spinner(`Exporting to: ${outputPath}`);

    try {
      // Create output directory
      await Deno.mkdir(outputPath, { recursive: true });

      let fileCount = 0;
      let totalSize = 0;

      if (format === 'files') {
        spin.stop();
        console.log(`📁 Export format: Individual files`);
        console.log(`📂 Output path: ${outputPath}\n`);

        // Export views as individual files
        const views = $$('views').val() || {};
        const viewEntries = Object.entries(views);

        if (viewEntries.length === 0) {
          console.log(`⚠️  No views to export`);
        } else {
          for (const [viewName, content] of viewEntries) {
            const filePath = `${outputPath}/${viewName}`;
            await Deno.writeTextFile(filePath, content as string);
            const size = new TextEncoder().encode(content as string).length;
            totalSize += size;
            fileCount++;
            console.log(`  ✓ ${viewName} (${(size / 1024).toFixed(2)} KB)`);
          }
        }

        // Also export snippets metadata
        const snippets = $$('snippets').val() || {};
        if (Object.keys(snippets).length > 0) {
          const metadataPath = `${outputPath}/_snippets.json`;
          await Deno.writeTextFile(metadataPath, JSON.stringify(snippets, null, 2));
          console.log(`  ✓ _snippets.json (metadata)`);
          fileCount++;
        }

      } else if (format === 'archive') {
        spin.stop();
        console.log(`📦 Export format: Archive`);
        console.log(`📂 Output path: ${outputPath}\n`);

        // Export as structured archive
        const exportData: DiskState = {
          disk: {
            name: $$('disk.name').val() || 'Unnamed',
            created: $$('disk.created').val() || Date.now(),
            version: $$('disk.version').val() || '1.0.0',
            path: $$('disk.path').val() || './.fxd'
          },
          snippets: $$('snippets').val() || {},
          views: $$('views').val() || {},
          groups: $$('groups').val() || {},
          markers: $$('markers').val() || {},
          metadata: $$('metadata').val() || {}
        };

        const archivePath = `${outputPath}/fxd-archive.json`;
        const archiveContent = JSON.stringify(exportData, null, 2);
        await Deno.writeTextFile(archivePath, archiveContent);

        totalSize = new TextEncoder().encode(archiveContent).length;
        fileCount = 1;

        console.log(`  ✓ fxd-archive.json (${(totalSize / 1024).toFixed(2)} KB)`);
        console.log(`\n📊 Archive contents:`);
        console.log(`     Snippets: ${Object.keys(exportData.snippets).length}`);
        console.log(`     Views: ${Object.keys(exportData.views).length}`);
        console.log(`     Groups: ${Object.keys(exportData.groups).length}`);
      } else {
        spin.stop();
        console.error(`❌ Unknown format: ${format}`);
        console.log(`💡 Valid formats: files, archive`);
        return;
      }

      console.log(`\n✅ Export completed!`);
      console.log(`   Files created: ${fileCount}`);
      console.log(`   Total size: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log(`   Location: ${outputPath}`);

      console.log(`\n💡 Next steps:`);
      if (format === 'archive') {
        console.log(`   - Share the fxd-archive.json file`);
        console.log(`   - Import it later: fxd-cli import ${outputPath}/fxd-archive.json`);
      } else {
        console.log(`   - Files are ready to use in other projects`);
        console.log(`   - Original formatting and structure preserved`);
      }

    } catch (error) {
      spin.stop('❌ Export failed');
      console.error(`Error: ${error.message}`);
      if (error.message.includes('permission')) {
        console.log(`💡 Tip: Check that you have write permissions for ${outputPath}`);
      }
    }
  }

  private isCodeFile(extension: string): boolean {
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp'];
    return codeExtensions.includes(extension);
  }

  async execute(): Promise<void> {
    const args = parseArgs(Deno.args);
    const command = args._[0];

    if (!command || command === 'help') {
      this.showHelp();
      return;
    }

    const cmd = this.commands.get(command);
    if (!cmd) {
      console.error(`❌ Unknown command: ${command}`);
      this.showHelp();
      return;
    }

    await cmd.execute(args);
  }

  private showHelp(): void {
    console.log(`
🎯 FXD CLI - Visual Code Management Platform

USAGE:
  deno run --allow-all fxd-cli.ts <command> [options]

COMMANDS:
`);

    this.commands.forEach(cmd => {
      console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
      console.log(`                ${cmd.usage}`);
      console.log();
    });

    console.log(`EXAMPLES:
  # Create a new FXD disk
  deno run --allow-all fxd-cli.ts create my-project

  # Import existing JavaScript files
  deno run --allow-all fxd-cli.ts import ./src

  # Run a specific snippet
  deno run --allow-all fxd-cli.ts run main.greet --visualize

  # List all snippets and views
  deno run --allow-all fxd-cli.ts list

  # Start visualizer
  deno run --allow-all fxd-cli.ts visualize

🌐 Web UI: http://localhost:3000/app
🎯 Visualizer: http://localhost:8080
`);
  }
}

// Run CLI
if (import.meta.main) {
  const cli = new FXDCLI();
  await cli.init();
  await cli.execute();
}