/**
 * FXD Quantum - Electron Main Process
 * Desktop application entry point
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let recentFiles = [];

// Environment detection
const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    frame: false, // Custom title bar
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false, // Show after ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC Handlers - Window Controls
// ============================================

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// ============================================
// IPC Handlers - File Operations
// ============================================

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'FXD Files', extensions: ['fxd'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath || 'untitled.fxd',
    filters: [
      { name: 'FXD Files', extensions: ['fxd'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled) {
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// ============================================
// IPC Handlers - Disk Operations (Mock for now)
// ============================================

ipcMain.handle('disk:create', async (event, data) => {
  // Mock implementation - will be replaced with real FXD backend
  console.log('Creating disk:', data);

  // Simulate disk creation
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    disk: {
      id: `disk_${Date.now()}`,
      name: data.name,
      path: data.path || `${app.getPath('documents')}/FXD/${data.name}`,
      nodeCount: 0,
      fileCount: 0,
      size: 0,
      created: new Date(),
    },
  };
});

ipcMain.handle('disk:mount', async (event, diskId) => {
  // Mock implementation
  console.log('Mounting disk:', diskId);
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    mountPoint: 'R:\\',
  };
});

ipcMain.handle('disk:unmount', async (event, diskId) => {
  // Mock implementation
  console.log('Unmounting disk:', diskId);
  await new Promise(resolve => setTimeout(resolve, 300));

  return { success: true };
});

ipcMain.handle('disk:import', async (event, folderPath) => {
  // Mock implementation
  console.log('Importing folder:', folderPath);

  // Simulate scanning files
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    success: true,
    stats: {
      files: 234,
      nodes: 1234,
      size: 45200000,
    },
  };
});

// ============================================
// IPC Handlers - System
// ============================================

ipcMain.handle('system:getPath', (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('system:openExternal', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

ipcMain.handle('system:showItemInFolder', (event, path) => {
  shell.showItemInFolder(path);
  return { success: true };
});

// ============================================
// File Associations & Deep Links
// ============================================

// Handle .fxd file opens
app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (mainWindow) {
    mainWindow.webContents.send('file:open', filePath);
  } else {
    // Queue for when window is ready
    app.on('ready', () => {
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('file:open', filePath);
        }
      }, 1000);
    });
  }
});

// Handle protocol URLs (fxd://)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('fxd', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('fxd');
}

// ============================================
// Error Handling
// ============================================

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);

  if (mainWindow) {
    dialog.showErrorBox('Application Error', error.message);
  }
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details);
});

// ============================================
// Development Helpers
// ============================================

if (isDev) {
  // Auto-reload on file changes
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
  });
}

console.log('FXD Quantum Electron app started');
console.log('Environment:', isDev ? 'development' : 'production');
console.log('App path:', app.getAppPath());
