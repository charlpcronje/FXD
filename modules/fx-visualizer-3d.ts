/**
 * FX 3D Visualizer with Integrated Version Control
 * Interactive 3D visualization of FX nodes with version timelines, branches, and history
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.150.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.150.0/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.150.0/examples/jsm/renderers/CSS2DRenderer';
import { VersionedNode, VersionedNodeFactory } from './fx-versioned-nodes.ts';
import { FXTimeTravelPlugin } from '../plugins/web/fx-time-travel.ts';
import type { FXCore, FXNodeProxy } from '../fx.ts';

export interface NodeVisualization {
    id: string;
    type: 'function' | 'class' | 'variable' | 'snippet' | 'view' | 'component';
    position: THREE.Vector3;
    mesh: THREE.Mesh;
    label: CSS2DObject;
    connections: string[];
    metadata: {
        name: string;
        path: string;
        size: number;
        complexity: number;
        lastModified: Date;
        author?: string;
        version?: string;
        hasVersions?: boolean;
        currentBranch?: string;
    };
    // Version timeline visualization
    timeline?: {
        visible: boolean;
        versions: VersionNode[];
        branches: Map<string, VersionNode[]>;
        currentVersion: string;
    };
}

interface VersionNode {
    id: string;
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    timestamp: number;
    message: string;
    author?: string;
    branch: string;
    isActive: boolean;
}

export class FX3DVisualizer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private labelRenderer: CSS2DRenderer;
    private controls: OrbitControls;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    
    private nodes: Map<string, NodeVisualization> = new Map();
    private versionNodes: Map<string, VersionNode> = new Map();
    private connections: THREE.Line[] = [];
    private selectedNode: NodeVisualization | null = null;
    private hoveredNode: NodeVisualization | null = null;
    
    private fx: FXCore;
    private versionedFactory: VersionedNodeFactory;
    private timeTravel?: FXTimeTravelPlugin;
    
    // Visual settings
    private readonly colors = {
        function: 0x4A90E2,     // Blue
        class: 0xE24A4A,        // Red
        variable: 0x4AE24A,     // Green
        snippet: 0x9B4AE2,      // Purple
        view: 0xE2D74A,         // Gold
        component: 0xE29B4A,    // Orange
        version: 0x00FFFF,      // Cyan
        versionActive: 0x00FF00, // Bright Green
        connection: 0x666666,    // Gray
        versionConnection: 0x00AAFF // Light Blue
    };

    constructor(
        container: HTMLElement,
        fx: FXCore,
        versionedFactory: VersionedNodeFactory,
        timeTravel?: FXTimeTravelPlugin
    ) {
        this.fx = fx;
        this.versionedFactory = versionedFactory;
        this.timeTravel = timeTravel;
        
        // Initialize Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 100, 1000);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            2000
        );
        this.camera.position.set(0, 50, 100);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);
        
        // CSS2D Renderer for labels
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        container.appendChild(this.labelRenderer.domElement);
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Raycaster for interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Lighting
        this.setupLighting();
        
        // Event handlers
        this.setupEventHandlers(container);
        
        // Start animation loop
        this.animate();
    }

    /**
     * Setup lighting
     */
    private setupLighting(): void {
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 50, 50);
        this.scene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-50, 50, -50);
        this.scene.add(pointLight);
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(container: HTMLElement): void {
        // Mouse move
        container.addEventListener('mousemove', (event) => {
            const rect = container.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            this.handleHover();
        });
        
        // Click
        container.addEventListener('click', (event) => {
            this.handleClick();
        });
        
        // Double click
        container.addEventListener('dblclick', (event) => {
            this.handleDoubleClick();
        });
        
        // Right click
        container.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.handleRightClick();
        });
        
        // Keyboard
        window.addEventListener('keydown', (event) => {
            this.handleKeyboard(event);
        });
        
        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
            this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    /**
     * Add a node to the visualization
     */
    addNode(
        path: string,
        type: NodeVisualization['type'],
        metadata: Partial<NodeVisualization['metadata']> = {}
    ): NodeVisualization {
        // Create geometry based on type
        let geometry: THREE.BufferGeometry;
        switch (type) {
            case 'function':
                geometry = new THREE.SphereGeometry(5, 32, 32);
                break;
            case 'class':
                geometry = new THREE.BoxGeometry(8, 8, 8);
                break;
            case 'variable':
                geometry = new THREE.TetrahedronGeometry(6);
                break;
            case 'snippet':
                geometry = new THREE.CylinderGeometry(4, 4, 8);
                break;
            case 'view':
                geometry = new THREE.TorusGeometry(6, 2, 16, 100);
                break;
            case 'component':
                geometry = new THREE.OctahedronGeometry(6);
                break;
            default:
                geometry = new THREE.SphereGeometry(5);
        }
        
        // Create material with glow effect
        const material = new THREE.MeshPhongMaterial({
            color: this.colors[type],
            emissive: this.colors[type],
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.9
        });
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position (can be updated later)
        const position = new THREE.Vector3(
            Math.random() * 200 - 100,
            Math.random() * 100 - 50,
            Math.random() * 200 - 100
        );
        mesh.position.copy(position);
        
        // Create label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'node-label';
        labelDiv.textContent = metadata.name || path.split('.').pop() || 'Node';
        labelDiv.style.color = 'white';
        labelDiv.style.padding = '2px 6px';
        labelDiv.style.background = 'rgba(0, 0, 0, 0.7)';
        labelDiv.style.borderRadius = '3px';
        labelDiv.style.fontSize = '12px';
        labelDiv.style.fontFamily = 'monospace';
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 8, 0);
        mesh.add(label);
        
        // Add to scene
        this.scene.add(mesh);
        
        // Create node visualization object
        const node: NodeVisualization = {
            id: path,
            type,
            position,
            mesh,
            label,
            connections: [],
            metadata: {
                name: path.split('.').pop() || 'node',
                path,
                size: 1,
                complexity: 1,
                lastModified: new Date(),
                ...metadata
            }
        };
        
        // Check if node has versions
        const versionedNode = this.versionedFactory.getAll().get(path);
        if (versionedNode) {
            node.metadata.hasVersions = true;
            node.timeline = {
                visible: false,
                versions: [],
                branches: new Map(),
                currentVersion: 'current'
            };
        }
        
        this.nodes.set(path, node);
        return node;
    }

    /**
     * Show version timeline for a node
     */
    showVersionTimeline(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node || !node.metadata.hasVersions) return;
        
        const versionedNode = this.versionedFactory.getAll().get(nodeId);
        if (!versionedNode) return;
        
        // Get timeline data
        const timelineData = versionedNode.getTimeline3D();
        
        // Clear existing timeline if visible
        if (node.timeline?.visible) {
            this.hideVersionTimeline(nodeId);
        }
        
        // Create version nodes in a spiral around the main node
        node.timeline = {
            visible: true,
            versions: [],
            branches: new Map(),
            currentVersion: timelineData.timeline[timelineData.timeline.length - 1]?.id || 'current'
        };
        
        timelineData.timeline.forEach((version: any, index: number) => {
            // Create version node mesh
            const vGeometry = new THREE.SphereGeometry(2);
            const vMaterial = new THREE.MeshPhongMaterial({
                color: version.id === node.timeline!.currentVersion ? 
                    this.colors.versionActive : this.colors.version,
                emissive: version.id === node.timeline!.currentVersion ?
                    this.colors.versionActive : this.colors.version,
                emissiveIntensity: version.id === node.timeline!.currentVersion ? 0.5 : 0.1,
                transparent: true,
                opacity: 0.8
            });
            const vMesh = new THREE.Mesh(vGeometry, vMaterial);
            
            // Position in spiral
            const angle = index * 0.3;
            const radius = 20 + index * 2;
            const height = index * 3;
            vMesh.position.set(
                node.position.x + Math.cos(angle) * radius,
                node.position.y + height,
                node.position.z + Math.sin(angle) * radius
            );
            
            // Create label for version
            const vLabelDiv = document.createElement('div');
            vLabelDiv.className = 'version-label';
            vLabelDiv.innerHTML = `
                <div style="font-size: 10px; color: #00ffff;">v${index + 1}</div>
                <div style="font-size: 9px; color: #aaa;">${version.message}</div>
                <div style="font-size: 8px; color: #888;">${new Date(version.timestamp).toLocaleTimeString()}</div>
            `;
            vLabelDiv.style.padding = '2px 4px';
            vLabelDiv.style.background = 'rgba(0, 0, 0, 0.8)';
            vLabelDiv.style.borderRadius = '2px';
            vLabelDiv.style.fontFamily = 'monospace';
            vLabelDiv.style.textAlign = 'center';
            const vLabel = new CSS2DObject(vLabelDiv);
            vLabel.position.set(0, 3, 0);
            vMesh.add(vLabel);
            
            this.scene.add(vMesh);
            
            // Store version node
            const versionNode: VersionNode = {
                id: version.id,
                mesh: vMesh,
                position: vMesh.position.clone(),
                timestamp: version.timestamp,
                message: version.message,
                branch: version.branch || 'main',
                isActive: version.id === node.timeline!.currentVersion
            };
            
            node.timeline.versions.push(versionNode);
            this.versionNodes.set(`${nodeId}-${version.id}`, versionNode);
            
            // Group by branch
            if (!node.timeline.branches.has(versionNode.branch)) {
                node.timeline.branches.set(versionNode.branch, []);
            }
            node.timeline.branches.get(versionNode.branch)!.push(versionNode);
        });
        
        // Create connections between versions
        this.createVersionConnections(node, timelineData.connections);
        
        // Animate timeline appearance
        this.animateTimelineAppear(node);
    }

    /**
     * Hide version timeline for a node
     */
    hideVersionTimeline(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node || !node.timeline?.visible) return;
        
        // Remove version nodes
        node.timeline.versions.forEach(vNode => {
            this.scene.remove(vNode.mesh);
            this.versionNodes.delete(`${nodeId}-${vNode.id}`);
        });
        
        // Remove connections
        // (connections are redrawn each frame, so they'll disappear automatically)
        
        node.timeline.visible = false;
        node.timeline.versions = [];
    }

    /**
     * Create connections between version nodes
     */
    private createVersionConnections(node: NodeVisualization, connections: any[]): void {
        connections.forEach(conn => {
            const fromNode = this.versionNodes.get(`${node.id}-${conn.from}`);
            const toNode = this.versionNodes.get(`${node.id}-${conn.to}`);
            
            if (fromNode && toNode) {
                // Create curved connection
                const curve = new THREE.CatmullRomCurve3([
                    fromNode.position,
                    new THREE.Vector3(
                        (fromNode.position.x + toNode.position.x) / 2,
                        (fromNode.position.y + toNode.position.y) / 2 + 5,
                        (fromNode.position.z + toNode.position.z) / 2
                    ),
                    toNode.position
                ]);
                
                const points = curve.getPoints(20);
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: conn.type === 'branch' ? 0xff8800 : this.colors.versionConnection,
                    transparent: true,
                    opacity: 0.6
                });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                this.connections.push(line);
            }
        });
    }

    /**
     * Animate timeline appearance
     */
    private animateTimelineAppear(node: NodeVisualization): void {
        if (!node.timeline) return;
        
        node.timeline.versions.forEach((vNode, index) => {
            // Start scaled down and transparent
            vNode.mesh.scale.set(0, 0, 0);
            (vNode.mesh.material as THREE.MeshPhongMaterial).opacity = 0;
            
            // Animate to full size and opacity
            const delay = index * 50;
            setTimeout(() => {
                this.animateValue(0, 1, 300, (value) => {
                    vNode.mesh.scale.set(value, value, value);
                    (vNode.mesh.material as THREE.MeshPhongMaterial).opacity = value * 0.8;
                });
            }, delay);
        });
    }

    /**
     * Switch to a specific version
     */
    switchToVersion(nodeId: string, versionId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node || !node.timeline) return;
        
        const versionedNode = this.versionedFactory.getAll().get(nodeId);
        if (!versionedNode) return;
        
        // Find version index
        const versionIndex = node.timeline.versions.findIndex(v => v.id === versionId);
        if (versionIndex === -1) return;
        
        // Undo/redo to reach target version
        const currentIndex = node.timeline.versions.findIndex(v => v.isActive);
        const steps = currentIndex - versionIndex;
        
        if (steps > 0) {
            versionedNode.undo(steps);
        } else if (steps < 0) {
            versionedNode.redo(-steps);
        }
        
        // Update visual state
        node.timeline.versions.forEach(vNode => {
            vNode.isActive = vNode.id === versionId;
            const material = vNode.mesh.material as THREE.MeshPhongMaterial;
            material.color.setHex(vNode.isActive ? this.colors.versionActive : this.colors.version);
            material.emissive.setHex(vNode.isActive ? this.colors.versionActive : this.colors.version);
            material.emissiveIntensity = vNode.isActive ? 0.5 : 0.1;
        });
        
        node.timeline.currentVersion = versionId;
        
        // Pulse effect on activated version
        const vNode = this.versionNodes.get(`${nodeId}-${versionId}`);
        if (vNode) {
            this.pulseNode(vNode.mesh);
        }
    }

    /**
     * Create a new branch from current version
     */
    createBranch(nodeId: string, branchName: string): void {
        const versionedNode = this.versionedFactory.getAll().get(nodeId);
        if (!versionedNode) return;
        
        versionedNode.branch(branchName);
        
        // Refresh timeline
        this.hideVersionTimeline(nodeId);
        this.showVersionTimeline(nodeId);
        
        // Show branch indicator
        this.showNotification(`Created branch: ${branchName}`);
    }

    /**
     * Compare two versions visually
     */
    compareVersions(nodeId: string, version1: string, version2: string): void {
        const node = this.nodes.get(nodeId);
        if (!node || !node.timeline) return;
        
        const v1Node = this.versionNodes.get(`${nodeId}-${version1}`);
        const v2Node = this.versionNodes.get(`${nodeId}-${version2}`);
        
        if (!v1Node || !v2Node) return;
        
        // Highlight compared versions
        (v1Node.mesh.material as THREE.MeshPhongMaterial).color.setHex(0xff0000);
        (v2Node.mesh.material as THREE.MeshPhongMaterial).color.setHex(0x00ff00);
        
        // Create comparison line
        const points = [v1Node.position, v2Node.position];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0xffff00,
            linewidth: 2,
            scale: 1,
            dashSize: 3,
            gapSize: 1
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        this.scene.add(line);
        
        // Show diff in UI
        const versionedNode = this.versionedFactory.getAll().get(nodeId);
        if (versionedNode) {
            const comparison = versionedNode.compare(version1, version2);
            this.showDiffPanel(comparison);
        }
    }

    /**
     * Handle hover interaction
     */
    private handleHover(): void {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check main nodes
        const nodeObjects = Array.from(this.nodes.values()).map(n => n.mesh);
        const intersects = this.raycaster.intersectObjects(nodeObjects);
        
        // Reset previous hover
        if (this.hoveredNode) {
            (this.hoveredNode.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2;
            this.hoveredNode = null;
        }
        
        if (intersects.length > 0) {
            const node = Array.from(this.nodes.values()).find(n => n.mesh === intersects[0].object);
            if (node) {
                this.hoveredNode = node;
                (node.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.5;
                this.showTooltip(node);
            }
        }
        
        // Check version nodes
        const versionObjects = Array.from(this.versionNodes.values()).map(v => v.mesh);
        const vIntersects = this.raycaster.intersectObjects(versionObjects);
        
        if (vIntersects.length > 0) {
            const vNode = Array.from(this.versionNodes.values()).find(v => v.mesh === vIntersects[0].object);
            if (vNode) {
                this.showVersionTooltip(vNode);
            }
        }
    }

    /**
     * Handle click interaction
     */
    private handleClick(): void {
        if (this.hoveredNode) {
            this.selectNode(this.hoveredNode);
        }
        
        // Check version nodes
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const versionObjects = Array.from(this.versionNodes.values()).map(v => v.mesh);
        const vIntersects = this.raycaster.intersectObjects(versionObjects);
        
        if (vIntersects.length > 0) {
            const vNode = Array.from(this.versionNodes.values()).find(v => v.mesh === vIntersects[0].object);
            if (vNode) {
                // Find parent node
                const nodeId = vNode.id.split('-')[0];
                this.switchToVersion(nodeId, vNode.id);
            }
        }
    }

    /**
     * Handle double click (open in editor)
     */
    private handleDoubleClick(): void {
        if (this.selectedNode) {
            this.openInEditor(this.selectedNode.id);
        }
    }

    /**
     * Handle right click (context menu)
     */
    private handleRightClick(): void {
        if (this.selectedNode) {
            this.showContextMenu(this.selectedNode);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    private handleKeyboard(event: KeyboardEvent): void {
        if (!this.selectedNode) return;
        
        switch(event.key) {
            case 'v':
                // Toggle version timeline
                if (this.selectedNode.timeline?.visible) {
                    this.hideVersionTimeline(this.selectedNode.id);
                } else {
                    this.showVersionTimeline(this.selectedNode.id);
                }
                break;
            case 'b':
                // Create branch
                const branchName = prompt('Enter branch name:');
                if (branchName) {
                    this.createBranch(this.selectedNode.id, branchName);
                }
                break;
            case 'z':
                if (event.ctrlKey || event.metaKey) {
                    // Undo
                    const vNode = this.versionedFactory.getAll().get(this.selectedNode.id);
                    if (vNode) {
                        vNode.undo();
                        this.refreshTimeline(this.selectedNode.id);
                    }
                }
                break;
            case 'y':
                if (event.ctrlKey || event.metaKey) {
                    // Redo
                    const vNode = this.versionedFactory.getAll().get(this.selectedNode.id);
                    if (vNode) {
                        vNode.redo();
                        this.refreshTimeline(this.selectedNode.id);
                    }
                }
                break;
        }
    }

    /**
     * Select a node
     */
    private selectNode(node: NodeVisualization): void {
        // Deselect previous
        if (this.selectedNode) {
            (this.selectedNode.mesh.material as THREE.MeshPhongMaterial).opacity = 0.9;
        }
        
        this.selectedNode = node;
        (node.mesh.material as THREE.MeshPhongMaterial).opacity = 1;
        
        // Pulse effect
        this.pulseNode(node.mesh);
        
        // Show info panel
        this.showInfoPanel(node);
    }

    /**
     * Show tooltip for node
     */
    private showTooltip(node: NodeVisualization): void {
        const tooltip = document.getElementById('node-tooltip') || this.createTooltip();
        
        const versionedNode = this.versionedFactory.getAll().get(node.id);
        const historyLength = versionedNode ? versionedNode.getHistory().length : 0;
        
        tooltip.innerHTML = `
            <div style="font-weight: bold;">${node.metadata.name}</div>
            <div style="font-size: 11px; color: #aaa;">Type: ${node.type}</div>
            <div style="font-size: 11px; color: #aaa;">Path: ${node.metadata.path}</div>
            ${historyLength > 0 ? `<div style="font-size: 11px; color: #0ff;">Versions: ${historyLength}</div>` : ''}
            ${node.metadata.currentBranch ? `<div style="font-size: 11px; color: #ff0;">Branch: ${node.metadata.currentBranch}</div>` : ''}
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
                Click to select | Double-click to edit | Right-click for menu
                ${node.metadata.hasVersions ? ' | Press V for timeline' : ''}
            </div>
        `;
        
        tooltip.style.display = 'block';
    }

    /**
     * Show tooltip for version node
     */
    private showVersionTooltip(vNode: VersionNode): void {
        const tooltip = document.getElementById('version-tooltip') || this.createVersionTooltip();
        
        tooltip.innerHTML = `
            <div style="font-weight: bold; color: #0ff;">Version ${vNode.id}</div>
            <div style="font-size: 11px; color: #aaa;">${vNode.message}</div>
            <div style="font-size: 10px; color: #888;">${new Date(vNode.timestamp).toLocaleString()}</div>
            ${vNode.author ? `<div style="font-size: 10px; color: #888;">By: ${vNode.author}</div>` : ''}
            ${vNode.branch !== 'main' ? `<div style="font-size: 10px; color: #ff0;">Branch: ${vNode.branch}</div>` : ''}
            ${vNode.isActive ? '<div style="font-size: 10px; color: #0f0;">← Current</div>' : '<div style="font-size: 10px; color: #08f;">Click to checkout</div>'}
        `;
        
        tooltip.style.display = 'block';
    }

    /**
     * Show context menu
     */
    private showContextMenu(node: NodeVisualization): void {
        const menu = document.getElementById('context-menu') || this.createContextMenu();
        
        menu.innerHTML = `
            <div class="menu-item" onclick="visualizer.showVersionTimeline('${node.id}')">Show Timeline</div>
            <div class="menu-item" onclick="visualizer.createBranch('${node.id}', prompt('Branch name:'))">Create Branch</div>
            <div class="menu-item" onclick="visualizer.openInEditor('${node.id}')">Open in Editor</div>
            <div class="menu-item" onclick="visualizer.duplicateNode('${node.id}')">Duplicate</div>
            <div class="menu-item" onclick="visualizer.deleteNode('${node.id}')">Delete</div>
            <hr>
            <div class="menu-item" onclick="visualizer.exportNodeHistory('${node.id}')">Export History</div>
            <div class="menu-item" onclick="visualizer.showDependencies('${node.id}')">Show Dependencies</div>
        `;
        
        menu.style.display = 'block';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
    }

    /**
     * Helper functions
     */
    private pulseNode(mesh: THREE.Mesh): void {
        const scale = mesh.scale.x;
        this.animateValue(scale, scale * 1.3, 200, (value) => {
            mesh.scale.set(value, value, value);
        }, () => {
            this.animateValue(scale * 1.3, scale, 200, (value) => {
                mesh.scale.set(value, value, value);
            });
        });
    }

    private animateValue(
        from: number,
        to: number,
        duration: number,
        onUpdate: (value: number) => void,
        onComplete?: () => void
    ): void {
        const start = performance.now();
        const animate = () => {
            const elapsed = performance.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const value = from + (to - from) * this.easeInOut(progress);
            
            onUpdate(value);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        };
        animate();
    }

    private easeInOut(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    private createTooltip(): HTMLElement {
        const tooltip = document.createElement('div');
        tooltip.id = 'node-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            border: 1px solid #333;
            max-width: 300px;
        `;
        document.body.appendChild(tooltip);
        return tooltip;
    }

    private createVersionTooltip(): HTMLElement {
        const tooltip = document.createElement('div');
        tooltip.id = 'version-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 20, 40, 0.95);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            pointer-events: none;
            z-index: 1001;
            border: 1px solid #0ff;
            max-width: 250px;
        `;
        document.body.appendChild(tooltip);
        return tooltip;
    }

    private createContextMenu(): HTMLElement {
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.style.cssText = `
            position: absolute;
            background: rgba(20, 20, 20, 0.95);
            color: white;
            border: 1px solid #444;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1002;
            display: none;
        `;
        document.body.appendChild(menu);
        
        // Hide on click outside
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });
        
        return menu;
    }

    private showNotification(message: string): void {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 0, 0.2);
            color: #0ff;
            padding: 12px 20px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
            border: 1px solid #0ff;
            z-index: 2000;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    private showInfoPanel(node: NodeVisualization): void {
        // Implementation for info panel
        console.log('Show info panel for', node);
    }

    private showDiffPanel(comparison: any): void {
        // Implementation for diff panel
        console.log('Show diff:', comparison);
    }

    private refreshTimeline(nodeId: string): void {
        if (this.nodes.get(nodeId)?.timeline?.visible) {
            this.hideVersionTimeline(nodeId);
            this.showVersionTimeline(nodeId);
        }
    }

    private openInEditor(nodeId: string): void {
        // Implementation to open in VS Code
        console.log('Open in editor:', nodeId);
    }

    /**
     * Animation loop
     */
    private animate(): void {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        
        // Rotate hovered node
        if (this.hoveredNode) {
            this.hoveredNode.mesh.rotation.y += 0.01;
        }
        
        // Gentle float animation for version nodes
        this.versionNodes.forEach((vNode, key) => {
            const time = performance.now() * 0.001;
            const offset = parseInt(key.split('-').pop() || '0') * 0.5;
            vNode.mesh.position.y = vNode.position.y + Math.sin(time + offset) * 0.2;
        });
        
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}

// Export for global access
(window as any).FX3DVisualizer = FX3DVisualizer;