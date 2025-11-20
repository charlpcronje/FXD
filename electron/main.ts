/**
 * FXD Electron Desktop Application - Main Process
 *
 * Beautiful desktop app for managing FXD disks with integrated 3D visualizer
 * Features:
 * - Multi-window management
 * - System tray integration
 * - IPC bridge for secure communication
 * - Auto-updater
 * - File associations (.fxd files)
 * - Keyboard shortcuts
 * - Native notifications
 */

import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPCBridge } from './ipc-bridge';
import { TrayManager } from './tray';
import { MenuManager } from './menu';
import { AutoUpdater } from './updater';

// ============================================================================
// Constants
// ============================================================================

const APP_NAME = 'FXD Quantum Visualizer';
const APP_VERSION = '1.0.0';
const MIN_WINDOW_WIDTH = 1280;
const MIN_WINDOW_HEIGHT = 720;
const DEFAULT_WINDOW_WIDTH = 1600;
const DEFAULT_WINDOW_HEIGHT = 900;

// ============================================================================
// Type Definitions
// ============================================================================

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

interface AppConfig {
  theme: 'dark' | 'light' | 'system';
  autoUpdate: boolean;
  startMinimized: boolean;
  closeToTray: boolean;
  recentFiles: string[];
  windowState: WindowState;
}

// ============================================================================
// Application State
// ============================================================================

