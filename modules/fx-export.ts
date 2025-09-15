/**
 * FX Export System - Materialize FXD content to real filesystems
 * Leverages fx-time-travel for versioned exports and fx-safe for resilience
 */

import { $$ } from '../fx.ts';
import { FXTimeTravelPlugin } from '../plugins/fx-time-travel.ts';
import { FXSafePlugin } from '../plugins/fx-safe.ts';

interface ExportOptions {
  format?: 'files' | 'archive' | 'bundle' | 'static-site' | 'npm-package' | 'docker';
  includeMarkers?: boolean;
  overwrite?: boolean;
  createDirectories?: boolean;
  preserveStructure?: boolean;
  minify?: boolean;
  sourceMaps?: boolean;
  version?: string;
  metadata?: Record<string, any>;
  excludePatterns?: string[];
  transformRules?: TransformRule[];
}

interface TransformRule {
  match: string | RegExp;
  transform: (content: string, context: ExportContext) => string;
  description: string;
}

interface ExportContext {
  filePath: string;
  language: string;
  snippets: string[];
  metadata: Record<string, any>;
  targetFormat: string;
}

interface ExportResult {
  filesCreated: number;
  totalSize: number;
  duration: number;
  errors: string[];
  warnings: string[];
  manifest?: any;
}

export class FXExportEngine {
  private timeTravel: FXTimeTravelPlugin;
  private safe: FXSafePlugin;

  constructor(fx = $$) {
    this.timeTravel = new FXTimeTravelPlugin(fx as any);
    this.safe = new FXSafePlugin(fx as any);
  }

  async exportView(viewId: string, outputPath: string, options: ExportOptions = {}): Promise<ExportResult> {
    const opts = this.normalizeOptions(options);
    const startTime = Date.now();

    console.log(`📤 Exporting view: ${viewId} -> ${outputPath}`);

    try {
      // Create snapshot for versioned export
      const snapshot = this.timeTravel.snapshot(`Export ${viewId}`);

      const view = $$(`views.${viewId}`).val();
      if (!view) {
        throw new Error(`View not found: ${viewId}`);
      }

      // Ensure output directory exists
      if (opts.createDirectories) {
        await Deno.mkdir(outputPath.split('/').slice(0, -1).join('/'), { recursive: true });
      }

      let content = view;

      // Apply transformations
      if (opts.transformRules) {
        content = this.applyTransforms(content, {
          filePath: outputPath,
          language: this.detectLanguageFromPath(outputPath),
          snippets: [],
          metadata: opts.metadata || {},
          targetFormat: opts.format || 'files'
        }, opts.transformRules);
      }

      // Write file using fx-safe for resilience
      await this.safe.timeout(`export-${viewId}`, async () => {
        await Deno.writeTextFile(outputPath, content);
      }, 10000);

      const result: ExportResult = {
        filesCreated: 1,
        totalSize: content.length,
        duration: Date.now() - startTime,
        errors: [],
        warnings: []
      };

      console.log(`✅ Exported ${viewId} (${this.formatBytes(result.totalSize)})`);
      return result;

    } catch (error) {
      console.error(`❌ Export failed for ${viewId}:`, error);
      throw error;
    }
  }

  async exportAll(targetDir: string, options: ExportOptions = {}): Promise<ExportResult> {
    const opts = this.normalizeOptions(options);
    const startTime = Date.now();

    console.log(`📦 Exporting entire FXD to: ${targetDir}`);

    // Create export manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      fxdVersion: '2.0.0',
      format: opts.format,
      options: opts,
      contents: {
        snippets: {},
        views: {},
        groups: {},
        metadata: {}
      }
    };

    const result: ExportResult = {
      filesCreated: 0,
      totalSize: 0,
      duration: 0,
      errors: [],
      warnings: [],
      manifest
    };

