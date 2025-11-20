/**
 * FX Commander - Terminal-based file manager for FXD
 * Midnight Commander-style interface with FXD node navigation
 */

import { $$ } from '../fx.ts';

// Enhanced node types based on NodeExtent interface
interface NodeExtent {
  fxId: string;           // $$('fx.drive.A.snippets.42')
  label: string;          // "snippet.greet" or "FunctionDecl greet"
  kind: 'snippet' | 'block' | 'token' | 'metadata' | 'function' | 'class' | 'variable' | 'component' | 'view' | 'group' | 'other';
  byteStart?: number;     // Source location
  byteEnd?: number;
  children?: NodeExtent[];
  tags?: string[];        // ['generated','verified','bad','system']
  snippetRef?: string;    // fx://drive/A/sn/42
}

interface FileItem {
  name: string;
  type: 'directory' | 'snippet' | 'view' | 'node' | 'file' | 'block' | 'token' | 'metadata' | 'function' | 'class' | 'variable' | 'component' | 'group';
  path: string;
  size: number;
  modified: Date;
  isSelected?: boolean;
  nodeExtent?: NodeExtent;
  metadata?: {
    language?: string;
    snippetCount?: number;
    content?: string;
    nodeType?: string;
    tags?: string[];
    byteRange?: { start: number; end: number };
    children?: number;
  };
}

interface PaneState {
  currentPath: string;
  items: FileItem[];
  selectedIndex: number;
  scrollOffset: number;
  title: string;
}

export class FXCommander {
  private terminal: any;
  private isActive = false;
  private leftPane: PaneState;
  private rightPane: PaneState;
  private activePane: 'left' | 'right' = 'left';
  private terminalWidth = 80;
  private terminalHeight = 24;
  private commandMode = false;
  private commandInput = '';
  private statusMessage = '';

  constructor(terminal: any) {
    this.terminal = terminal;

    // Initialize panes
    this.leftPane = {
      currentPath: 'disk:/',
      items: [],
      selectedIndex: 0,
      scrollOffset: 0,
      title: 'FXD Disk'
    };

    this.rightPane = {
      currentPath: 'snippets:/',
      items: [],
      selectedIndex: 0,
      scrollOffset: 0,
      title: 'Snippets'
    };

    this.updateTerminalSize();
  }

  async start(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    this.terminal.clear();

    // Load initial data
    await this.refreshPane(this.leftPane);
    await this.refreshPane(this.rightPane);

    // Setup input handling
    this.setupKeyHandlers();

    // Draw interface
    this.draw();

    console.log('🗂️ FX Commander started');
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.terminal.clear();

    // Return control to normal terminal
    this.terminal.write('\r\nfxd /c/dev/fxd $ ');
  }

  private setupKeyHandlers(): void {
    // Store original onData handler
    const originalHandler = this.terminal._core.coreService.onData;

    this.terminal.onData((data: string) => {
      if (!this.isActive) {
        // Pass through to original handler
        if (originalHandler) originalHandler(data);
        return;
      }

      // Handle FX Commander input
      this.handleInput(data);
    });
  }

  private handleInput(data: string): void {
    const char = data.charCodeAt(0);

    if (this.commandMode) {
      this.handleCommandInput(data);
      return;
    }

    // Navigation keys
    if (char === 27 && data.length === 3) { // Escape sequences
      if (data[2] === 'A') { // Up arrow
        this.moveSelection(-1);
      } else if (data[2] === 'B') { // Down arrow
        this.moveSelection(1);
      } else if (data[2] === 'C') { // Right arrow
        this.switchPane('right');
      } else if (data[2] === 'D') { // Left arrow
        this.switchPane('left');
      }
    } else if (char === 13) { // Enter
      this.activateItem();
    } else if (char === 9) { // Tab
      this.switchPane(this.activePane === 'left' ? 'right' : 'left');
    } else if (char === 27) { // Escape
      this.stop();
      return;
    }

    // Function keys and shortcuts
    switch (data) {
      case '\u001b[21~': // F10
        this.stop();
        return;
      case ':':
        this.enterCommandMode();
        return;
      case 'r':
      case 'R':
        this.refreshCurrentPane();
        break;
      case 'e':
      case 'E':
        this.editCurrentItem();
        break;
      case 'v':
      case 'V':
        this.viewCurrentItem();
        break;
      case 'n':
      case 'N':
        this.createNewItem();
        break;
      case 'd':
      case 'D':
        this.deleteCurrentItem();
        break;
    }

    this.draw();
  }

