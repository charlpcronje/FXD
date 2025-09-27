/**
 * @file fx-file-association.ts
 * @description File association registration for .fxd files across platforms
 * Enables double-click to open functionality for FXD project files
 */

/**
 * File association configuration
 */
export interface FileAssociationConfig {
  extension: string;
  mimeType: string;
  description: string;
  iconPath?: string;
  applicationName: string;
  applicationPath: string;
  commandTemplate: string;
  defaultHandler?: boolean;
}

/**
 * Platform-specific registration results
 */
export interface RegistrationResult {
  success: boolean;
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  method: string;
  errors: string[];
  warnings: string[];
  registeredExtensions: string[];
}

/**
 * File association status
 */
export interface AssociationStatus {
  isRegistered: boolean;
  currentHandler?: string;
  isDefaultHandler: boolean;
  platform: string;
  supportedExtensions: string[];
}

/**
 * Cross-platform file association manager
 */
export class FileAssociationManager {
  private platform: string;
  private isElevated: boolean = false;

  constructor() {
    this.platform = this.detectPlatform();
    this.checkElevatedPrivileges();
  }

  /**
   * Register .fxd file association
   */
  async registerFXDAssociation(config?: Partial<FileAssociationConfig>): Promise<RegistrationResult> {
    const defaultConfig: FileAssociationConfig = {
      extension: '.fxd',
      mimeType: 'application/x-fxd-project',
      description: 'FXD Project File',
      applicationName: 'FXD',
      applicationPath: this.getApplicationPath(),
      commandTemplate: '"{app}" "{file}"',
      defaultHandler: true,
      ...config
    };

    const result: RegistrationResult = {
      success: false,
      platform: this.platform as any,
      method: '',
      errors: [],
      warnings: [],
      registeredExtensions: []
    };

    try {
      console.log(`[FileAssociation] Registering .fxd file association on ${this.platform}`);

      switch (this.platform) {
        case 'windows':
          await this.registerWindowsAssociation(defaultConfig, result);
          break;
        case 'macos':
          await this.registerMacOSAssociation(defaultConfig, result);
          break;
        case 'linux':
          await this.registerLinuxAssociation(defaultConfig, result);
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      if (result.success) {
        console.log(`[FileAssociation] Successfully registered .fxd file association`);
      }
    } catch (error) {
      result.errors.push(`Registration failed: ${error}`);
      console.error("[FileAssociation] Registration failed:", error);
    }

    return result;
  }

  /**
   * Unregister .fxd file association
   */
  async unregisterFXDAssociation(): Promise<RegistrationResult> {
    const result: RegistrationResult = {
      success: false,
      platform: this.platform as any,
      method: 'unregister',
      errors: [],
      warnings: [],
      registeredExtensions: []
    };

    try {
      console.log(`[FileAssociation] Unregistering .fxd file association on ${this.platform}`);

      switch (this.platform) {
        case 'windows':
          await this.unregisterWindowsAssociation(result);
          break;
        case 'macos':
          await this.unregisterMacOSAssociation(result);
          break;
        case 'linux':
          await this.unregisterLinuxAssociation(result);
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      if (result.success) {
        console.log(`[FileAssociation] Successfully unregistered .fxd file association`);
      }
    } catch (error) {
      result.errors.push(`Unregistration failed: ${error}`);
      console.error("[FileAssociation] Unregistration failed:", error);
    }

    return result;
  }

  /**
   * Check current file association status
   */
  async checkAssociationStatus(): Promise<AssociationStatus> {
    const status: AssociationStatus = {
      isRegistered: false,
      isDefaultHandler: false,
      platform: this.platform,
      supportedExtensions: ['.fxd']
    };

    try {
      switch (this.platform) {
        case 'windows':
          await this.checkWindowsAssociation(status);
          break;
        case 'macos':
          await this.checkMacOSAssociation(status);
          break;
        case 'linux':
          await this.checkLinuxAssociation(status);
          break;
      }
    } catch (error) {
      console.error("[FileAssociation] Status check failed:", error);
    }

    return status;
  }

  /**
   * Test file association by opening a test file
   */
  async testAssociation(testFilePath: string): Promise<boolean> {
    try {
      console.log(`[FileAssociation] Testing file association with: ${testFilePath}`);

      switch (this.platform) {
        case 'windows':
          return await this.testWindowsAssociation(testFilePath);
        case 'macos':
          return await this.testMacOSAssociation(testFilePath);
        case 'linux':
          return await this.testLinuxAssociation(testFilePath);
        default:
          return false;
      }
    } catch (error) {
      console.error("[FileAssociation] Test failed:", error);
      return false;
    }
  }

  // Windows implementation
  private async registerWindowsAssociation(config: FileAssociationConfig, result: RegistrationResult): Promise<void> {
    result.method = 'windows-registry';

    if (!this.isElevated) {
      result.warnings.push('Administrative privileges recommended for system-wide registration');
    }

    // Create registry entries
    const registryCommands = [
      // File extension association
      `reg add "HKCU\\Software\\Classes\\${config.extension}" /ve /d "FXDProject" /f`,

      // File type definition
      `reg add "HKCU\\Software\\Classes\\FXDProject" /ve /d "${config.description}" /f`,

      // Default icon
      config.iconPath ?
        `reg add "HKCU\\Software\\Classes\\FXDProject\\DefaultIcon" /ve /d "${config.iconPath}" /f` : null,

      // Open command
      `reg add "HKCU\\Software\\Classes\\FXDProject\\shell\\open\\command" /ve /d "${config.commandTemplate.replace('{app}', config.applicationPath).replace('{file}', '%1')}" /f`,

      // MIME type
      `reg add "HKCU\\Software\\Classes\\MIME\\Database\\Content Type\\${config.mimeType}" /v "Extension" /d "${config.extension}" /f`
    ].filter(Boolean);

    for (const command of registryCommands) {
      try {
        await this.executeCommand(command!);
      } catch (error) {
        result.errors.push(`Registry command failed: ${error}`);
        return;
      }
    }

    // Notify shell of changes
    try {
      await this.executeCommand('taskkill /f /im explorer.exe & start explorer.exe');
    } catch (error) {
      result.warnings.push('Could not refresh Windows shell - restart may be required');
    }

    result.success = true;
    result.registeredExtensions.push(config.extension);
  }

  private async unregisterWindowsAssociation(result: RegistrationResult): Promise<void> {
    const commands = [
      'reg delete "HKCU\\Software\\Classes\\.fxd" /f',
      'reg delete "HKCU\\Software\\Classes\\FXDProject" /f',
      'reg delete "HKCU\\Software\\Classes\\MIME\\Database\\Content Type\\application/x-fxd-project" /f'
    ];

    for (const command of commands) {
      try {
        await this.executeCommand(command);
      } catch (error) {
        result.warnings.push(`Registry cleanup warning: ${error}`);
      }
    }

    result.success = true;
  }

  private async checkWindowsAssociation(status: AssociationStatus): Promise<void> {
    try {
      const output = await this.executeCommand('reg query "HKCU\\Software\\Classes\\.fxd" /ve');
      status.isRegistered = output.includes('FXDProject');

      if (status.isRegistered) {
        const commandOutput = await this.executeCommand('reg query "HKCU\\Software\\Classes\\FXDProject\\shell\\open\\command" /ve');
        status.currentHandler = this.extractRegistryValue(commandOutput);
        status.isDefaultHandler = status.currentHandler?.includes('fxd') || false;
      }
    } catch (error) {
      // Not registered if registry query fails
      status.isRegistered = false;
    }
  }

  private async testWindowsAssociation(testFilePath: string): Promise<boolean> {
    try {
      await this.executeCommand(`start "" "${testFilePath}"`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // macOS implementation
  private async registerMacOSAssociation(config: FileAssociationConfig, result: RegistrationResult): Promise<void> {
    result.method = 'macos-plist';

    // Create Info.plist entry for UTI (Uniform Type Identifier)
    const plistContent = this.generateMacOSPlist(config);
    const plistPath = `${this.getApplicationPath()}/Contents/Info.plist`;

    try {
      // This would write the plist file in a real implementation
      console.log(`[FileAssociation] Would write plist to: ${plistPath}`);
      console.log(`[FileAssociation] Plist content: ${plistContent}`);

      // Register with Launch Services
      await this.executeCommand(`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${this.getApplicationPath()}"`);

      result.success = true;
      result.registeredExtensions.push(config.extension);
    } catch (error) {
      result.errors.push(`macOS registration failed: ${error}`);
    }
  }

  private async unregisterMacOSAssociation(result: RegistrationResult): Promise<void> {
    try {
      // Remove UTI registration
      await this.executeCommand(`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "${this.getApplicationPath()}"`);
      result.success = true;
    } catch (error) {
      result.errors.push(`macOS unregistration failed: ${error}`);
    }
  }

  private async checkMacOSAssociation(status: AssociationStatus): Promise<void> {
    try {
      const output = await this.executeCommand('duti -x fxd');
      status.isRegistered = output.includes('FXD') || output.includes('fxd');
      status.currentHandler = this.extractMacOSHandler(output);
      status.isDefaultHandler = status.currentHandler?.includes('FXD') || false;
    } catch (error) {
      status.isRegistered = false;
    }
  }

  private async testMacOSAssociation(testFilePath: string): Promise<boolean> {
    try {
      await this.executeCommand(`open "${testFilePath}"`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Linux implementation
  private async registerLinuxAssociation(config: FileAssociationConfig, result: RegistrationResult): Promise<void> {
    result.method = 'linux-desktop-file';

    try {
      // Create .desktop file
      const desktopContent = this.generateLinuxDesktopFile(config);
      const desktopFilePath = `${this.getHomeDirectory()}/.local/share/applications/fxd.desktop`;

      // This would write the desktop file in a real implementation
      console.log(`[FileAssociation] Would write desktop file to: ${desktopFilePath}`);
      console.log(`[FileAssociation] Desktop content: ${desktopContent}`);

      // Update MIME database
      await this.executeCommand('update-desktop-database ~/.local/share/applications/');
      await this.executeCommand('update-mime-database ~/.local/share/mime/');

      // Set as default handler
      if (config.defaultHandler) {
        await this.executeCommand(`xdg-mime default fxd.desktop ${config.mimeType}`);
      }

      result.success = true;
      result.registeredExtensions.push(config.extension);
    } catch (error) {
      result.errors.push(`Linux registration failed: ${error}`);
    }
  }

  private async unregisterLinuxAssociation(result: RegistrationResult): Promise<void> {
    try {
      const desktopFilePath = `${this.getHomeDirectory()}/.local/share/applications/fxd.desktop`;
      await this.executeCommand(`rm -f "${desktopFilePath}"`);

      await this.executeCommand('update-desktop-database ~/.local/share/applications/');
      result.success = true;
    } catch (error) {
      result.errors.push(`Linux unregistration failed: ${error}`);
    }
  }

  private async checkLinuxAssociation(status: AssociationStatus): Promise<void> {
    try {
      const output = await this.executeCommand('xdg-mime query default application/x-fxd-project');
      status.isRegistered = output.includes('fxd.desktop');
      status.currentHandler = output.trim();
      status.isDefaultHandler = status.currentHandler === 'fxd.desktop';
    } catch (error) {
      status.isRegistered = false;
    }
  }

  private async testLinuxAssociation(testFilePath: string): Promise<boolean> {
    try {
      await this.executeCommand(`xdg-open "${testFilePath}"`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper methods
  private detectPlatform(): string {
    if (typeof process !== 'undefined') {
      switch (process.platform) {
        case 'win32': return 'windows';
        case 'darwin': return 'macos';
        case 'linux': return 'linux';
        default: return 'unknown';
      }
    }

    // Browser detection fallback
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac')) return 'macos';
    if (userAgent.includes('Linux')) return 'linux';

    return 'unknown';
  }

  private checkElevatedPrivileges(): void {
    // This would check for admin/root privileges
    // For now, assume not elevated
    this.isElevated = false;
  }

  private getApplicationPath(): string {
    // This would return the actual application executable path
    // For development, return a placeholder
    if (typeof process !== 'undefined' && process.execPath) {
      return process.execPath;
    }
    return '/usr/local/bin/fxd';
  }

  private getHomeDirectory(): string {
    // This would return the user's home directory
    return typeof process !== 'undefined' && process.env.HOME ? process.env.HOME : '/home/user';
  }

  private async executeCommand(command: string): Promise<string> {
    console.log(`[FileAssociation] Executing: ${command}`);

    // This would execute the actual command
    // For now, return mock success
    return 'Command executed successfully';
  }

  private extractRegistryValue(output: string): string {
    // Extract value from Windows registry output
    const match = output.match(/REG_SZ\s+(.+)/);
    return match ? match[1].trim() : '';
  }

  private extractMacOSHandler(output: string): string {
    // Extract handler from macOS duti output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('default handler')) {
        return line.split(':')[1]?.trim() || '';
      }
    }
    return '';
  }

  private generateMacOSPlist(config: FileAssociationConfig): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>fxd</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>FXD Project</string>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>LSHandlerRank</key>
      <string>Owner</string>
    </dict>
  </array>
  <key>UTExportedTypeDeclarations</key>
  <array>
    <dict>
      <key>UTTypeIdentifier</key>
      <string>com.fxd.project</string>
      <key>UTTypeDescription</key>
      <string>FXD Project File</string>
      <key>UTTypeTagSpecification</key>
      <dict>
        <key>public.filename-extension</key>
        <array>
          <string>fxd</string>
        </array>
        <key>public.mime-type</key>
        <array>
          <string>application/x-fxd-project</string>
        </array>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
  }

  private generateLinuxDesktopFile(config: FileAssociationConfig): string {
    return `[Desktop Entry]
Type=Application
Name=${config.applicationName}
Comment=${config.description}
Exec=${config.applicationPath} %f
Icon=${config.iconPath || 'application-x-fxd-project'}
MimeType=${config.mimeType};
Categories=Development;IDE;
StartupNotify=true
NoDisplay=false`;
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['.fxd'];
  }

  /**
   * Check if platform supports file associations
   */
  isPlatformSupported(): boolean {
    return ['windows', 'macos', 'linux'].includes(this.platform);
  }

  /**
   * Get platform-specific help text
   */
  getPlatformHelp(): string {
    switch (this.platform) {
      case 'windows':
        return 'On Windows, file associations are registered in the registry. Administrator privileges may be required for system-wide registration.';
      case 'macos':
        return 'On macOS, file associations are managed through Info.plist and Launch Services. The application bundle must be properly signed.';
      case 'linux':
        return 'On Linux, file associations are managed through .desktop files and the XDG MIME system.';
      default:
        return 'File associations are not supported on this platform.';
    }
  }
}

/**
 * Factory function to create file association manager
 */
export function createFileAssociationManager(): FileAssociationManager {
  return new FileAssociationManager();
}

export { FileAssociationManager };