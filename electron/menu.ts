/**
 * FXD Electron - Application Menu Manager
 *
 * Manages the application menu with keyboard shortcuts
 */

import { Menu, MenuItem, shell, app, dialog } from 'electron';

// ============================================================================
// Menu Manager Class
// ============================================================================

export class MenuManager {
  private menu: Menu | null = null;
  private app: any; // FXDApplication instance

  constructor() {}

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  public initialize(appInstance: any): void {
    console.log('[Menu] Building application menu...');

    this.app = appInstance;
    this.menu = this.buildMenu();
    Menu.setApplicationMenu(this.menu);

    console.log('[Menu] Application menu ready');
  }

  // --------------------------------------------------------------------------
  // Menu Building
  // --------------------------------------------------------------------------

  private buildMenu(): Menu {
    const isMac = process.platform === 'darwin';

    const template: any[] = [
      // App menu (macOS only)
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                  label: 'Preferences...',
                  accelerator: 'CommandOrControl+,',
                  click: () => this.openPreferences(),
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
              ],
            },
          ]
        : []),

      // File menu
      {
        label: 'File',
        submenu: [
          {
            label: 'Open File...',
            accelerator: 'CommandOrControl+O',
            click: () => this.app.openFileDialog(),
          },
          {
            label: 'Open Recent',
            submenu: [
              {
                label: 'No recent files',
                enabled: false,
              },
            ],
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CommandOrControl+S',
            click: () => this.saveFile(),
          },
          {
            label: 'Save As...',
            accelerator: 'CommandOrControl+Shift+S',
            click: () => this.saveFileAs(),
          },
          { type: 'separator' },
          {
            label: 'Close Window',
            accelerator: 'CommandOrControl+W',
            role: 'close',
          },
          ...(!isMac
            ? [
                { type: 'separator' },
                {
                  label: 'Preferences...',
                  accelerator: 'CommandOrControl+,',
                  click: () => this.openPreferences(),
                },
                { type: 'separator' },
                { role: 'quit' },
              ]
            : []),
        ],
      },

      // Edit menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CommandOrControl+F',
            click: () => this.showFind(),
          },
        ],
      },

      // View menu
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          {
            label: 'Show Inspector',
            accelerator: 'CommandOrControl+Shift+I',
            click: () => this.togglePanel('inspector'),
          },
          {
            label: 'Show Console',
            accelerator: 'CommandOrControl+Shift+C',
            click: () => this.togglePanel('console'),
          },
          {
            label: 'Show Timeline',
            accelerator: 'CommandOrControl+Shift+T',
            click: () => this.togglePanel('timeline'),
          },
          {
            label: 'Show Metrics',
            accelerator: 'CommandOrControl+Shift+M',
            click: () => this.togglePanel('metrics'),
          },
        ],
      },

      // Disk menu
      {
        label: 'Disk',
        submenu: [
          {
            label: 'Mount Disk...',
            accelerator: 'CommandOrControl+M',
            click: () => this.mountDisk(),
          },
          {
            label: 'Unmount All',
            accelerator: 'CommandOrControl+Shift+M',
            click: () => this.unmountAll(),
          },
          { type: 'separator' },
          {
            label: 'Refresh',
            accelerator: 'CommandOrControl+R',
            click: () => this.refreshDisks(),
          },
          { type: 'separator' },
          {
            label: 'Disk Manager',
            accelerator: 'CommandOrControl+D',
            click: () => this.openDiskManager(),
          },
        ],
      },

      // Node menu
      {
        label: 'Node',
        submenu: [
          {
            label: 'Create Node',
            accelerator: 'CommandOrControl+N',
            click: () => this.createNode(),
          },
          {
            label: 'Delete Node',
            accelerator: 'Delete',
            click: () => this.deleteNode(),
          },
          { type: 'separator' },
          {
            label: 'Edit Properties',
            accelerator: 'CommandOrControl+E',
            click: () => this.editNodeProperties(),
          },
          {
            label: 'Clone Node',
            accelerator: 'CommandOrControl+Shift+N',
            click: () => this.cloneNode(),
          },
          { type: 'separator' },
          {
            label: 'Find Node...',
            accelerator: 'CommandOrControl+Shift+F',
            click: () => this.findNode(),
          },
        ],
      },

      // Window menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(isMac
            ? [
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' },
              ]
            : [{ role: 'close' }]),
        ],
      },

      // Help menu
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => this.openDocumentation(),
          },
          {
            label: 'Keyboard Shortcuts',
            accelerator: 'CommandOrControl+/',
            click: () => this.showKeyboardShortcuts(),
          },
          { type: 'separator' },
          {
            label: 'Report Issue',
            click: () => this.reportIssue(),
          },
          {
            label: 'Check for Updates',
            click: () => this.checkForUpdates(),
          },
          { type: 'separator' },
          ...(!isMac
            ? [
                {
                  label: 'About',
                  click: () => this.showAbout(),
                },
              ]
            : []),
        ],
      },
    ];

    return Menu.buildFromTemplate(template);
  }

  // --------------------------------------------------------------------------
  // Menu Actions
  // --------------------------------------------------------------------------

  private saveFile(): void {
    console.log('[Menu] Save file');
    this.sendToRenderer('menu:save');
  }

  private saveFileAs(): void {
    console.log('[Menu] Save file as');
    this.sendToRenderer('menu:save-as');
  }

  private openPreferences(): void {
    console.log('[Menu] Open preferences');
    this.sendToRenderer('menu:preferences');
  }

  private showFind(): void {
    console.log('[Menu] Show find');
    this.sendToRenderer('menu:find');
  }

  private togglePanel(panel: string): void {
    console.log('[Menu] Toggle panel:', panel);
    this.sendToRenderer('menu:toggle-panel', panel);
  }

  private mountDisk(): void {
    console.log('[Menu] Mount disk');
    this.sendToRenderer('menu:mount-disk');
  }

  private unmountAll(): void {
    console.log('[Menu] Unmount all disks');
    this.sendToRenderer('menu:unmount-all');
  }

  private refreshDisks(): void {
    console.log('[Menu] Refresh disks');
    this.sendToRenderer('menu:refresh-disks');
  }

  private openDiskManager(): void {
    console.log('[Menu] Open disk manager');
    this.sendToRenderer('menu:disk-manager');
  }

  private createNode(): void {
    console.log('[Menu] Create node');
    this.sendToRenderer('menu:create-node');
  }

  private deleteNode(): void {
    console.log('[Menu] Delete node');
    this.sendToRenderer('menu:delete-node');
  }

  private editNodeProperties(): void {
    console.log('[Menu] Edit node properties');
    this.sendToRenderer('menu:edit-node');
  }

  private cloneNode(): void {
    console.log('[Menu] Clone node');
    this.sendToRenderer('menu:clone-node');
  }

  private findNode(): void {
    console.log('[Menu] Find node');
    this.sendToRenderer('menu:find-node');
  }

  private openDocumentation(): void {
    shell.openExternal('https://github.com/fxd/docs');
  }

  private showKeyboardShortcuts(): void {
    this.sendToRenderer('menu:keyboard-shortcuts');
  }

  private reportIssue(): void {
    shell.openExternal('https://github.com/fxd/issues');
  }

  private checkForUpdates(): void {
    console.log('[Menu] Check for updates');
    this.sendToRenderer('menu:check-updates');
  }

  private showAbout(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'About FXD Quantum Visualizer',
      message: 'FXD Quantum Visualizer',
      detail: `Version: 1.0.0\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
      buttons: ['OK'],
    });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private sendToRenderer(channel: string, ...args: any[]): void {
    const window = this.app.getMainWindow();
    if (window && window.webContents) {
      window.webContents.send(channel, ...args);
    }
  }

  public updateRecentFiles(files: string[]): void {
    if (!this.menu) return;

    // Find File menu
    const fileMenu = this.menu.items.find(item => item.label === 'File');
    if (!fileMenu || !fileMenu.submenu) return;

    // Find Open Recent submenu
    const recentMenu = fileMenu.submenu.items.find(
      item => item.label === 'Open Recent'
    );
    if (!recentMenu || !recentMenu.submenu) return;

    // Build new submenu
    const submenu =
      files.length > 0
        ? files.map(file => ({
            label: file,
            click: () => {
              // Open the file
              this.sendToRenderer('menu:open-recent', file);
            },
          }))
        : [
            {
              label: 'No recent files',
              enabled: false,
            },
          ];

    recentMenu.submenu = Menu.buildFromTemplate(submenu);

    // Update menu
    Menu.setApplicationMenu(this.menu);
  }
}
