#!/usr/bin/env deno run --allow-all

/**
 * Enhanced FXD CLI with full persistence integration
 * Combines the original CLI with SQLite-based .fxd file support
 */

import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";
import { FXDisk } from "../modules/fx-persistence-deno.ts";
import { $$, $_$$ } from '../fx.ts';

const $disk = $_$$;

interface CLICommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: any) => Promise<void>;
}

class EnhancedFXDCLI {
  private commands: Map<string, CLICommand> = new Map();
  private currentDisk: FXDisk | null = null;
  private currentPath: string = "";

  constructor() {
    this.registerCommands();
  }

  private registerCommands(): void {
    // Save command - saves current state to .fxd file
    this.commands.set('save', {
      name: 'save',
      description: 'Save current FX state to .fxd file',
      usage: 'fxd save <filename.fxd>',
      execute: async (args) => {
        const filename = args._[1] || 'project.fxd';
        const path = filename.endsWith('.fxd') ? filename : `${filename}.fxd`;

        console.log(`💾 Saving to ${path}...`);

        try {
          // Create new FXDisk instance
          const disk = new FXDisk(path, true);

          // Save all current state
          disk.save();

          // Get stats
          const stats = disk.stats();

          console.log(`✅ Saved successfully!`);
          console.log(`   📊 Statistics:`);
          console.log(`      • Nodes: ${stats.nodes}`);
          console.log(`      • Snippets: ${stats.snippets}`);
          console.log(`      • Views: ${stats.views}`);

          // Close the database
          disk.close();
        } catch (error) {
          console.error(`❌ Error saving: ${error.message}`);
        }
      }
    });

    // Load command - loads state from .fxd file
    this.commands.set('load', {
      name: 'load',
      description: 'Load FX state from .fxd file',
      usage: 'fxd load <filename.fxd>',
      execute: async (args) => {
        const filename = args._[1];
        if (!filename) {
          console.error('❌ Please specify a filename');
          return;
        }

        const path = filename.endsWith('.fxd') ? filename : `${filename}.fxd`;

        console.log(`📂 Loading from ${path}...`);

        try {
          // Check if file exists
          const stat = await Deno.stat(path);
          if (!stat.isFile) {
            throw new Error('Not a valid file');
          }

          // Open existing FXDisk
          const disk = new FXDisk(path, false);

          // Load the state
          disk.load();

          // Get stats
          const stats = disk.stats();

          console.log(`✅ Loaded successfully!`);
          console.log(`   📊 Statistics:`);
          console.log(`      • Nodes: ${stats.nodes}`);
          console.log(`      • Snippets: ${stats.snippets}`);
          console.log(`      • Views: ${stats.views}`);

          // Keep disk reference for future operations
          this.currentDisk = disk;
          this.currentPath = path;

        } catch (error) {
          console.error(`❌ Error loading: ${error.message}`);
        }
      }
    });

    // Import command - imports files into FX state
    this.commands.set('import', {
      name: 'import',
      description: 'Import files or directories into FX state',
      usage: 'fxd import <path> [--save <output.fxd>]',
      execute: async (args) => {
        const importPath = args._[1];
        if (!importPath) {
          console.error('❌ Please specify a path to import');
          return;
        }

        console.log(`📥 Importing from ${importPath}...`);

        try {
          const stat = await Deno.stat(importPath);

          if (stat.isFile) {
            await this.importFile(importPath);
          } else if (stat.isDirectory) {
            await this.importDirectory(importPath);
          }

          // Auto-save if specified
          if (args.save) {
            const savePath = args.save.endsWith('.fxd') ? args.save : `${args.save}.fxd`;
            const disk = new FXDisk(savePath, true);
            disk.save();
            const stats = disk.stats();
            console.log(`💾 Saved to ${savePath} (${stats.nodes} nodes)`);
            disk.close();
          }

          console.log(`✅ Import completed!`);

        } catch (error) {
          console.error(`❌ Error importing: ${error.message}`);
        }
      }
    });

    // Export command - exports FX state to files
    this.commands.set('export', {
      name: 'export',
      description: 'Export FX state to files or JSON',
      usage: 'fxd export <output-dir> [--format json|files|html]',
      execute: async (args) => {
        const outputDir = args._[1] || './export';
        const format = args.format || 'files';

        console.log(`📤 Exporting to ${outputDir} (format: ${format})...`);

        try {
          // Create output directory
          await Deno.mkdir(outputDir, { recursive: true });

          if (format === 'json') {
            await this.exportJSON(outputDir);
          } else if (format === 'html') {
            await this.exportHTML(outputDir);
          } else {
            await this.exportFiles(outputDir);
          }

          console.log(`✅ Export completed!`);

        } catch (error) {
          console.error(`❌ Error exporting: ${error.message}`);
        }
      }
    });

    // Stats command - shows statistics about current state
    this.commands.set('stats', {
      name: 'stats',
      description: 'Show statistics about current FX state',
      usage: 'fxd stats [filename.fxd]',
      execute: async (args) => {
        const filename = args._[1];

        try {
          if (filename) {
            const path = filename.endsWith('.fxd') ? filename : `${filename}.fxd`;
            const disk = new FXDisk(path, false);
            const stats = disk.stats();

            console.log(`📊 Statistics for ${path}:`);
            console.log(`   • Nodes: ${stats.nodes}`);
            console.log(`   • Snippets: ${stats.snippets}`);
            console.log(`   • Views: ${stats.views}`);

            disk.close();
          } else {
            // Show stats for current state
            const snippets = $disk('snippets').val() || {};
            const views = $disk('views').val() || {};
            const groups = $disk('groups').val() || {};

            console.log(`📊 Current State Statistics:`);
            console.log(`   • Snippets: ${Object.keys(snippets).length}`);
            console.log(`   • Views: ${Object.keys(views).length}`);
            console.log(`   • Groups: ${Object.keys(groups).length}`);
          }
        } catch (error) {
          console.error(`❌ Error getting stats: ${error.message}`);
        }
      }
    });

    // List command - lists .fxd files in current directory
    this.commands.set('list', {
      name: 'list',
      description: 'List .fxd files in current directory',
      usage: 'fxd list',
      execute: async (args) => {
        try {
          console.log(`📂 FXD Files in current directory:\n`);

          let found = false;
          for await (const entry of Deno.readDir('.')) {
            if (entry.isFile && entry.name.endsWith('.fxd')) {
              const stat = await Deno.stat(entry.name);
              const size = this.formatFileSize(stat.size);
              const modified = new Date(stat.mtime || 0).toLocaleDateString();

              console.log(`   💾 ${entry.name.padEnd(30)} ${size.padEnd(10)} ${modified}`);
              found = true;
            }
          }

          if (!found) {
            console.log(`   (No .fxd files found)`);
          }

        } catch (error) {
          console.error(`❌ Error listing files: ${error.message}`);
        }
      }
    });

    // Health command - checks FXD system health
    this.commands.set('health', {
      name: 'health',
      description: 'Check FXD system health',
      usage: 'fxd health',
      execute: async (args) => {
        console.log(`🏥 FXD System Health Check\n`);

        const checks = [];

        // Check FX framework
        try {
          const test = $$('test.health').val('ok');
          if ($$('test.health').val() === 'ok') {
            checks.push({ name: 'FX Framework', status: '✅', message: 'Working' });
          }
        } catch (e) {
          checks.push({ name: 'FX Framework', status: '❌', message: e.message });
        }

        // Check persistence module
        try {
          const testPath = '.test-health.fxd';
          const disk = new FXDisk(testPath, true);
          disk.save();
          disk.close();
          await Deno.remove(testPath);
          checks.push({ name: 'Persistence', status: '✅', message: 'SQLite working' });
        } catch (e) {
          checks.push({ name: 'Persistence', status: '❌', message: e.message });
        }

        // Check file system permissions
        try {
          const testFile = '.test-health.txt';
          await Deno.writeTextFile(testFile, 'test');
          await Deno.remove(testFile);
          checks.push({ name: 'File System', status: '✅', message: 'Read/Write OK' });
        } catch (e) {
          checks.push({ name: 'File System', status: '⚠️', message: 'Limited access' });
        }

        // Display results
        for (const check of checks) {
          console.log(`   ${check.status} ${check.name.padEnd(20)} ${check.message}`);
        }

        const allPassed = checks.every(c => c.status === '✅');
        console.log(`\n${allPassed ? '✅ All systems operational' : '⚠️ Some issues detected'}`);
      }
    });

    // Version command
    this.commands.set('version', {
      name: 'version',
      description: 'Show FXD version',
      usage: 'fxd version',
      execute: async (args) => {
        console.log(`FXD CLI v2.0.0 (Enhanced Edition)`);
        console.log(`  • FX Framework: v1.0.0`);
        console.log(`  • Persistence: SQLite-based`);
        console.log(`  • Node Support: Yes`);
        console.log(`  • Deno Support: Yes`);
      }
    });

    // Help command
    this.commands.set('help', {
      name: 'help',
      description: 'Show help information',
      usage: 'fxd help [command]',
      execute: async (args) => {
        const command = args._[1];

        if (command && this.commands.has(command)) {
          const cmd = this.commands.get(command)!;
          console.log(`\n${cmd.name} - ${cmd.description}`);
          console.log(`Usage: ${cmd.usage}\n`);
        } else {
          console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    FXD CLI (Enhanced)                    ║
╠═══════════════════════════════════════════════════════════╣
║  A powerful command-line interface for FX Disk files     ║
╚═══════════════════════════════════════════════════════════╝

Commands:
`);
          for (const [name, cmd] of this.commands) {
            console.log(`  ${name.padEnd(10)} - ${cmd.description}`);
          }

          console.log(`
Examples:
  fxd save project.fxd      # Save current state to file
  fxd load project.fxd      # Load state from file
  fxd import ./src          # Import directory into FX
  fxd export ./output       # Export FX state to files
  fxd stats                 # Show current statistics
  fxd health                # Check system health

Use 'fxd help <command>' for more information about a command.
`);
        }
      }
    });
  }

  // Helper methods

  private async importFile(filePath: string): Promise<void> {
    const content = await Deno.readTextFile(filePath);
    const name = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'imported';

    // Detect language from extension
    const ext = filePath.split('.').pop() || 'txt';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'html': 'html',
      'css': 'css',
      'json': 'json'
    };

    const language = langMap[ext] || 'text';

    // Create snippet
    $disk(`snippets.${name}`).val({
      id: name,
      content: content,
      language: language,
      file: filePath,
      created: Date.now()
    });

    console.log(`   ✓ Imported: ${filePath} as snippet '${name}'`);
  }

  private async importDirectory(dirPath: string): Promise<void> {
    for await (const entry of Deno.readDir(dirPath)) {
      const fullPath = `${dirPath}/${entry.name}`;

      if (entry.isFile && !entry.name.startsWith('.')) {
        await this.importFile(fullPath);
      } else if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.importDirectory(fullPath);
      }
    }
  }

  private async exportJSON(outputDir: string): Promise<void> {
    const state = {
      snippets: $disk('snippets').val() || {},
      views: $disk('views').val() || {},
      groups: $disk('groups').val() || {},
      metadata: {
        exported: new Date().toISOString(),
        version: '2.0.0'
      }
    };

    const outputPath = `${outputDir}/export.json`;
    await Deno.writeTextFile(outputPath, JSON.stringify(state, null, 2));
    console.log(`   ✓ Exported to ${outputPath}`);
  }

  private async exportHTML(outputDir: string): Promise<void> {
    const snippets = $disk('snippets').val() || {};
    const views = $disk('views').val() || {};

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>FXD Export</title>
  <style>
    body { font-family: system-ui; margin: 40px; }
    .snippet { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .snippet h3 { margin-top: 0; }
    pre { background: #f5f5f5; padding: 15px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>FXD Export</h1>
  <p>Exported on: ${new Date().toLocaleString()}</p>

  <h2>Snippets (${Object.keys(snippets).length})</h2>
`;

    for (const [id, snippet] of Object.entries(snippets)) {
      const s = snippet as any;
      html += `
  <div class="snippet">
    <h3>${id}</h3>
    <p>Language: ${s.language || 'unknown'}</p>
    <pre><code>${this.escapeHtml(s.content || '')}</code></pre>
  </div>
`;
    }

    html += `
  <h2>Views (${Object.keys(views).length})</h2>
`;

    for (const [id, view] of Object.entries(views)) {
      html += `
  <div class="snippet">
    <h3>${id}</h3>
    <pre><code>${this.escapeHtml(typeof view === 'string' ? view : JSON.stringify(view, null, 2))}</code></pre>
  </div>
`;
    }

    html += `
</body>
</html>`;

    const outputPath = `${outputDir}/export.html`;
    await Deno.writeTextFile(outputPath, html);
    console.log(`   ✓ Exported to ${outputPath}`);
  }

  private async exportFiles(outputDir: string): Promise<void> {
    const snippets = $disk('snippets').val() || {};

    // Create snippets directory
    const snippetsDir = `${outputDir}/snippets`;
    await Deno.mkdir(snippetsDir, { recursive: true });

    for (const [id, snippet] of Object.entries(snippets)) {
      const s = snippet as any;
      const ext = this.getExtension(s.language || 'text');
      const filename = `${id}.${ext}`;
      const filePath = `${snippetsDir}/${filename}`;

      await Deno.writeTextFile(filePath, s.content || '');
      console.log(`   ✓ Exported: ${filename}`);
    }
  }

  private getExtension(language: string): string {
    const extMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'rust': 'rs',
      'go': 'go',
      'java': 'java',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'text': 'txt'
    };

    return extMap[language] || 'txt';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async run(args: string[]): Promise<void> {
    const parsed = parseArgs(args);
    const command = parsed._[0] as string;

    if (!command || command === 'help') {
      await this.commands.get('help')!.execute(parsed);
      return;
    }

    if (this.commands.has(command)) {
      await this.commands.get(command)!.execute(parsed);
    } else {
      console.error(`❌ Unknown command: ${command}`);
      console.log(`Run 'fxd help' to see available commands`);
    }
  }
}

// Main entry point
if (import.meta.main) {
  const cli = new EnhancedFXDCLI();
  await cli.run(Deno.args);
}