class FXDApplication {
  private mainWindow: BrowserWindow | null = null;
  private ipcBridge: IPCBridge | null = null;
  private trayManager: TrayManager | null = null;
  private menuManager: MenuManager | null = null;
  private autoUpdater: AutoUpdater | null = null;
  private config: AppConfig;
  private configPath: string;
  private isQuitting = false;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.loadConfig();
    this.setupApp();
  }

  // --------------------------------------------------------------------------
  // Configuration Management
  // --------------------------------------------------------------------------

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...this.getDefaultConfig(), ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('[FXD] Failed to load config:', error);
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): AppConfig {
    return {
      theme: 'dark',
      autoUpdate: true,
      startMinimized: false,
      closeToTray: true,
      recentFiles: [],
      windowState: {
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        isMaximized: false,
      },
    };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('[FXD] Failed to save config:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Application Setup
  // --------------------------------------------------------------------------

  private setupApp(): void {
    // Single instance lock
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      console.log('[FXD] Another instance is already running');
      app.quit();
      return;
    }

    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, focus our window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();

        // Check if they're trying to open a file
        const filePath = commandLine.find(arg => arg.endsWith('.fxd'));
        if (filePath) {
          this.openFile(filePath);
        }
      }
    });

    // Setup handlers
    app.on('ready', () => this.onReady());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.onBeforeQuit());

    // Handle file associations (Windows/Linux)
    if (process.platform === 'win32' || process.platform === 'linux') {
      const filePath = process.argv.find(arg => arg.endsWith('.fxd'));
      if (filePath) {
        // Open file after app is ready
        app.on('ready', () => {
          setTimeout(() => this.openFile(filePath), 1000);
        });
      }
    }

    // Handle file associations (macOS)
    app.on('open-file', (event, filePath) => {
      event.preventDefault();
      if (this.mainWindow) {
        this.openFile(filePath);
      } else {
        // Queue file to open after window is created
        app.on('ready', () => {
          setTimeout(() => this.openFile(filePath), 1000);
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // Lifecycle Events
  // --------------------------------------------------------------------------

  private async onReady(): Promise<void> {
    console.log(`[FXD] ${APP_NAME} v${APP_VERSION} starting...`);

    // Initialize components
    await this.initializeComponents();

    // Create main window
    this.createMainWindow();

    // Setup file associations
    this.setupFileAssociations();

    console.log('[FXD] Application ready');
  }

  private onWindowAllClosed(): void {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      if (!this.config.closeToTray || this.isQuitting) {
        app.quit();
      }
    }
  }

  private onActivate(): void {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createMainWindow();
    }
  }

  private onBeforeQuit(): void {
    this.isQuitting = true;
    this.saveWindowState();
    this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // Component Initialization
  // --------------------------------------------------------------------------

  private async initializeComponents(): Promise<void> {
    try {
      // Initialize IPC Bridge
      this.ipcBridge = new IPCBridge();
      this.ipcBridge.initialize();

      // Initialize Tray Manager
      this.trayManager = new TrayManager(() => this.toggleMainWindow());
      await this.trayManager.initialize();

      // Initialize Menu Manager
      this.menuManager = new MenuManager();
      this.menuManager.initialize(this);

      // Initialize Auto Updater
      if (this.config.autoUpdate) {
        this.autoUpdater = new AutoUpdater();
        this.autoUpdater.initialize();
      }

      console.log('[FXD] All components initialized');
    } catch (error) {
      console.error('[FXD] Component initialization failed:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Window Management
  // --------------------------------------------------------------------------

  private createMainWindow(): void {
    const { windowState } = this.config;

    this.mainWindow = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      title: APP_NAME,
      backgroundColor: '#000000',
      icon: this.getIconPath(),
      show: !this.config.startMinimized,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
      frame: true,
      titleBarStyle: 'default',
      autoHideMenuBar: false,
    });

    // Restore maximized state
    if (windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    // Load the app
    this.loadApp();

    // Setup window events
    this.setupWindowEvents();

    // DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    console.log('[FXD] Main window created');
  }

  private loadApp(): void {
    if (!this.mainWindow) return;

    if (process.env.NODE_ENV === 'development') {
      // Load from dev server
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      // Load from built files
      this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    }
  }

  private setupWindowEvents(): void {
    if (!this.mainWindow) return;

    // Ready to show
    this.mainWindow.once('ready-to-show', () => {
      if (!this.config.startMinimized && this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    // Close event
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting && this.config.closeToTray) {
        event.preventDefault();
        this.mainWindow?.hide();
        this.trayManager?.showNotification({
          title: APP_NAME,
          body: 'Application minimized to system tray',
        });
      } else {
        this.saveWindowState();
      }
    });

    // Closed event
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // External links open in browser
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // Window state changes
    this.mainWindow.on('maximize', () => this.saveWindowState());
    this.mainWindow.on('unmaximize', () => this.saveWindowState());
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    this.config.windowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: this.mainWindow.isMaximized(),
    };
  }

  // --------------------------------------------------------------------------
  // File Management
  // --------------------------------------------------------------------------

  private async openFile(filePath: string): Promise<void> {
    try {
      console.log('[FXD] Opening file:', filePath);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      // Verify file extension
      if (!filePath.endsWith('.fxd')) {
        throw new Error('Invalid file type. Expected .fxd file');
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse FXD data
      const data = JSON.parse(content);

      // Add to recent files
      this.addRecentFile(filePath);

      // Send to renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('file-opened', {
          path: filePath,
          data,
        });
      }

      console.log('[FXD] File opened successfully');
    } catch (error: any) {
      console.error('[FXD] Failed to open file:', error);

      dialog.showErrorBox(
        'Failed to Open File',
        `Could not open file: ${error.message}`
      );
    }
  }

  private addRecentFile(filePath: string): void {
    // Remove if already exists
    this.config.recentFiles = this.config.recentFiles.filter(f => f !== filePath);

    // Add to front
    this.config.recentFiles.unshift(filePath);

    // Keep only last 10
    this.config.recentFiles = this.config.recentFiles.slice(0, 10);

    // Save config
    this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // File Associations
  // --------------------------------------------------------------------------

  private setupFileAssociations(): void {
    // Set as default handler for .fxd files
    if (process.platform === 'win32') {
      app.setAsDefaultProtocolClient('fxd');
    }

    // Register file icon
    if (process.platform === 'darwin') {
      app.setUserTasks([
        {
          program: process.execPath,
          arguments: '--new-window',
          iconPath: this.getIconPath(),
          iconIndex: 0,
          title: 'New Window',
          description: 'Create a new FXD window',
        },
      ]);
    }
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  public toggleMainWindow(): void {
    if (!this.mainWindow) {
      this.createMainWindow();
      return;
    }

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  public async openFileDialog(): Promise<void> {
    const result = await dialog.showOpenDialog({
      title: 'Open FXD File',
      filters: [
        { name: 'FXD Files', extensions: ['fxd'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      await this.openFile(result.filePaths[0]);
    }
  }

  public quit(): void {
    this.isQuitting = true;
    app.quit();
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private getIconPath(): string {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    return path.join(__dirname, 'assets', iconName);
  }
}

// ============================================================================
// Application Entry Point
// ============================================================================

// Create application instance
const fxdApp = new FXDApplication();

// Export for IPC handlers
export { fxdApp };
