/**
 * FX VS Code Integration
 * Enables double-click editing of nodes in VS Code from the 3D visualizer
 */

import type { FXCore } from "../fx.ts";

export interface VSCodeConfig {
    executable?: string;
    args?: string[];
    reuseWindow?: boolean;
    wait?: boolean;
}

export class VSCodeIntegration {
    private fx: FXCore;
    private config: VSCodeConfig;
    private tempFiles: Map<string, string> = new Map();
    private watchers: Map<string, any> = new Map();

    constructor(fx: FXCore, config?: VSCodeConfig) {
        this.fx = fx;
        this.config = {
            executable: this.detectVSCode(),
            args: [],
            reuseWindow: true,
            wait: false,
            ...config
        };
    }

    /**
     * Detect VS Code installation
     */
    private detectVSCode(): string {
        const platform = Deno.build.os;
        
        switch (platform) {
            case "windows":
                return "code.cmd";
            case "darwin":
                return "/usr/local/bin/code";
            case "linux":
                return "/usr/bin/code";
            default:
                return "code";
        }
    }

    /**
     * Open a node in VS Code
     */
    async openNode(nodeId: string, content?: string): Promise<void> {
        // Get or create temp file for this node
        let tempFile = this.tempFiles.get(nodeId);
        
        if (!tempFile) {
            const ext = this.getFileExtension(nodeId);
            tempFile = await Deno.makeTempFile({
                prefix: `fx-${nodeId}-`,
                suffix: ext
            });
            this.tempFiles.set(nodeId, tempFile);
        }

        // Write current content
        const nodeContent = content || $$(`snippets.registry.${nodeId}`).val() || '';
        await Deno.writeTextFile(tempFile, nodeContent);

        // Open in VS Code
        await this.openInVSCode(tempFile);

        // Watch for changes
        this.watchFile(tempFile, nodeId);
    }

    /**
     * Open a file in VS Code
     */
    private async openInVSCode(filepath: string): Promise<void> {
        const args = [...this.config.args!];
        
        if (this.config.reuseWindow) {
            args.push('-r');
        }
        
        if (this.config.wait) {
            args.push('-w');
        }
        
        args.push(filepath);

        const command = new Deno.Command(this.config.executable!, {
            args,
            stdout: "piped",
            stderr: "piped"
        });

        const { success, stderr } = await command.output();
        
        if (!success) {
            const error = new TextDecoder().decode(stderr);
            throw new Error(`Failed to open VS Code: ${error}`);
        }
    }

    /**
     * Watch file for changes and sync back to FX
     */
    private async watchFile(filepath: string, nodeId: string): void {
        // Stop existing watcher
        if (this.watchers.has(nodeId)) {
            this.watchers.get(nodeId).close();
        }

        const watcher = Deno.watchFs(filepath);
        this.watchers.set(nodeId, watcher);

        // Process file changes
        for await (const event of watcher) {
            if (event.kind === "modify") {
                await this.syncFromFile(filepath, nodeId);
            }
        }
    }

