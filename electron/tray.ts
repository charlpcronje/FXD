/**
 * FXD Electron - System Tray Manager
 *
 * Manages system tray icon, context menu, and notifications
 */

import { Tray, Menu, nativeImage, Notification, app } from 'electron';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TrayNotification {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
}

// ============================================================================
// Tray Manager Class
// ============================================================================

export class TrayManager {
  private tray: Tray | null = null;
  private toggleWindowCallback: () => void;

  constructor(toggleWindowCallback: () => void) {
    this.toggleWindowCallback = toggleWindowCallback;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  public async initialize(): Promise<void> {
    console.log('[Tray] Initializing system tray...');

    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('FXD Quantum Visualizer');

    this.setupMenu();
    this.setupEvents();

    console.log('[Tray] System tray ready');
  }

  // --------------------------------------------------------------------------
  // Menu Setup
  // --------------------------------------------------------------------------

  private setupMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'FXD Quantum Visualizer',
        enabled: false,
      },
      {
        type: 'separator',
      },
      {
        label: 'Show/Hide',
        click: () => this.toggleWindowCallback(),
        accelerator: 'CommandOrControl+Shift+F',
      },
      {
        label: 'Open File...',
        click: () => this.openFileDialog(),
        accelerator: 'CommandOrControl+O',
      },
      {
        type: 'separator',
      },
      {
        label: 'Recent Files',
        submenu: [
          {
            label: 'No recent files',
            enabled: false,
          },
        ],
      },
      {
        type: 'separator',
      },
      {
        label: 'Preferences',
        submenu: [
          {
            label: 'Start Minimized',
            type: 'checkbox',
            checked: false,
            click: (item) => this.updatePreference('startMinimized', item.checked),
          },
          {
            label: 'Close to Tray',
            type: 'checkbox',
            checked: true,
            click: (item) => this.updatePreference('closeToTray', item.checked),
          },
          {
            label: 'Auto Update',
            type: 'checkbox',
            checked: true,
            click: (item) => this.updatePreference('autoUpdate', item.checked),
          },
        ],
      },
      {
        type: 'separator',
      },
      {
        label: 'About',
        click: () => this.showAbout(),
      },
      {
        label: 'Quit',
        click: () => app.quit(),
        accelerator: 'CommandOrControl+Q',
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  private setupEvents(): void {
    if (!this.tray) return;

    // Click to toggle window
    this.tray.on('click', () => {
      this.toggleWindowCallback();
    });

    // Double click to show window
    this.tray.on('double-click', () => {
      this.toggleWindowCallback();
    });

    // Right click shows context menu (handled automatically)
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  private openFileDialog(): void {
    // This will be handled by the main application
    // Send a message to open file dialog
    const { fxdApp } = require('./main');
    fxdApp.openFileDialog();
  }

  private updatePreference(key: string, value: any): void {
    // Update application preferences
    const { fxdApp } = require('./main');
    fxdApp.updateConfig({ [key]: value });
  }

  private showAbout(): void {
    // Show about dialog
    const notification: TrayNotification = {
      title: 'FXD Quantum Visualizer',
      body: 'Version 1.0.0\n\nBeautiful desktop app for managing FXD disks with integrated 3D visualizer.',
    };
    this.showNotification(notification);
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  public showNotification(options: TrayNotification): void {
    if (!Notification.isSupported()) {
      console.warn('[Tray] Notifications not supported on this platform');
      return;
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      silent: options.silent || false,
      icon: options.icon || this.getIconPath(),
    });

    notification.show();
  }

  public updateMenu(updates: { recentFiles?: string[] }): void {
    if (!this.tray) return;

    const menu = this.tray.getContextMenu();
    if (!menu) return;

    // Update recent files submenu
    if (updates.recentFiles) {
      const recentMenu = menu.items.find(item => item.label === 'Recent Files');
      if (recentMenu && recentMenu.submenu) {
        const submenu = Menu.buildFromTemplate(
          updates.recentFiles.length > 0
            ? updates.recentFiles.map(file => ({
                label: path.basename(file),
                click: () => this.openRecentFile(file),
                toolTip: file,
              }))
            : [
                {
                  label: 'No recent files',
                  enabled: false,
                },
              ]
        );
        recentMenu.submenu = submenu;
      }
    }

    this.tray.setContextMenu(menu);
  }

  private openRecentFile(filePath: string): void {
    // Open recent file
    const { fxdApp } = require('./main');
    // This would call a method to open the file
    console.log('[Tray] Opening recent file:', filePath);
  }

  public setIcon(iconPath: string): void {
    if (!this.tray) return;

    const icon = nativeImage.createFromPath(iconPath);
    this.tray.setImage(icon.resize({ width: 16, height: 16 }));
  }

  public setTooltip(tooltip: string): void {
    if (!this.tray) return;
    this.tray.setToolTip(tooltip);
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private getIconPath(): string {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    return path.join(__dirname, 'assets', iconName);
  }
}