  private handleCommandInput(data: string): void {
    const char = data.charCodeAt(0);

    if (char === 13) { // Enter
      this.executeCommand();
    } else if (char === 27) { // Escape
      this.exitCommandMode();
    } else if (char === 127) { // Backspace
      this.commandInput = this.commandInput.slice(0, -1);
    } else if (char >= 32 && char <= 126) { // Printable
      this.commandInput += data;
    }

    this.draw();
  }

  private updateTerminalSize(): void {
    // Try to get terminal dimensions
    this.terminalWidth = Math.max(80, this.terminal.cols || 80);
    this.terminalHeight = Math.max(24, this.terminal.rows || 24);
  }

  private async refreshPane(pane: PaneState): Promise<void> {
    pane.items = [];

    if (pane.currentPath.startsWith('disk:/')) {
      await this.loadDiskContents(pane);
    } else if (pane.currentPath.startsWith('snippets:/')) {
      await this.loadSnippets(pane);
    } else if (pane.currentPath.startsWith('views:/')) {
      await this.loadViews(pane);
    } else if (pane.currentPath.startsWith('nodes:/')) {
      await this.loadNodes(pane);
    } else {
      await this.loadFileSystem(pane);
    }

    // Add parent directory entry if not at root
    if (pane.currentPath !== 'disk:/' && pane.currentPath !== '/') {
      pane.items.unshift({
        name: '..',
        type: 'directory',
        path: this.getParentPath(pane.currentPath),
        size: 0,
        modified: new Date()
      });
    }

    // Reset selection
    pane.selectedIndex = Math.max(0, Math.min(pane.selectedIndex, pane.items.length - 1));
  }

  private async loadDiskContents(pane: PaneState): Promise<void> {
    // Load FXD disk structure
    pane.items.push(
      {
        name: 'snippets',
        type: 'directory',
        path: 'snippets:/',
        size: Object.keys($$('snippets').val() || {}).length,
        modified: new Date(),
        metadata: { snippetCount: Object.keys($$('snippets').val() || {}).length }
      },
      {
        name: 'views',
        type: 'directory',
        path: 'views:/',
        size: Object.keys($$('views').val() || {}).length,
        modified: new Date()
      },
      {
        name: 'nodes',
        type: 'directory',
        path: 'nodes:/',
        size: 0,
        modified: new Date()
      }
    );
  }

  private async loadSnippets(pane: PaneState): Promise<void> {
    const snippets = $$('snippets').val() || {};

    for (const [id, snippet] of Object.entries(snippets)) {
      const snip = snippet as any;
      pane.items.push({
        name: id,
        type: 'snippet',
        path: `snippets:/${id}`,
        size: snip.content?.length || 0,
        modified: new Date(snip.created || Date.now()),
        metadata: {
          language: snip.language,
          content: snip.content
        }
      });
    }
  }

  private async loadViews(pane: PaneState): Promise<void> {
    const views = $$('views').val() || {};

    for (const [id, content] of Object.entries(views)) {
      pane.items.push({
        name: id,
        type: 'view',
        path: `views:/${id}`,
        size: (content as string).length,
        modified: new Date()
      });
    }
  }

  private async loadNodes(pane: PaneState): Promise<void> {
    // Load FX node tree
    const nodes = this.getFXNodes();

    nodes.forEach(node => {
      pane.items.push({
        name: node.name,
        type: 'node',
        path: `nodes:/${node.path}`,
        size: 0,
        modified: new Date(),
        metadata: {
          nodeType: node.type
        }
      });
    });
  }