    try {
      // Create target directory
      await Deno.mkdir(targetDir, { recursive: true });

      switch (opts.format) {
        case 'files':
          await this.exportAsFiles(targetDir, opts, result);
          break;
        case 'archive':
          await this.exportAsArchive(targetDir, opts, result);
          break;
        case 'bundle':
          await this.exportAsBundle(targetDir, opts, result);
          break;
        case 'static-site':
          await this.exportAsStaticSite(targetDir, opts, result);
          break;
        case 'npm-package':
          await this.exportAsNpmPackage(targetDir, opts, result);
          break;
        case 'docker':
          await this.exportAsDocker(targetDir, opts, result);
          break;
        default:
          await this.exportAsFiles(targetDir, opts, result);
      }

      // Write manifest
      await Deno.writeTextFile(
        `${targetDir}/fxd-manifest.json`,
        JSON.stringify(result.manifest, null, 2)
      );

      result.duration = Date.now() - startTime;

      console.log(`✅ Export completed:`);
      console.log(`   📄 Files: ${result.filesCreated}`);
      console.log(`   📊 Size: ${this.formatBytes(result.totalSize)}`);
      console.log(`   ⏱️ Duration: ${result.duration}ms`);

      return result;

    } catch (error) {
      console.error(`❌ Export failed:`, error);
      result.errors.push(`Export failed: ${error.message}`);
      throw error;
    }
  }

  private async exportAsFiles(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    // Export views as individual files
    const views = $$('views').val() || {};

    for (const [viewId, content] of Object.entries(views)) {
      const filePath = `${targetDir}/${viewId}`;
      const dirPath = filePath.split('/').slice(0, -1).join('/');

      if (dirPath !== targetDir) {
        await Deno.mkdir(dirPath, { recursive: true });
      }

      await Deno.writeTextFile(filePath, content as string);

      result.filesCreated++;
      result.totalSize += (content as string).length;

      console.log(`  ✓ Exported: ${viewId}`);
    }

    // Export snippets as separate directory
    const snippets = $$('snippets').val() || {};
    const snippetsDir = `${targetDir}/snippets`;
    await Deno.mkdir(snippetsDir, { recursive: true });

    for (const [snippetId, snippet] of Object.entries(snippets)) {
      const snip = snippet as any;
      const fileName = `${snippetId}.${this.getExtension(snip.language)}`;
      const filePath = `${snippetsDir}/${fileName}`;

      let content = snip.content || '';

      // Add metadata header
      if (options.includeMarkers) {
        const header = [
          `/* FX Snippet: ${snippetId} */`,
          `/* Language: ${snip.language} */`,
          `/* Created: ${new Date(snip.created).toISOString()} */`,
          `/* Type: ${snip.type || 'unknown'} */`,
          ''
        ].join('\n');

        content = header + content;
      }

      await Deno.writeTextFile(filePath, content);

      result.filesCreated++;
      result.totalSize += content.length;
    }
  }

  private async exportAsArchive(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    // Export as structured JSON archive
    const archive = {
      metadata: {
        exported: new Date().toISOString(),
        fxdVersion: '2.0.0',
        diskName: $$('disk.name').val() || 'FXD-Export'
      },
      snippets: $$('snippets').val() || {},
      views: $$('views').val() || {},
      groups: $$('groups').val() || {},
      system: {
        disk: $$('disk').val() || {},
        execution: $$('execution').val() || {}
      }
    };

    const archivePath = `${targetDir}/fxd-archive.json`;
    const content = JSON.stringify(archive, null, 2);

    await Deno.writeTextFile(archivePath, content);

    result.filesCreated = 1;
    result.totalSize = content.length;
    result.manifest!.contents = archive;

    console.log(`  ✓ Created archive: fxd-archive.json`);
  }

  private async exportAsBundle(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    // Bundle all code into optimized files
    const views = $$('views').val() || {};
    const bundleName = options.metadata?.name || 'fxd-bundle';

    // Separate by language
    const jsFiles: string[] = [];
    const tsFiles: string[] = [];
    const cssFiles: string[] = [];
    const otherFiles: string[] = [];

    Object.entries(views).forEach(([viewId, content]) => {
      const lang = this.detectLanguageFromPath(viewId);
      const fileContent = content as string;

      switch (lang) {
        case 'javascript':
          jsFiles.push(fileContent);
          break;
        case 'typescript':
          tsFiles.push(fileContent);
          break;
        case 'css':
          cssFiles.push(fileContent);
          break;
        default:
          otherFiles.push(`// ${viewId}\n${fileContent}`);
      }
    });

    // Create bundled files
    if (jsFiles.length > 0) {
      const jsBundle = jsFiles.join('\n\n');
      await Deno.writeTextFile(`${targetDir}/${bundleName}.js`, jsBundle);
      result.filesCreated++;
      result.totalSize += jsBundle.length;
    }

    if (tsFiles.length > 0) {
      const tsBundle = tsFiles.join('\n\n');
      await Deno.writeTextFile(`${targetDir}/${bundleName}.ts`, tsBundle);
      result.filesCreated++;
      result.totalSize += tsBundle.length;
    }

    if (cssFiles.length > 0) {
      const cssBundle = cssFiles.join('\n\n');
      await Deno.writeTextFile(`${targetDir}/${bundleName}.css`, cssBundle);
      result.filesCreated++;
      result.totalSize += cssBundle.length;
    }
  }

  private async exportAsStaticSite(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    // Create static website from FXD content
    const siteStructure = {
      'index.html': this.generateIndexHTML(),
      'assets/': {
        'style.css': this.generateSiteCSS(),
        'script.js': this.generateSiteJS()
      },
      'pages/': {}
    };

    // Create directory structure
    await Deno.mkdir(`${targetDir}/assets`, { recursive: true });
    await Deno.mkdir(`${targetDir}/pages`, { recursive: true });

    // Generate pages from views
    const views = $$('views').val() || {};
    for (const [viewId, content] of Object.entries(views)) {
      const htmlContent = this.wrapInHTML(content as string, viewId);
      await Deno.writeTextFile(`${targetDir}/pages/${viewId}.html`, htmlContent);
      result.filesCreated++;
      result.totalSize += htmlContent.length;
    }

    // Write main files
    await Deno.writeTextFile(`${targetDir}/index.html`, siteStructure['index.html']);
    await Deno.writeTextFile(`${targetDir}/assets/style.css`, siteStructure['assets/'].style.css);
    await Deno.writeTextFile(`${targetDir}/assets/script.js`, siteStructure['assets/'].script.js);

    result.filesCreated += 3;
    result.totalSize += siteStructure['index.html'].length +
                        siteStructure['assets/'].style.css.length +
                        siteStructure['assets/'].script.js.length;
  }

  private async exportAsNpmPackage(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    const packageName = options.metadata?.name || 'fxd-package';
    const version = options.version || '1.0.0';

    // Create package.json
    const packageJson = {
      name: packageName,
      version,
      description: 'Generated from FXD',
      main: 'index.js',
      types: 'index.d.ts',
      scripts: {
        build: 'tsc',
        test: 'jest',
        dev: 'nodemon'
      },
      dependencies: {},
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0'
      },
      keywords: ['fxd', 'generated'],
      author: 'FXD Export System',
      license: 'MIT'
    };

    await Deno.writeTextFile(
      `${targetDir}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    // Export TypeScript files
    await this.exportAsFiles(targetDir, options, result);

    // Generate index files
    await this.generatePackageIndex(targetDir, result);

    result.filesCreated += 2; // package.json + index files
  }

  private async exportAsDocker(targetDir: string, options: Required<ExportOptions>, result: ExportResult): Promise<void> {
    // Generate Dockerfile
    const dockerfile = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
`;

    await Deno.writeTextFile(`${targetDir}/Dockerfile`, dockerfile.trim());

    // Generate docker-compose.yml
    const dockerCompose = `
version: '3.8'
services:
  fxd-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
`;

    await Deno.writeTextFile(`${targetDir}/docker-compose.yml`, dockerCompose.trim());

    // Export application files
    await this.exportAsNpmPackage(targetDir, options, result);

    result.filesCreated += 2; // Dockerfile + docker-compose
  }

  // Utility methods
  private normalizeOptions(options: ExportOptions): Required<ExportOptions> {
    return {
      format: options.format || 'files',
      includeMarkers: options.includeMarkers ?? true,
      overwrite: options.overwrite ?? false,
      createDirectories: options.createDirectories ?? true,
      preserveStructure: options.preserveStructure ?? true,
      minify: options.minify ?? false,
      sourceMaps: options.sourceMaps ?? false,
      version: options.version || '1.0.0',
      metadata: options.metadata || {},
      excludePatterns: options.excludePatterns || [],
      transformRules: options.transformRules || []
    };
  }

  private applyTransforms(content: string, context: ExportContext, rules: TransformRule[]): string {
    let result = content;

    for (const rule of rules) {
      try {
        if (typeof rule.match === 'string') {
          if (context.filePath.includes(rule.match)) {
            result = rule.transform(result, context);
          }
        } else if (rule.match instanceof RegExp) {
          if (rule.match.test(context.filePath)) {
            result = rule.transform(result, context);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Transform rule failed: ${rule.description}`, error);
      }
    }

    return result;
  }

  private detectLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
      'py': 'python', 'rs': 'rust', 'go': 'go', 'java': 'java',
      'c': 'c', 'cpp': 'cpp', 'css': 'css', 'html': 'html'
    };
    return langMap[ext || ''] || 'text';
  }

  private getExtension(language: string): string {
    const extMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'rust': 'rs',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'css': 'css',
      'html': 'html',
      'markdown': 'md',
      'json': 'json',
      'yaml': 'yaml'
    };
    return extMap[language] || 'txt';
  }

  private generateIndexHTML(): string {
    const diskName = $$('disk.name').val() || 'FXD Export';
    const snippetCount = Object.keys($$('snippets').val() || {}).length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${diskName}</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <header>
        <h1>${diskName}</h1>
        <p>Generated from FXD - ${snippetCount} snippets</p>
    </header>

    <main>
        <section class="overview">
            <h2>FXD Export Overview</h2>
            <p>This site was generated from an FXD disk containing ${snippetCount} code snippets.</p>
        </section>

        <section class="navigation">
            <h2>Pages</h2>
            <div id="page-list"></div>
        </section>
    </main>

    <script src="assets/script.js"></script>
</body>
</html>`;
  }

  private generateSiteCSS(): string {
    return `
/* FXD Generated Site Styles */
body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    margin: 0;
    padding: 0;
    background: #f5f5f5;
    color: #333;
}

header {
    background: #1a1a1a;
    color: white;
    padding: 2rem;
    text-align: center;
}

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.overview, .navigation {
    background: white;
    padding: 2rem;
    margin: 1rem 0;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

pre {
    background: #1a1a1a;
    color: #f8f8f2;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
}
`;
  }

  private generateSiteJS(): string {
    return `
// FXD Generated Site JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Generate page navigation
    const pageList = document.getElementById('page-list');
    if (pageList) {
        // This would be populated with actual page links
        pageList.innerHTML = '<p>Loading pages...</p>';
    }
});
`;
  }

  private wrapInHTML(content: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
    <header>
        <h1>${title}</h1>
        <nav><a href="../index.html">← Back to Index</a></nav>
    </header>

    <main>
        <pre><code>${this.escapeHTML(content)}</code></pre>
    </main>
</body>
</html>`;
  }

  private async generatePackageIndex(targetDir: string, result: ExportResult): Promise<void> {
    // Generate index.js
    const views = $$('views').val() || {};
    const exports = Object.keys(views)
      .filter(view => view.endsWith('.js') || view.endsWith('.ts'))
      .map(view => {
        const name = view.replace(/\.[jt]sx?$/, '');
        return `export { default as ${this.toCamelCase(name)} } from './${view}';`;
      });

    const indexContent = exports.join('\n');
    await Deno.writeTextFile(`${targetDir}/index.js`, indexContent);

    // Generate index.d.ts
    const typeExports = exports.map(exp => exp.replace('export {', 'export declare {'));
    const typesContent = typeExports.join('\n');
    await Deno.writeTextFile(`${targetDir}/index.d.ts`, typesContent);
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export helper functions
export function exportView(viewId: string, outputPath: string, options: ExportOptions = {}): Promise<ExportResult> {
  const exporter = new FXExportEngine();
  return exporter.exportView(viewId, outputPath, options);
}

export function exportEntireDisk(targetDir: string, options: ExportOptions = {}): Promise<ExportResult> {
  const exporter = new FXExportEngine();
  return exporter.exportAll(targetDir, options);
}

// Advanced export with custom transforms
export const TRANSFORM_RULES = {
  minifyJS: {
    match: /\.js$/,
    transform: (content: string) => content.replace(/\s+/g, ' ').trim(),
    description: 'Minify JavaScript'
  },

  addTimestamp: {
    match: /\.(js|ts)$/,
    transform: (content: string) => `// Generated at ${new Date().toISOString()}\n${content}`,
    description: 'Add generation timestamp'
  },

  removeComments: {
    match: /.*/,
    transform: (content: string) => content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
    description: 'Remove comments'
  }
};