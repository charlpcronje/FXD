/**
 * FX RAMDisk Module
 * Cross-platform RAMDisk creation and management for FXD projects
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface RAMDiskOptions {
    size: string;        // "256M", "1G", etc.
    mountPoint: string;  // "R:", "/mnt/fxd", etc.
    label?: string;      // Volume label
    projectId?: string;  // Unique project identifier
}

export interface MountedDisk {
    id: string;
    mountPoint: string;
    size: string;
    created: Date;
    projectPath?: string;
}

class RAMDiskManager {
    private mounted: Map<string, MountedDisk> = new Map();
    private platform: NodeJS.Platform = process.platform;

    /**
     * Parse size string to bytes
     */
    private parseSize(sizeStr: string): number {
        const units: Record<string, number> = {
            'K': 1024,
            'M': 1024 * 1024,
            'G': 1024 * 1024 * 1024
        };
        
        const match = sizeStr.match(/^(\d+)([KMG])$/i);
        if (!match) throw new Error(`Invalid size format: ${sizeStr}`);
        
        const [, num, unit] = match;
        return parseInt(num) * units[unit.toUpperCase()];
    }

    /**
     * Get default mount point for platform
     */
    private getDefaultMountPoint(projectId: string): string {
        switch (this.platform) {
            case 'win32':
                // Find available drive letter starting from R:
                const drives = 'RSTUVWXYZ'.split('');
                for (const letter of drives) {
                    if (!fs.existsSync(`${letter}:`)) {
                        return `${letter}:`;
                    }
                }
                throw new Error('No available drive letters');
                
            case 'darwin':
                return `/Volumes/FXD-${projectId}`;
                
            case 'linux':
                return `/mnt/fxd-${projectId}`;
                
            default:
                throw new Error(`Unsupported platform: ${this.platform}`);
        }
    }

    /**
     * Create RAMDisk on Windows
     */
    private async createWindowsRAMDisk(options: RAMDiskOptions): Promise<void> {
        const bytes = this.parseSize(options.size);
        const label = options.label || 'FXD-Project';
        
        // Check if imdisk is available
        try {
            await execAsync('imdisk --version');
        } catch {
            throw new Error('imdisk not found. Please install ImDisk Virtual Disk Driver');
        }
        
        // Create RAMDisk
        const cmd = `imdisk -a -s ${bytes} -m ${options.mountPoint} -p "/fs:ntfs /q /y /v:${label}"`;
        await execAsync(cmd);
    }

    /**
     * Create RAMDisk on macOS
     */
    private async createMacRAMDisk(options: RAMDiskOptions): Promise<void> {
        const bytes = this.parseSize(options.size);
        const sectors = Math.ceil(bytes / 512);
        const label = options.label || 'FXD-Project';
        
        // Create RAM disk
        const { stdout } = await execAsync(`hdiutil attach -nomount ram://${sectors}`);
        const device = stdout.trim();
        
        // Format the disk
        await execAsync(`diskutil erasevolume HFS+ "${label}" ${device}`);
        
        // Create mount point if it doesn't exist
        if (!fs.existsSync(options.mountPoint)) {
            await execAsync(`sudo mkdir -p ${options.mountPoint}`);
        }
        
        // Mount the disk
        await execAsync(`diskutil mount -mountPoint ${options.mountPoint} ${device}`);
    }

    /**
     * Create RAMDisk on Linux
     */
    private async createLinuxRAMDisk(options: RAMDiskOptions): Promise<void> {
        const size = options.size;
        
        // Create mount point if it doesn't exist
        if (!fs.existsSync(options.mountPoint)) {
            await execAsync(`sudo mkdir -p ${options.mountPoint}`);
        }
        
        // Mount tmpfs
        const cmd = `sudo mount -t tmpfs -o size=${size} tmpfs ${options.mountPoint}`;
        await execAsync(cmd);
    }

    /**
     * Create a RAMDisk with platform-specific implementation
     */
    async create(options: Partial<RAMDiskOptions> = {}): Promise<MountedDisk> {
        const projectId = options.projectId || `proj-${Date.now()}`;
        const mountPoint = options.mountPoint || this.getDefaultMountPoint(projectId);
        const size = options.size || '256M';
        
        const fullOptions: RAMDiskOptions = {
            size,
            mountPoint,
            label: options.label,
            projectId
        };
        
        // Check if already mounted
        if (this.mounted.has(projectId)) {
            throw new Error(`Project ${projectId} is already mounted`);
        }
        
        // Platform-specific creation
        switch (this.platform) {
            case 'win32':
                await this.createWindowsRAMDisk(fullOptions);
                break;
            case 'darwin':
                await this.createMacRAMDisk(fullOptions);
                break;
            case 'linux':
                await this.createLinuxRAMDisk(fullOptions);
                break;
            default:
                throw new Error(`Unsupported platform: ${this.platform}`);
        }
        
        // Track mounted disk
        const disk: MountedDisk = {
            id: projectId,
            mountPoint,
            size,
            created: new Date()
        };
        
        this.mounted.set(projectId, disk);
        return disk;
    }

    /**
     * Unmount a RAMDisk
     */
    async unmount(projectId: string): Promise<void> {
        const disk = this.mounted.get(projectId);
        if (!disk) {
            throw new Error(`No mounted disk for project ${projectId}`);
        }
        
        switch (this.platform) {
            case 'win32':
                await execAsync(`imdisk -D -m ${disk.mountPoint}`);
                break;
                
            case 'darwin':
                await execAsync(`diskutil unmount ${disk.mountPoint}`);
                break;
                
            case 'linux':
                await execAsync(`sudo umount ${disk.mountPoint}`);
                break;
        }
        
        this.mounted.delete(projectId);
    }

    /**
     * List all mounted RAMDisks
     */
    listMounted(): MountedDisk[] {
        return Array.from(this.mounted.values());
    }

    /**
     * Check if a project is mounted
     */
    isMounted(projectId: string): boolean {
        return this.mounted.has(projectId);
    }

    /**
     * Get mount point for a project
     */
    getMountPoint(projectId: string): string | undefined {
        return this.mounted.get(projectId)?.mountPoint;
    }

    /**
     * Auto-detect optimal size based on project
     */
    async detectOptimalSize(projectPath: string): Promise<string> {
        const stats = await fs.promises.stat(projectPath);
        
        if (!stats.isDirectory()) {
            // Single file - use file size + 20% buffer
            const sizeBytes = stats.size;
            const bufferSize = Math.ceil(sizeBytes * 1.2);
            
            if (bufferSize < 1024 * 1024) return '1M';
            if (bufferSize < 100 * 1024 * 1024) return `${Math.ceil(bufferSize / (1024 * 1024))}M`;
            return `${Math.ceil(bufferSize / (1024 * 1024 * 1024))}G`;
        }
        
        // Directory - calculate total size
        let totalSize = 0;
        const countSize = async (dir: string) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    await countSize(fullPath);
                } else if (entry.isFile()) {
                    const stat = await fs.promises.stat(fullPath);
                    totalSize += stat.size;
                }
            }
        };
        
        await countSize(projectPath);
        
        // Add 50% buffer for directory
        const bufferSize = Math.ceil(totalSize * 1.5);
        
        if (bufferSize < 10 * 1024 * 1024) return '10M';
        if (bufferSize < 100 * 1024 * 1024) return '100M';
        if (bufferSize < 1024 * 1024 * 1024) return `${Math.ceil(bufferSize / (1024 * 1024))}M`;
        return `${Math.ceil(bufferSize / (1024 * 1024 * 1024))}G`;
    }
}

