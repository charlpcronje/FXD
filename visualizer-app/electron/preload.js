/**
 * FXD Quantum - Electron Preload Script
 * Secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },

  // File dialogs
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  },

  // Disk operations (will be replaced with real FXD backend)
  disk: {
    create: (data) => ipcRenderer.invoke('disk:create', data),
    mount: (diskId) => ipcRenderer.invoke('disk:mount', diskId),
    unmount: (diskId) => ipcRenderer.invoke('disk:unmount', diskId),
    import: (folderPath) => ipcRenderer.invoke('disk:import', folderPath),
  },

  // System operations
  system: {
    getPath: (name) => ipcRenderer.invoke('system:getPath', name),
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
    showItemInFolder: (path) => ipcRenderer.invoke('system:showItemInFolder', path),
  },

  // File operations
  file: {
    onOpen: (callback) => {
      ipcRenderer.on('file:open', (event, filePath) => callback(filePath));
    },
  },
});

// Log that preload is ready
console.log('FXD Quantum preload script loaded');