  private async loadFileSystem(pane: PaneState): Promise<void> {
    try {
      const entries = Deno.readDir(pane.currentPath);

      for await (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = `${pane.currentPath}/${entry.name}`;
        let size = 0;
        let modified = new Date();

        try {
          const stat = await Deno.stat(fullPath);
          size = stat.size;
          modified = stat.mtime || new Date();
        } catch {}

        pane.items.push({
          name: entry.name,
          type: entry.isDirectory ? 'directory' : 'file',
          path: fullPath,
          size,
          modified
        });
      }
    } catch {
      // Handle permission errors gracefully
      pane.items.push({
        name: '<access denied>',
        type: 'file',
        path: pane.currentPath,
        size: 0,
        modified: new Date()
      });
    }
  }

  private getFXNodes(): NodeExtent[] {
    // Discover actual FX nodes with proper typing
    const nodes: NodeExtent[] = [];

    // Parse snippets into detailed node structure
    const snippets = $$('snippets').val() || {};

    for (const [snippetId, snippet] of Object.entries(snippets)) {
      const snip = snippet as any;

      // Main snippet node
      const snippetNode: NodeExtent = {
        fxId: `fx.snippets.${snippetId}`,
        label: snip.name || snippetId,
        kind: 'snippet',
        tags: ['user-created'],
        snippetRef: `fx://snippets/${snippetId}`,
        children: []
      };

      // Parse content to find functions, classes, variables
      if (snip.content) {
        const childNodes = this.parseCodeStructure(snip.content, snippetId);
        snippetNode.children = childNodes;
      }

      nodes.push(snippetNode);
    }

    // Add view nodes
    const views = $$('views').val() || {};
    for (const [viewId, content] of Object.entries(views)) {
      nodes.push({
        fxId: `fx.views.${viewId}`,
        label: viewId,
        kind: 'view',
        tags: ['generated'],
        snippetRef: `fx://views/${viewId}`
      });
    }

    // Add metadata nodes
    nodes.push({
      fxId: 'fx.disk.metadata',
      label: 'Disk Metadata',
      kind: 'metadata',
      tags: ['system'],
      children: [
        {
          fxId: 'fx.disk.name',
          label: 'Disk Name',
          kind: 'metadata',
          tags: ['system']
        },
        {
          fxId: 'fx.disk.created',
          label: 'Creation Time',
          kind: 'metadata',
          tags: ['system']
        }
      ]
    });

    return nodes;
  }

  private parseCodeStructure(content: string, snippetId: string): NodeExtent[] {
    const nodes: NodeExtent[] = [];
    const lines = content.split('\n');
    let byteOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Function declarations
      const funcMatch = trimmed.match(/^(?:function|async\s+function|const\s+(\w+)\s*=\s*(?:async\s*)?\()/);
      if (funcMatch) {
        const funcName = funcMatch[1] || trimmed.match(/function\s+(\w+)/)?.[1] || 'anonymous';
        nodes.push({
          fxId: `fx.snippets.${snippetId}.functions.${funcName}`,
          label: `function ${funcName}`,
          kind: 'function',
          byteStart: byteOffset,
          byteEnd: byteOffset + line.length,
          tags: ['parsed', 'executable'],
          snippetRef: `fx://snippets/${snippetId}`
        });
      }

      // Class declarations
      const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        nodes.push({
          fxId: `fx.snippets.${snippetId}.classes.${classMatch[1]}`,
          label: `class ${classMatch[1]}`,
          kind: 'class',
          byteStart: byteOffset,
          byteEnd: byteOffset + line.length,
          tags: ['parsed', 'type'],
          snippetRef: `fx://snippets/${snippetId}`
        });
      }

      // Variable declarations
      const varMatch = trimmed.match(/^(?:const|let|var)\s+(\w+)/);
      if (varMatch) {
        nodes.push({
          fxId: `fx.snippets.${snippetId}.variables.${varMatch[1]}`,
          label: `var ${varMatch[1]}`,
          kind: 'variable',
          byteStart: byteOffset,
          byteEnd: byteOffset + line.length,
          tags: ['parsed'],
          snippetRef: `fx://snippets/${snippetId}`
        });
      }

      // Import/export statements (tokens)
      if (trimmed.startsWith('import') || trimmed.startsWith('export')) {
        nodes.push({
          fxId: `fx.snippets.${snippetId}.tokens.${i}`,
          label: trimmed.substring(0, 30) + '...',
          kind: 'token',
          byteStart: byteOffset,
          byteEnd: byteOffset + line.length,
          tags: ['import-export'],
          snippetRef: `fx://snippets/${snippetId}`
        });
      }

      byteOffset += line.length + 1; // +1 for newline
    }