// Singleton instance
export const ramdisk = new RAMDiskManager();

/**
 * File association handler for .fxd files
 */
export async function handleFXDFile(filepath: string, options: { autoMount?: boolean } = {}) {
    const projectId = path.basename(filepath, '.fxd');
    
    // Check if already mounted
    if (ramdisk.isMounted(projectId)) {
        console.log(`Project ${projectId} is already mounted at ${ramdisk.getMountPoint(projectId)}`);
        return ramdisk.getMountPoint(projectId);
    }
    
    // Detect optimal size
    const size = await ramdisk.detectOptimalSize(filepath);
    
    // Create RAMDisk
    const disk = await ramdisk.create({
        projectId,
        size,
        label: `FXD-${projectId}`
    });
    
    console.log(`Mounted ${filepath} to ${disk.mountPoint} (${size})`);
    
    // Load project data into RAMDisk
    // This will be implemented when persistence layer is ready
    // await loadProjectToRAMDisk(filepath, disk.mountPoint);
    
    return disk.mountPoint;
}

/**
 * Register file association (platform-specific)
 */
export async function registerFileAssociation() {
    switch (process.platform) {
        case 'win32':
            // Windows registry modification
            const regCommands = [
                `reg add "HKCR\\.fxd" /ve /d "FXDProject" /f`,
                `reg add "HKCR\\FXDProject" /ve /d "FXD Project File" /f`,
                `reg add "HKCR\\FXDProject\\DefaultIcon" /ve /d "${process.execPath},0" /f`,
                `reg add "HKCR\\FXDProject\\shell\\open\\command" /ve /d "\\"${process.execPath}\\" \\"%1\\"" /f`
            ];
            
            for (const cmd of regCommands) {
                await execAsync(cmd);
            }
            break;
            
        case 'darwin':
            // macOS - handled in Info.plist during build
            console.log('File association should be configured in Info.plist');
            break;
            
        case 'linux':
            // Linux - create .desktop file
            const desktopEntry = `[Desktop Entry]
Name=FXD
Comment=FX Disk Project Manager
Exec=${process.execPath} %f
Terminal=false
Type=Application
Icon=${path.join(__dirname, '../assets/icon.png')}
MimeType=application/x-fxd;
Categories=Development;`;
            
            const desktopPath = path.join(
                process.env.HOME!,
                '.local/share/applications/fxd.desktop'
            );
            
            await fs.promises.writeFile(desktopPath, desktopEntry);
            await execAsync(`update-desktop-database ~/.local/share/applications/`);
            break;
    }
    
    console.log('File association registered for .fxd files');
}

// Export for use in FX
export default ramdisk;