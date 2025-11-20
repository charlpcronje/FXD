const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let recentFiles = [];
const MAX_RECENT_FILES = 10;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('electron-renderer.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Create application menu
  createMenu();

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open file if provided via command line or file association
  const filePath = process.argv.find(arg => arg.endsWith('.fxd'));
  if (filePath) {
    setTimeout(() => {
      openFile(filePath);
    }, 1000);
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handleSaveAs()
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as PNG',
              accelerator: 'CmdOrCtrl+Shift+P',
              click: () => mainWindow.webContents.send('menu-export-png')
            },
            {
              label: 'Export as SVG',
              accelerator: 'CmdOrCtrl+Shift+G',
              click: () => mainWindow.webContents.send('menu-export-svg')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Recent Files',
          submenu: recentFiles.length > 0
            ? recentFiles.map(file => ({
                label: path.basename(file),
                click: () => openFile(file)
              }))
            : [{ label: 'No recent files', enabled: false }]
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow.webContents.send('menu-redo')
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => mainWindow.webContents.send('menu-copy')
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => mainWindow.webContents.send('menu-paste')
        },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu-find')
        },
        {
          label: 'Select All Nodes',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow.webContents.send('menu-select-all')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow.webContents.send('menu-zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-zoom-out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-zoom-reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Minimap',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow.webContents.send('menu-toggle-minimap')
        },
        {
          label: 'Toggle Performance Overlay',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow.webContents.send('menu-toggle-performance')
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          role: 'reload'
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          role: 'toggleDevTools'
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          role: 'togglefullscreen'
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          click: () => openUserGuide()
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'F1',
          click: () => mainWindow.webContents.send('menu-show-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'About FXD Visualizer',
          click: () => showAbout()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'FXD Files', extensions: ['fxd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    await openFile(result.filePaths[0]);
  }
}

async function openFile(filePath) {
  try {
    const data = await fs.readFile(filePath);
    mainWindow.webContents.send('file-opened', {
      path: filePath,
      data: data
    });

    // Add to recent files
    addToRecentFiles(filePath);
    createMenu();

  } catch (error) {
    dialog.showErrorBox('Error Opening File', error.message);
  }
}

async function handleSaveAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'FXD Files', extensions: ['fxd'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'untitled.fxd'
  });

  if (!result.canceled) {
    mainWindow.webContents.send('save-file-as', result.filePath);
  }
}

function addToRecentFiles(filePath) {
  // Remove if already exists
  recentFiles = recentFiles.filter(f => f !== filePath);

  // Add to beginning
  recentFiles.unshift(filePath);

  // Keep only MAX_RECENT_FILES
  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  }
}

function openUserGuide() {
  const guidePath = path.join(__dirname, 'docs', 'USER-GUIDE.md');
  shell.openPath(guidePath);
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About FXD Visualizer',
    message: 'FXD Quantum Desktop Visualizer',
    detail: `Version: 1.0.0

A revolutionary 3D visualizer for FXD (FX Disk) quantum development.

Visualize your code structure, data flow, and reactive dependencies in real-time.

Built with Electron, Three.js, and quantum love.

© 2025 FXD Project`
  });
}

// IPC Handlers
ipcMain.handle('save-file', async (event, data) => {
  try {
    await fs.writeFile(data.path, data.content);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-image', async (event, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: data.type.toUpperCase(), extensions: [data.type] }
      ],
      defaultPath: `fxd-export.${data.type}`
    });

    if (!result.canceled) {
      // Remove data URL prefix
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

// Handle file opens from Windows
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    openFile(filePath);
  } else {
    app.on('ready', () => openFile(filePath));
  }
});