    return nodes;
  }

  private draw(): void {
    this.terminal.clear();

    // Header
    this.drawHeader();

    // Dual panes
    this.drawPanes();

    // Status bar and taskbar
    this.drawStatusBar();
    this.drawTaskBar();

    // Command input if in command mode
    if (this.commandMode) {
      this.drawCommandInput();
    }
  }

  private drawHeader(): void {
    const title = '═══ FX Commander ═══';
    const padding = Math.max(0, Math.floor((this.terminalWidth - title.length) / 2));

    this.terminal.writeln('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
    this.terminal.writeln('│' + ' '.repeat(padding) + title + ' '.repeat(this.terminalWidth - 2 - padding - title.length) + '│');
    this.terminal.writeln('├' + '─'.repeat(this.terminalWidth - 2) + '┤');
  }

  private drawPanes(): void {
    const paneWidth = Math.floor((this.terminalWidth - 3) / 2);
    const paneHeight = this.terminalHeight - 7; // Reserve space for header, status, taskbar

    // Column headers
    const leftTitle = this.truncate(this.leftPane.title + ' - ' + this.leftPane.currentPath, paneWidth);
    const rightTitle = this.truncate(this.rightPane.title + ' - ' + this.rightPane.currentPath, paneWidth);

    this.terminal.writeln('│' +
      (this.activePane === 'left' ? '►' : ' ') + leftTitle.padEnd(paneWidth - 1) + '│' +
      (this.activePane === 'right' ? '►' : ' ') + rightTitle.padEnd(paneWidth - 1) + '│'
    );

    this.terminal.writeln('├' + '─'.repeat(paneWidth) + '┼' + '─'.repeat(paneWidth) + '┤');

    // File listings
    for (let i = 0; i < paneHeight - 2; i++) {
      const leftItem = this.getVisibleItem(this.leftPane, i);
      const rightItem = this.getVisibleItem(this.rightPane, i);

      const leftText = this.formatFileItem(leftItem, paneWidth,
        this.activePane === 'left' && this.leftPane.selectedIndex - this.leftPane.scrollOffset === i);
      const rightText = this.formatFileItem(rightItem, paneWidth,
        this.activePane === 'right' && this.rightPane.selectedIndex - this.rightPane.scrollOffset === i);

      this.terminal.writeln('│' + leftText + '│' + rightText + '│');
    }

    this.terminal.writeln('├' + '─'.repeat(paneWidth) + '┼' + '─'.repeat(paneWidth) + '┤');
  }

  private getVisibleItem(pane: PaneState, index: number): FileItem | null {
    const actualIndex = pane.scrollOffset + index;
    return actualIndex < pane.items.length ? pane.items[actualIndex] : null;
  }

  private formatFileItem(item: FileItem | null, width: number, isSelected: boolean): string {
    if (!item) {
      return ' '.repeat(width);
    }

    const icon = this.getFileIcon(item);
    const size = this.formatSize(item.size);
    const maxNameLength = width - icon.length - size.length - 3;
    const name = this.truncate(item.name, maxNameLength);

    let text = icon + name.padEnd(maxNameLength) + ' ' + size;
    text = text.substring(0, width);

    if (isSelected) {
      // Simple highlighting with > marker
      text = '>' + text.substring(1);
    }

    return text.padEnd(width);
  }

  private getFileIcon(item: FileItem): string {
    const icons = {
      directory: '📁 ',
      snippet: '✂️ ',
      view: '👁️ ',
      node: '🔗 ',
      file: '📄 ',
      block: '🧱 ',
      token: '🏷️ ',
      metadata: '📋 ',
      function: '⚡ ',
      class: '🏗️ ',
      variable: '📦 ',
      component: '🧩 ',
      group: '🗂️ '
    };
    return icons[item.type] || '📄 ';
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '   0';
    if (bytes < 1024) return `${bytes}B`.padStart(4);
    if (bytes < 1024 * 1024) return `${Math.round(bytes/1024)}K`.padStart(4);
    return `${Math.round(bytes/(1024*1024))}M`.padStart(4);
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
  }

  private drawStatusBar(): void {
    const selectedItem = this.getSelectedItem();
    const status = selectedItem ?
      `${selectedItem.name} (${selectedItem.type}) ${this.formatSize(selectedItem.size)}` :
      'No selection';

    this.terminal.writeln('│' + status.padEnd(this.terminalWidth - 2) + '│');
  }

  private drawTaskBar(): void {
    const shortcuts = [
      'F1:Help', 'F2:Menu', 'F3:View', 'F4:Edit', 'F5:Copy',
      'F6:Move', 'F7:New', 'F8:Del', 'F9:Cfg', 'F10:Exit'
    ];

    const taskBarText = shortcuts.join(' ');
    this.terminal.writeln('└' + taskBarText.substring(0, this.terminalWidth - 2).padEnd(this.terminalWidth - 2) + '┘');

    if (this.statusMessage) {
      this.terminal.writeln(this.statusMessage);
      this.statusMessage = '';
    }
  }

  private drawCommandInput(): void {
    const prompt = ':' + this.commandInput;
    this.terminal.write('\r\n' + prompt);
  }

  private getSelectedItem(): FileItem | null {
    const pane = this.activePane === 'left' ? this.leftPane : this.rightPane;
    return pane.items[pane.selectedIndex] || null;
  }

  private getActivePane(): PaneState {
    return this.activePane === 'left' ? this.leftPane : this.rightPane;
  }

  private moveSelection(delta: number): void {
    const pane = this.getActivePane();
    const newIndex = Math.max(0, Math.min(pane.items.length - 1, pane.selectedIndex + delta));

    if (newIndex !== pane.selectedIndex) {
      pane.selectedIndex = newIndex;

      // Adjust scroll offset if needed
      const paneHeight = this.terminalHeight - 7;
      const visibleRange = paneHeight - 2;

      if (pane.selectedIndex < pane.scrollOffset) {
        pane.scrollOffset = pane.selectedIndex;
      } else if (pane.selectedIndex >= pane.scrollOffset + visibleRange) {
        pane.scrollOffset = pane.selectedIndex - visibleRange + 1;
      }
    }
  }

  private switchPane(target: 'left' | 'right'): void {
    this.activePane = target;
  }

  private async activateItem(): Promise<void> {
    const item = this.getSelectedItem();
    if (!item) return;

    if (item.type === 'directory') {
      await this.navigateToPath(item.path);
    } else if (item.type === 'snippet') {
      await this.viewSnippet(item);
    } else if (item.type === 'view') {
      await this.viewFile(item);
    } else if (item.type === 'node') {
      await this.exploreNode(item);
    }
  }

  private async navigateToPath(path: string): Promise<void> {
    const pane = this.getActivePane();
    pane.currentPath = path;
    pane.selectedIndex = 0;
    pane.scrollOffset = 0;

    await this.refreshPane(pane);
    this.statusMessage = `Navigated to: ${path}`;
  }

  private async viewSnippet(item: FileItem): Promise<void> {
    this.terminal.clear();

    // Header
    this.terminal.writeln('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
    this.terminal.writeln('│' + ` Snippet: ${item.name}`.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('├' + '─'.repeat(this.terminalWidth - 2) + '┤');

    // Snippet info
    const snippet = $$(`snippets.${item.name}`).val();
    if (snippet) {
      this.terminal.writeln('│' + ` Language: ${snippet.language || 'unknown'}`.padEnd(this.terminalWidth - 2) + '│');
      this.terminal.writeln('│' + ` Created: ${new Date(snippet.created || Date.now()).toLocaleString()}`.padEnd(this.terminalWidth - 2) + '│');
      this.terminal.writeln('│' + ` Size: ${this.formatSize(snippet.content?.length || 0)}`.padEnd(this.terminalWidth - 2) + '│');
      this.terminal.writeln('├' + '─'.repeat(this.terminalWidth - 2) + '┤');

      // Content preview
      const lines = (snippet.content || '').split('\n');
      const maxLines = this.terminalHeight - 10;

      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        const line = this.truncate(lines[i], this.terminalWidth - 4);
        this.terminal.writeln('│ ' + line.padEnd(this.terminalWidth - 4) + ' │');
      }

      if (lines.length > maxLines) {
        this.terminal.writeln('│ ' + `... ${lines.length - maxLines} more lines`.padEnd(this.terminalWidth - 4) + ' │');
      }
    }

    this.terminal.writeln('├' + '─'.repeat(this.terminalWidth - 2) + '┤');
    this.terminal.writeln('│' + ' Press E to edit, ESC to return'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('└' + '─'.repeat(this.terminalWidth - 2) + '┘');

    // Wait for input
    await this.waitForKey(['e', 'E', '\u001b']); // E or Escape
  }

  private async editSnippet(item: FileItem): Promise<void> {
    this.terminal.clear();

    this.terminal.writeln('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
    this.terminal.writeln('│' + ` Editing: ${item.name}`.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
    this.terminal.writeln('');

    const snippet = $$(`snippets.${item.name}`).val();
    const content = snippet?.content || '';

    this.terminal.writeln('Current content:');
    this.terminal.writeln('---');
    this.terminal.writeln(content);
    this.terminal.writeln('---');
    this.terminal.writeln('');
    this.terminal.writeln('Enter new content (press Ctrl+S to save, ESC to cancel):');

    // Simple editing (for demo - could be enhanced with line editor)
    const newContent = await this.simpleEdit(content);
    if (newContent !== null) {
      $$(`snippets.${item.name}.content`).val(newContent);
      $$(`snippets.${item.name}.modified`).val(Date.now());
      this.statusMessage = `Saved: ${item.name}`;
    }
  }

  private async simpleEdit(initialContent: string): Promise<string | null> {
    // Simplified editor - in real implementation, this would be a proper line editor
    this.terminal.writeln('(Simplified editor - type new content and press Enter)');
    this.terminal.write('> ');

    return new Promise((resolve) => {
      let input = '';
      const handler = (data: string) => {
        const char = data.charCodeAt(0);

        if (char === 13) { // Enter
          this.terminal.off('data', handler);
          resolve(input || initialContent);
        } else if (char === 27) { // Escape
          this.terminal.off('data', handler);
          resolve(null);
        } else if (char === 127) { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            this.terminal.write('\b \b');
          }
        } else if (char >= 32 && char <= 126) {
          input += data;
          this.terminal.write(data);
        }
      };

      this.terminal.onData(handler);
    });
  }

  private async waitForKey(keys: string[]): Promise<string> {
    return new Promise((resolve) => {
      const handler = (data: string) => {
        if (keys.includes(data)) {
          this.terminal.off('data', handler);
          resolve(data);
        }
      };
      this.terminal.onData(handler);
    });
  }

  private enterCommandMode(): void {
    this.commandMode = true;
    this.commandInput = '';
  }

  private exitCommandMode(): void {
    this.commandMode = false;
    this.commandInput = '';
  }

  private async executeCommand(): Promise<void> {
    const cmd = this.commandInput.trim();
    this.exitCommandMode();

    // Simple command parser
    const [command, ...args] = cmd.split(' ');

    switch (command) {
      case 'cd':
        await this.navigateToPath(args[0] || '/');
        break;
      case 'refresh':
      case 'r':
        await this.refreshCurrentPane();
        break;
      case 'edit':
        await this.editCurrentItem();
        break;
      case 'new':
        await this.createNewItem();
        break;
      case 'help':
        await this.showHelp();
        break;
      default:
        this.statusMessage = `Unknown command: ${command}`;
    }
  }

  private async refreshCurrentPane(): Promise<void> {
    await this.refreshPane(this.getActivePane());
    this.statusMessage = 'Refreshed';
  }

  private async editCurrentItem(): Promise<void> {
    const item = this.getSelectedItem();
    if (!item) return;

    if (item.type === 'snippet') {
      await this.editSnippet(item);
    } else {
      this.statusMessage = `Cannot edit ${item.type}`;
    }
  }

  private async viewCurrentItem(): Promise<void> {
    const item = this.getSelectedItem();
    if (!item) return;

    if (item.type === 'snippet') {
      await this.viewSnippet(item);
    } else {
      this.statusMessage = `Cannot view ${item.type}`;
    }
  }

  private async createNewItem(): Promise<void> {
    this.statusMessage = 'New item creation not implemented yet';
  }

  private async deleteCurrentItem(): Promise<void> {
    const item = this.getSelectedItem();
    if (!item) return;

    this.statusMessage = `Delete ${item.name}? (Not implemented)`;
  }

  private async exploreNode(item: FileItem): Promise<void> {
    this.statusMessage = `Exploring node: ${item.name}`;
    // TODO: Implement node exploration
  }

  private async viewFile(item: FileItem): Promise<void> {
    this.statusMessage = `Viewing file: ${item.name}`;
    // TODO: Implement file viewing
  }

  private async showHelp(): Promise<void> {
    this.terminal.clear();

    this.terminal.writeln('┌' + '─'.repeat(this.terminalWidth - 2) + '┐');
    this.terminal.writeln('│' + ' FX Commander Help'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('├' + '─'.repeat(this.terminalWidth - 2) + '┤');
    this.terminal.writeln('│' + ''.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│ Navigation:'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   ↑↓ arrows - Move selection'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   ←→ arrows - Switch panes'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   Tab       - Switch panes'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   Enter     - Activate item'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│ Actions:'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   E - Edit snippet'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   V - View content'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   N - New item'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   D - Delete item'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   R - Refresh'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│   : - Command mode'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('│ F10 or ESC - Exit FX Commander'.padEnd(this.terminalWidth - 2) + '│');
    this.terminal.writeln('└' + '─'.repeat(this.terminalWidth - 2) + '┘');
    this.terminal.writeln('');
    this.terminal.writeln('Press any key to continue...');

    await this.waitForKey(['\u001b', ' ']); // Escape or space
  }

  private getParentPath(path: string): string {
    if (path === 'disk:/') return 'disk:/';
    if (path.includes(':/')) {
      const parts = path.split('/');
      if (parts.length <= 2) return 'disk:/';
      return parts.slice(0, -1).join('/');
    }
    // Regular filesystem path
    const parts = path.split('/');
    return parts.slice(0, -1).join('/') || '/';
  }

  private updateTerminalSize(): void {
    if (this.terminal.cols && this.terminal.rows) {
      this.terminalWidth = this.terminal.cols;
      this.terminalHeight = this.terminal.rows;
    }
  }

  // Public methods for external control
  public refresh(): void {
    if (this.isActive) {
      this.refreshCurrentPane();
      this.draw();
    }
  }

  public isRunning(): boolean {
    return this.isActive;
  }
}