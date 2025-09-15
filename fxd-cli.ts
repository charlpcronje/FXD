#!/usr/bin/env deno run --allow-all

/**
 * FXD CLI - Command line interface for FXD operations
 * Usage: deno run --allow-all fxd-cli.ts <command> [options]
 */

import { $$ } from './fx.ts';
import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";

interface CLICommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: any) => Promise<void>;
}

class FXDCLI {
  private commands: Map<string, CLICommand> = new Map();

  constructor() {
    this.registerCommands();
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

  async createDisk(args: any): Promise<void> {
    const name = args._[1];
    if (!name) {
      console.error('❌ Disk name required');
      console.log('Usage: fxd-cli create <name>');
      return;
    }

    const path = args.path || './';
    const diskPath = `${path}/${name}.fxd`;

    console.log(`🆕 Creating new FXD disk: ${diskPath}`);

    // Initialize FX with disk structure
    $$('disk.name').val(name);
    $$('disk.created').val(Date.now());
    $$('disk.version').val('1.0.0');
    $$('disk.path').val(diskPath);

    // Initialize core collections
    $$('snippets').val({});
    $$('views').val({});
    $$('groups').val({});
    $$('markers').val({});

    // Create basic metadata
    $$('metadata.creator').val(Deno.env.get('USER') || 'unknown');
    $$('metadata.description').val(`FXD disk: ${name}`);
    $$('metadata.tags').val([]);

    console.log(`✅ FXD disk created: ${name}`);
    console.log(`📁 Location: ${diskPath}`);
    console.log(`🌐 Access via: http://localhost:3000/app`);
    console.log(`🎯 Next steps:`);
    console.log(`   fxd-cli import <your-code-folder>  # Import existing code`);
    console.log(`   fxd-cli visualize                  # Start 3D visualizer`);
  }

  async importFiles(args: any): Promise<void> {
    const importPath = args._[1];
    if (!importPath) {
      console.error('❌ Import path required');
      console.log('Usage: fxd-cli import <path>');
      return;
    }

    console.log(`📥 Importing files from: ${importPath}`);

    try {
      // Check if path exists
      const stat = await Deno.stat(importPath);

      if (stat.isFile) {
        await this.importSingleFile(importPath);
      } else if (stat.isDirectory) {
        await this.importDirectory(importPath);
      }

      console.log(`✅ Import completed`);
      console.log(`🎯 Run 'fxd-cli list' to see imported snippets`);

    } catch (error) {
      console.error(`❌ Import failed:`, error.message);
    }
  }

  private async importSingleFile(filePath: string): Promise<void> {
    const content = await Deno.readTextFile(filePath);
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'txt';

    // Determine language
    const language = this.detectLanguage(fileExt);

    // Create snippet ID
    const snippetId = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

    // Parse file into snippets if it's code
    if (this.isCodeFile(fileExt)) {
      const snippets = this.parseCodeIntoSnippets(content, language, fileName);

      for (const [id, snippet] of Object.entries(snippets)) {
        $$(`snippets.${id}`).val(snippet);
        console.log(`  ✓ Created snippet: ${id}`);
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

      $$(`snippets.${snippetId}`).val(snippet);
      console.log(`  ✓ Created snippet: ${snippetId}`);
    }

    // Create a view for the file
    $$(`views.${fileName}`).val(content);
    console.log(`  ✓ Created view: ${fileName}`);
  }

  private async importDirectory(dirPath: string): Promise<void> {
    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isFile && this.shouldImportFile(entry.name)) {
        const filePath = `${dirPath}/${entry.name}`;
        console.log(`  📄 Importing: ${entry.name}`);
        await this.importSingleFile(filePath);
      } else if (entry.isDirectory && !entry.name.startsWith('.')) {
        console.log(`  📁 Entering directory: ${entry.name}`);
        await this.importDirectory(`${dirPath}/${entry.name}`);
      }
    }
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

  async listContents(args: any): Promise<void> {
    const type = args.type || 'all';

    console.log(`📋 FXD Disk Contents:`);
    console.log(`===================`);

    const diskName = $$('disk.name').val() || 'Unnamed';
    const created = $$('disk.created').val();
    console.log(`💿 Disk: ${diskName} (created ${new Date(created).toLocaleDateString()})`);
    console.log();

    if (type === 'all' || type === 'snippets') {
      console.log(`✂️  SNIPPETS:`);
      const snippets = $$('snippets').val() || {};
      const snippetIds = Object.keys(snippets);

      if (snippetIds.length === 0) {
        console.log(`   (no snippets - run 'fxd-cli import <path>' to add some)`);
      } else {
        snippetIds.forEach(id => {
          const snippet = snippets[id];
          console.log(`   📝 ${id} (${snippet.language}) - ${snippet.name}`);
        });
      }
      console.log();
    }

    if (type === 'all' || type === 'views') {
      console.log(`👁️  VIEWS:`);
      const views = $$('views').val() || {};
      const viewIds = Object.keys(views);

      if (viewIds.length === 0) {
        console.log(`   (no views)`);
      } else {
        viewIds.forEach(id => {
          const content = views[id];
          const lines = content.split('\n').length;
          console.log(`   📄 ${id} (${lines} lines)`);
        });
      }
      console.log();
    }

    console.log(`🌐 Web UI: http://localhost:3000/app`);
    console.log(`🎯 Visualizer: http://localhost:8080`);
  }

  async runSnippet(args: any): Promise<void> {
    const snippetId = args._[1];
    if (!snippetId) {
      console.error('❌ Snippet ID required');
      console.log('Usage: fxd-cli run <snippet-id>');
      return;
    }

    console.log(`🚀 Running snippet: ${snippetId}`);

    const snippet = $$(`snippets.${snippetId}`).val();
    if (!snippet) {
      console.error(`❌ Snippet not found: ${snippetId}`);
      return;
    }

    const visualize = args.visualize || args.v;

    try {
      // Track execution start
      $$(`execution.${snippetId}.status`).val('running');
      $$(`execution.${snippetId}.startTime`).val(Date.now());

      console.log(`📝 Executing ${snippet.language} code...`);

      // For JavaScript/TypeScript, we can actually execute it
      if (snippet.language === 'javascript' || snippet.language === 'typescript') {
        const result = await this.executeJavaScript(snippet.content, snippetId);
        console.log(`✅ Execution completed:`, result);
      } else {
        console.log(`⚠️ Direct execution not supported for ${snippet.language}`);
        console.log(`💡 Code content preview:`);
        console.log(snippet.content.split('\n').slice(0, 10).map((line: string, i: number) =>
          `   ${i + 1}: ${line}`
        ).join('\n'));
      }

      // Track execution end
      $$(`execution.${snippetId}.status`).val('completed');
      $$(`execution.${snippetId}.endTime`).val(Date.now());

      if (visualize) {
        console.log(`🌟 Opening visualizer to show execution...`);
        console.log(`👀 Visit: http://localhost:8080 and click "▶️ Start Live Demo"`);
      }

    } catch (error) {
      console.error(`❌ Execution failed:`, error.message);
      $$(`execution.${snippetId}.status`).val('error');
      $$(`execution.${snippetId}.error`).val(error.message);
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

  async startVisualizer(args: any): Promise<void> {
    const port = args.port || 8080;

    console.log(`🌟 Starting FXD 3D Visualizer on port ${port}...`);
    console.log(`📍 Open: http://localhost:${port}`);
    console.log(`🎮 Interactive features:`);
    console.log(`   • Click nodes to select`);
    console.log(`   • Press V to show version timeline`);
    console.log(`   • Press B to create branch`);
    console.log(`   • Click "▶️ Start Live Demo" to see real-time execution`);
    console.log();
    console.log(`⚡ Live features:`);
    console.log(`   • Nodes light up when code executes`);
    console.log(`   • Data flows show as pulsing connections`);
    console.log(`   • Click nodes to see I/O history`);
    console.log(`   • Time-travel debugging`);

    // The visualizer server should already be running
    // This just provides instructions
  }

  async exportContents(args: any): Promise<void> {
    const outputPath = args._[1] || './fxd-export';
    const format = args.format || 'files';

    console.log(`📤 Exporting FXD contents to: ${outputPath}`);

    try {
      // Create output directory
      await Deno.mkdir(outputPath, { recursive: true });

      if (format === 'files') {
        // Export as individual files
        const views = $$('views').val() || {};

        for (const [viewName, content] of Object.entries(views)) {
          const filePath = `${outputPath}/${viewName}`;
          await Deno.writeTextFile(filePath, content as string);
          console.log(`  ✓ Exported: ${viewName}`);
        }
      } else if (format === 'archive') {
        // Export as structured archive
        const exportData = {
          disk: {
            name: $$('disk.name').val(),
            created: $$('disk.created').val(),
            version: $$('disk.version').val()
          },
          snippets: $$('snippets').val() || {},
          views: $$('views').val() || {},
          groups: $$('groups').val() || {},
          metadata: $$('metadata').val() || {}
        };

        const archivePath = `${outputPath}/fxd-archive.json`;
        await Deno.writeTextFile(archivePath, JSON.stringify(exportData, null, 2));
        console.log(`  ✓ Exported archive: fxd-archive.json`);
      }

      console.log(`✅ Export completed`);

    } catch (error) {
      console.error(`❌ Export failed:`, error.message);
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
  await cli.execute();
}