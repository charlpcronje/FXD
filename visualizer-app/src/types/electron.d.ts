/**
 * TypeScript definitions for Electron API exposed via preload
 */

export interface ElectronAPI {
  platform: string;
  isElectron: boolean;

  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };

  dialog: {
    openFile: () => Promise<{ success: boolean; path?: string }>;
    openFolder: () => Promise<{ success: boolean; path?: string }>;
    saveFile: (options?: { defaultPath?: string }) => Promise<{ success: boolean; path?: string }>;
  };

  disk: {
    create: (data: { name: string; path?: string }) => Promise<{
      success: boolean;
      disk?: {
        id: string;
        name: string;
        path: string;
        nodeCount: number;
        fileCount: number;
        size: number;
        created: Date;
      };
    }>;
    mount: (diskId: string) => Promise<{ success: boolean; mountPoint?: string }>;
    unmount: (diskId: string) => Promise<{ success: boolean }>;
    import: (folderPath: string) => Promise<{
      success: boolean;
      stats?: {
        files: number;
        nodes: number;
        size: number;
      };
    }>;
  };

  system: {
    getPath: (name: string) => Promise<string>;
    openExternal: (url: string) => Promise<{ success: boolean }>;
    showItemInFolder: (path: string) => Promise<{ success: boolean }>;
  };

  file: {
    onOpen: (callback: (filePath: string) => void) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