    /**
     * Sync file changes back to FX node
     */
    private async syncFromFile(filepath: string, nodeId: string): Promise<void> {
        try {
            const content = await Deno.readTextFile(filepath);
            const node = $$(`snippets.registry.${nodeId}`);
            
            // Only update if content changed
            if (node.val() !== content) {
                node.set(content);
                
                // Trigger version snapshot if versioned
                const versionedNode = this.fx.getPath(
                    `snippets.versioned.${nodeId}`,
                    this.fx.root
                );
                
                if (versionedNode) {
                    $$(`snippets.versioned.${nodeId}.snapshot`).set({
                        message: `Edited in VS Code`,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to sync from VS Code: ${error}`);
        }
    }

    /**
     * Get file extension based on node metadata
     */
    private getFileExtension(nodeId: string): string {
        const metadata = $$(`snippets.registry.${nodeId}.__metadata`).val();
        
        if (metadata?.language) {
            switch (metadata.language) {
                case 'javascript': return '.js';
                case 'typescript': return '.ts';
                case 'python': return '.py';
                case 'rust': return '.rs';
                case 'go': return '.go';
                case 'java': return '.java';
                case 'html': return '.html';
                case 'css': return '.css';
                default: return '.txt';
            }
        }
        
        return '.txt';
    }

    /**
     * Open multiple nodes in VS Code workspace
     */
    async openWorkspace(nodeIds: string[]): Promise<void> {
        // Create workspace folder
        const workspaceDir = await Deno.makeTempDir({
            prefix: 'fx-workspace-'
        });

        // Create files for each node
        for (const nodeId of nodeIds) {
            const ext = this.getFileExtension(nodeId);
            const filename = `${nodeId}${ext}`;
            const filepath = `${workspaceDir}/${filename}`;
            
            const content = $$(`snippets.registry.${nodeId}`).val() || '';
            await Deno.writeTextFile(filepath, content);
            
            this.tempFiles.set(nodeId, filepath);
            this.watchFile(filepath, nodeId);
        }

        // Open workspace in VS Code
        await this.openInVSCode(workspaceDir);
    }

    /**
     * Clean up temp files and watchers
     */
    async cleanup(): Promise<void> {
        // Close all watchers
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();

        // Remove temp files
        for (const filepath of this.tempFiles.values()) {
            try {
                await Deno.remove(filepath);
            } catch {
                // File might already be deleted
            }
        }
        this.tempFiles.clear();
    }

    /**
     * Create VS Code settings for FX project
     */
    async createProjectSettings(projectPath: string): Promise<void> {
        const vscodeDir = `${projectPath}/.vscode`;
        await Deno.mkdir(vscodeDir, { recursive: true });

        // Create settings.json
        const settings = {
            "files.associations": {
                "*.fxd": "sqlite",
                "*.fx": "javascript"
            },
            "editor.formatOnSave": true,
            "editor.wordWrap": "on",
            "fx.autoSync": true,
            "fx.visualizerUrl": "http://localhost:8080"
        };

        await Deno.writeTextFile(
            `${vscodeDir}/settings.json`,
            JSON.stringify(settings, null, 2)
        );

        // Create launch.json for debugging
        const launch = {
            "version": "0.2.0",
            "configurations": [
                {
                    "name": "FX Visualizer",
                    "type": "chrome",
                    "request": "launch",
                    "url": "http://localhost:8080",
                    "webRoot": "${workspaceFolder}"
                },
                {
                    "name": "FX Server",
                    "type": "node",
                    "request": "launch",
                    "program": "${workspaceFolder}/server/visualizer-server.ts",
                    "runtimeExecutable": "deno",
                    "runtimeArgs": ["run", "-A"]
                }
            ]
        };

        await Deno.writeTextFile(
            `${vscodeDir}/launch.json`,
            JSON.stringify(launch, null, 2)
        );

        // Create tasks.json
        const tasks = {
            "version": "2.0.0",
            "tasks": [
                {
                    "label": "Start FX Visualizer",
                    "type": "shell",
                    "command": "deno",
                    "args": ["run", "-A", "server/visualizer-server.ts"],
                    "group": {
                        "kind": "build",
                        "isDefault": true
                    }
                },
                {
                    "label": "Mount FXD",
                    "type": "shell",
                    "command": "deno",
                    "args": ["run", "-A", "modules/fx-ramdisk.ts", "mount", "${file}"]
                }
            ]
        };

        await Deno.writeTextFile(
            `${vscodeDir}/tasks.json`,
            JSON.stringify(tasks, null, 2)
        );
    }
}

/**
 * VS Code Extension API for FX
 * This would be used by a VS Code extension
 */
export class VSCodeExtensionAPI {
    private ws?: WebSocket;
    private callbacks: Map<string, (data: any) => void> = new Map();

    /**
     * Connect to FX server
     */
    async connect(url: string = 'ws://localhost:8080/ws'): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('Connected to FX server');
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
        });
    }

    /**
     * Handle messages from FX server
     */
    private handleMessage(message: any): void {
        const { type, data, id } = message;

        switch (type) {
            case 'nodeUpdate':
                this.callbacks.get('nodeUpdate')?.(data);
                break;
            case 'response':
                this.callbacks.get(id)?.(data);
                this.callbacks.delete(id);
                break;
        }
    }

    /**
     * Get node content
     */
    async getNode(nodeId: string): Promise<any> {
        return this.sendRequest('getNode', { nodeId });
    }

    /**
     * Update node content
     */
    async updateNode(nodeId: string, content: any): Promise<void> {
        return this.sendRequest('updateNode', { nodeId, content });
    }

    /**
     * Subscribe to node changes
     */
    onNodeChange(callback: (data: any) => void): void {
        this.callbacks.set('nodeUpdate', callback);
    }

    /**
     * Send request to server
     */
    private sendRequest(type: string, data: any): Promise<any> {
        return new Promise((resolve) => {
            const id = `req-${Date.now()}`;
            this.callbacks.set(id, resolve);
            
            this.ws?.send(JSON.stringify({
                id,
                type,
                data
            }));
        });
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        this.ws?.close();
        this.callbacks.clear();
    }
}

/**
 * Create VS Code integration
 */
export function createVSCodeIntegration(fx: FXCore): VSCodeIntegration {
    return new VSCodeIntegration(fx);
}

/**
 * Example usage
 */
export async function exampleVSCodeWorkflow() {
    const vscode = new VSCodeIntegration(globalThis.fx);

    // Open single node
    await vscode.openNode('snippet-123', 'function hello() { return "world"; }');

    // Open multiple nodes as workspace
    await vscode.openWorkspace(['snippet-123', 'snippet-456', 'snippet-789']);

    // Create project settings
    await vscode.createProjectSettings('./my-project');

    // Clean up when done
    await vscode.cleanup();

    // Extension API example
    const api = new VSCodeExtensionAPI();
    await api.connect();
    
    api.onNodeChange((data) => {
        console.log('Node changed:', data);
    });

    const node = await api.getNode('snippet-123');
    console.log('Node content:', node);

    await api.updateNode('snippet-123', 'function hello() { return "FX!"; }');
}