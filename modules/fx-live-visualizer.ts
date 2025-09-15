/**
 * FX Live Visualizer - Integration Layer
 * Connects fx-atomics hooks with 3D visualizer for real-time code execution visualization
 * Implements the "living graph" experience from atomics.md
 */

import { $$ } from '../fx.ts';
import { FX3DVisualizer } from './fx-visualizer-3d.ts';
import { FXAtomicsPlugin } from '../plugins/fx-atomics.v3.ts';
import { FXTimeTravelPlugin } from '../plugins/fx-time-travel.ts';
import { FXSafePlugin } from '../plugins/fx-safe.ts';

// Live execution tracking
export interface SnippetExecution {
  snippetId: string;
  timestamp: number;
  type: 'read' | 'write' | 'function_call';
  inputValue?: any;
  outputValue?: any;
  duration?: number;
  source: 'local' | 'propagation' | 'subscription';
  metadata?: Record<string, any>;
}

export interface DataFlowConnection {
  from: string;
  to: string;
  value: any;
  timestamp: number;
  active: boolean;
  pulseIntensity: number;
}

export interface VisualizationState {
  activeNodes: Set<string>;
  dataFlows: Map<string, DataFlowConnection>;
  executionHistory: SnippetExecution[];
  selectedNode?: string;
  debugPanel?: {
    visible: boolean;
    nodeId: string;
    executions: SnippetExecution[];
  };
}

export class FXLiveVisualizer {
  private visualizer: FX3DVisualizer;
  private atomics: FXAtomicsPlugin;
  private timeTravel: FXTimeTravelPlugin;
  private safe: FXSafePlugin;
  private state: VisualizationState;
  private executionQueue: SnippetExecution[] = [];
  private processingInterval: number;

  constructor(
    container: HTMLElement,
    fx = $$
  ) {
    // Initialize plugins
    this.atomics = new FXAtomicsPlugin(fx as any);
    this.timeTravel = new FXTimeTravelPlugin(fx as any);
    this.safe = new FXSafePlugin(fx as any);

    // Initialize 3D visualizer
    this.visualizer = new FX3DVisualizer(
      container,
      fx as any,
      this.timeTravel as any,
      this.timeTravel
    );

    // Initialize state
    this.state = {
      activeNodes: new Set(),
      dataFlows: new Map(),
      executionHistory: [],
    };

    // Setup real-time processing
    this.processingInterval = setInterval(() => {
      this.processExecutionQueue();
    }, 16); // 60fps

    // Setup global hooks to track all snippet activity
    this.setupGlobalHooks();

    // Add demo nodes for visualization
    this.setupDemoData();

    console.log('🌟 FX Live Visualizer initialized - watching code execution in real-time');
  }

  private setupGlobalHooks(): void {
    // Watch all snippet nodes for activity
    $$('snippets.**').watch((value: any, path: string) => {
      this.trackSnippetActivity(path, 'write', undefined, value, Date.now());
    });

    // Watch view rendering activity
    $$('views.**').watch((value: any, path: string) => {
      this.trackSnippetActivity(path, 'read', value, undefined, Date.now());
    });
  }

  private setupDemoData(): void {
    // Create some demo snippet nodes in the visualizer
    const demoSnippets = [
      { id: 'snippet.user.card', type: 'snippet' as const, name: 'UserCard' },
      { id: 'snippet.user.list', type: 'snippet' as const, name: 'UserList' },
      { id: 'snippet.profile.header', type: 'snippet' as const, name: 'ProfileHeader' },
      { id: 'snippet.auth.login', type: 'snippet' as const, name: 'LoginForm' },
      { id: 'snippet.data.users', type: 'snippet' as const, name: 'UserRepo' },
    ];

    demoSnippets.forEach(snippet => {
      this.visualizer.addNode(snippet.id, snippet.type, {
        name: snippet.name,
        path: snippet.id,
        hasVersions: true
      });
    });

    // Setup atomic entanglements between related snippets
    this.setupAtomicConnections();
  }

  private setupAtomicConnections(): void {
    // Example: entangle user.card display name with header title
    const displayNameAdapter = this.createFXAdapter('snippet.user.card.displayName');
    const headerTitleAdapter = this.createFXAdapter('snippet.profile.header.title');

    const userCardToHeaderLink = this.atomics.entangle(
      'snippet.user.card.displayName',
      'snippet.profile.header.title',
      {
        mapAToB: (name: string) => name.toUpperCase(),
        hooksA: {
          beforeSet: ({ incoming, current, side, source }) => {
            this.trackSnippetActivity('snippet.user.card', 'write', current, incoming, Date.now(), {
              hook: 'beforeSet',
              side,
              source
            });
            return { action: 'proceed', value: incoming };
          },
          afterSet: ({ value, durationMs, side, source }) => {
            this.trackSnippetActivity('snippet.user.card', 'write', undefined, value, Date.now(), {
              hook: 'afterSet',
              side,
              source,
              duration: durationMs
            });

            // Create visual data flow
            this.createDataFlow('snippet.user.card', 'snippet.profile.header', value);
          }
        },
        hooksB: {
          beforeSet: ({ incoming, current, side, source }) => {
            this.trackSnippetActivity('snippet.profile.header', 'write', current, incoming, Date.now(), {
              hook: 'beforeSet',
              side,
              source
            });
            return { action: 'proceed', value: incoming };
          },
          afterSet: ({ value, durationMs, side, source }) => {
            this.trackSnippetActivity('snippet.profile.header', 'write', undefined, value, Date.now(), {
              hook: 'afterSet',
              side,
              source,
              duration: durationMs
            });
          }
        },
        log: (level, msg, data) => {
          console.debug(`[LiveViz:${level}] ${msg}`, data);
        },
        meta: {
          visualizerConnection: 'user-card-to-header'
        }
      }
    );

    // Example: entangle user list with auth status
    const userListAdapter = this.createFXAdapter('snippet.user.list.users');
    const authStatusAdapter = this.createFXAdapter('snippet.auth.login.status');

    const listToAuthLink = this.atomics.entangle(
      'snippet.user.list.users',
      'snippet.auth.login.status',
      {
        oneWayAToB: true, // Only list affects auth status
        mapAToB: (users: any[]) => users.length > 0 ? 'authenticated' : 'pending',
        hooksA: {
          afterSet: ({ value, side, source }) => {
            this.trackSnippetActivity('snippet.user.list', 'read', undefined, value, Date.now(), {
              hook: 'afterSet',
              side,
              source
            });
            this.createDataFlow('snippet.user.list', 'snippet.auth.login', value);
          }
        },
        hooksB: {
          afterSet: ({ value, side, source }) => {
            this.trackSnippetActivity('snippet.auth.login', 'write', undefined, value, Date.now(), {
              hook: 'afterSet',
              side,
              source
            });
          }
        }
      }
    );
  }

  private createFXAdapter(path: string) {
    return {
      get: () => $$(path).val(),
      set: (value: any) => $$(path).val(value),
      subscribe: (fn: (v: any) => void) => {
        // Simple subscription via FX watch
        $$(path).watch(fn);
        return () => {}; // TODO: implement unsubscribe
      },
      defineValueProperty: (key: string, descriptor: PropertyDescriptor) => {
        // TODO: Wire to FX's internal property system if available
        console.debug(`defineValueProperty called for ${path}.${key}`);
      }
    };
  }

  private trackSnippetActivity(
    snippetId: string,
    type: SnippetExecution['type'],
    inputValue?: any,
    outputValue?: any,
    timestamp = Date.now(),
    metadata?: Record<string, any>
  ): void {
    const execution: SnippetExecution = {
      snippetId,
      timestamp,
      type,
      inputValue,
      outputValue,
      source: metadata?.source || 'local',
      metadata
    };

    // Add to queue for visual processing
    this.executionQueue.push(execution);

    // Add to history
    this.state.executionHistory.push(execution);

    // Keep history manageable
    if (this.state.executionHistory.length > 1000) {
      this.state.executionHistory.shift();
    }

    // Mark node as active
    this.state.activeNodes.add(snippetId);
  }

  private createDataFlow(fromId: string, toId: string, value: any): void {
    const flowId = `${fromId}->${toId}`;
    const flow: DataFlowConnection = {
      from: fromId,
      to: toId,
      value,
      timestamp: Date.now(),
      active: true,
      pulseIntensity: 1.0
    };

    this.state.dataFlows.set(flowId, flow);

    // Auto-fade data flows after 2 seconds
    setTimeout(() => {
      const existingFlow = this.state.dataFlows.get(flowId);
      if (existingFlow) {
        existingFlow.active = false;
        existingFlow.pulseIntensity = 0.3;
      }
    }, 2000);

    // Remove completely after 10 seconds
    setTimeout(() => {
      this.state.dataFlows.delete(flowId);
    }, 10000);
  }

  private processExecutionQueue(): void {
    if (this.executionQueue.length === 0) return;

    // Process up to 10 executions per frame to avoid lag
    const batch = this.executionQueue.splice(0, 10);

    batch.forEach(execution => {
      this.visualizeExecution(execution);
    });
  }

  private visualizeExecution(execution: SnippetExecution): void {
    // Light up the node
    this.lightUpNode(execution.snippetId, execution.type);

    // Show data flow connections
    this.updateDataFlowVisuals();

    // Update debug panel if this node is selected
    if (this.state.selectedNode === execution.snippetId && this.state.debugPanel?.visible) {
      this.updateDebugPanel(execution);
    }
  }

  private lightUpNode(nodeId: string, activityType: SnippetExecution['type']): void {
    // Get the node from visualizer
    const node = this.visualizer['nodes'].get(nodeId);
    if (!node) return;

    // Choose color based on activity type
    const colors = {
      read: 0x00ff00,    // Green for reads
      write: 0xff6600,   // Orange for writes
      function_call: 0x6600ff // Purple for function calls
    };

    const color = colors[activityType] || 0xffffff;

    // Pulse the node
    const material = node.mesh.material as any;
    const originalColor = material.color.getHex();
    const originalIntensity = material.emissiveIntensity;

    // Flash bright
    material.color.setHex(color);
    material.emissive.setHex(color);
    material.emissiveIntensity = 0.8;

    // Animate back to normal
    setTimeout(() => {
      this.animateNodeReturn(material, originalColor, originalIntensity);
    }, 150);

    // Track as recently active
    this.state.activeNodes.add(nodeId);
    setTimeout(() => {
      this.state.activeNodes.delete(nodeId);
    }, 1000);
  }

  private animateNodeReturn(material: any, originalColor: number, originalIntensity: number): void {
    const steps = 20;
    let step = 0;

    const animate = () => {
      step++;
      const progress = step / steps;

      // Ease out animation
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate back to original
      material.emissiveIntensity = 0.8 - (0.8 - originalIntensity) * eased;

      if (step < steps) {
        requestAnimationFrame(animate);
      } else {
        material.color.setHex(originalColor);
        material.emissive.setHex(originalColor);
        material.emissiveIntensity = originalIntensity;
      }
    };

    animate();
  }

  private updateDataFlowVisuals(): void {
    // Remove old flow visuals
    this.clearDataFlowVisuals();

    // Create new visuals for active flows
    this.state.dataFlows.forEach((flow, flowId) => {
      if (flow.active) {
        this.createDataFlowVisual(flow);
      }
    });
  }

  private createDataFlowVisual(flow: DataFlowConnection): void {
    const fromNode = this.visualizer['nodes'].get(flow.from);
    const toNode = this.visualizer['nodes'].get(flow.to);

    if (!fromNode || !toNode) return;

    // Create pulsing connection line
    const geometry = new (window as any).THREE.BufferGeometry();
    const positions = new Float32Array([
      fromNode.position.x, fromNode.position.y, fromNode.position.z,
      toNode.position.x, toNode.position.y, toNode.position.z
    ]);
    geometry.setAttribute('position', new (window as any).THREE.BufferAttribute(positions, 3));

    const material = new (window as any).THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: flow.pulseIntensity,
      linewidth: 3
    });

    const line = new (window as any).THREE.Line(geometry, material);
    line.userData = { isDataFlow: true, flowId: `${flow.from}->${flow.to}` };

    // Add to scene
    this.visualizer['scene'].add(line);

    // Animate pulse effect
    this.animateDataFlowPulse(line, flow);
  }

  private animateDataFlowPulse(line: any, flow: DataFlowConnection): void {
    const material = line.material;
    const startOpacity = flow.pulseIntensity;
    let phase = 0;

    const pulse = () => {
      if (!this.state.dataFlows.has(`${flow.from}->${flow.to}`)) {
        // Flow no longer exists, remove line
        this.visualizer['scene'].remove(line);
        return;
      }

      phase += 0.1;
      const opacity = startOpacity * (0.3 + 0.7 * Math.sin(phase));
      material.opacity = opacity;

      requestAnimationFrame(pulse);
    };

    pulse();
  }

  private clearDataFlowVisuals(): void {
    // Remove old data flow lines
    const toRemove = this.visualizer['scene'].children.filter((child: any) =>
      child.userData?.isDataFlow
    );

    toRemove.forEach((line: any) => {
      this.visualizer['scene'].remove(line);
    });
  }

  // Public API for snippet interaction
  public simulateSnippetCall(snippetId: string, inputData: any): any {
    const startTime = Date.now();

    // Track the call
    this.trackSnippetActivity(snippetId, 'function_call', inputData, undefined, startTime);

    // Simulate processing (in real app, this would be the actual snippet execution)
    setTimeout(() => {
      const outputData = { processed: inputData, timestamp: Date.now() };
      const duration = Date.now() - startTime;

      this.trackSnippetActivity(snippetId, 'function_call', inputData, outputData, Date.now(), {
        duration
      });

      // Create data flows to connected snippets
      this.simulateDataPropagation(snippetId, outputData);

    }, Math.random() * 100 + 50); // Random processing time 50-150ms

    return { pending: true, snippetId };
  }

  private simulateDataPropagation(fromSnippetId: string, data: any): void {
    // Define some demo connections
    const connections: Record<string, string[]> = {
      'snippet.user.card': ['snippet.profile.header', 'snippet.user.list'],
      'snippet.auth.login': ['snippet.user.card', 'snippet.data.users'],
      'snippet.data.users': ['snippet.user.list'],
    };

    const targets = connections[fromSnippetId] || [];

    targets.forEach(targetId => {
      setTimeout(() => {
        this.createDataFlow(fromSnippetId, targetId, data);
        this.trackSnippetActivity(targetId, 'read', data, undefined, Date.now());
      }, Math.random() * 200 + 50);
    });
  }

  // Interactive debugging features
  public selectNodeForDebugging(nodeId: string): void {
    this.state.selectedNode = nodeId;

    // Get execution history for this node
    const nodeExecutions = this.state.executionHistory.filter(exec =>
      exec.snippetId === nodeId
    ).slice(-50); // Last 50 executions

    this.state.debugPanel = {
      visible: true,
      nodeId,
      executions: nodeExecutions
    };

    this.showDebugPanel();
  }

  private showDebugPanel(): void {
    if (!this.state.debugPanel) return;

    // Create or update debug panel UI
    let panel = document.getElementById('fx-debug-panel');
    if (!panel) {
      panel = this.createDebugPanel();
    }

    this.updateDebugPanelContent(panel);
    panel.style.display = 'block';
  }

  private createDebugPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'fx-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 70vh;
      background: rgba(10, 10, 20, 0.95);
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
      color: white;
      font-family: monospace;
      font-size: 12px;
      overflow-y: auto;
      z-index: 2000;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    document.body.appendChild(panel);
    return panel;
  }

  private updateDebugPanelContent(panel: HTMLElement): void {
    if (!this.state.debugPanel) return;

    const { nodeId, executions } = this.state.debugPanel;
    const nodeData = $$(`snippets.${nodeId}`).val() || { name: nodeId };

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="color: #64c8ff; margin: 0;">🔍 ${nodeData.name || nodeId}</h3>
        <button onclick="document.getElementById('fx-debug-panel').style.display='none'"
                style="background: none; border: 1px solid #666; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer;">✕</button>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="color: #888; font-size: 11px;">Path: ${nodeId}</div>
        <div style="color: #888; font-size: 11px;">Executions: ${executions.length}</div>
        <div style="color: #888; font-size: 11px;">Active: ${this.state.activeNodes.has(nodeId) ? '🟢 Yes' : '⚪ No'}</div>
      </div>

      <div style="border-top: 1px solid #333; padding-top: 15px;">
        <h4 style="color: #50e3c2; margin: 0 0 10px 0;">Recent Executions</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${executions.slice(-10).reverse().map(exec => `
            <div style="background: rgba(100,200,255,0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid ${this.getActivityColor(exec.type)};">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #fff; font-weight: bold;">${exec.type.toUpperCase()}</span>
                <span style="color: #888; font-size: 10px;">${new Date(exec.timestamp).toLocaleTimeString()}</span>
              </div>
              ${exec.inputValue !== undefined ? `
                <div style="margin-top: 5px;">
                  <div style="color: #50e3c2; font-size: 10px;">INPUT:</div>
                  <div style="color: #ccc; font-size: 11px; max-height: 60px; overflow: auto;">${JSON.stringify(exec.inputValue, null, 2)}</div>
                </div>
              ` : ''}
              ${exec.outputValue !== undefined ? `
                <div style="margin-top: 5px;">
                  <div style="color: #ff6b6b; font-size: 10px;">OUTPUT:</div>
                  <div style="color: #ccc; font-size: 11px; max-height: 60px; overflow: auto;">${JSON.stringify(exec.outputValue, null, 2)}</div>
                </div>
              ` : ''}
              ${exec.duration ? `
                <div style="margin-top: 5px; color: #888; font-size: 10px;">
                  Duration: ${exec.duration.toFixed(1)}ms
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="border-top: 1px solid #333; padding-top: 15px; margin-top: 15px;">
        <h4 style="color: #feca57; margin: 0 0 10px 0;">Quick Actions</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="fxLiveViz.showTimeline('${nodeId}')"
                  style="background: #333; border: 1px solid #666; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">📊 Timeline</button>
          <button onclick="fxLiveViz.createSnapshot('${nodeId}')"
                  style="background: #333; border: 1px solid #666; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">📸 Snapshot</button>
          <button onclick="fxLiveViz.showConnections('${nodeId}')"
                  style="background: #333; border: 1px solid #666; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">🔗 Connections</button>
        </div>
      </div>
    `;
  }

  private updateDebugPanel(execution: SnippetExecution): void {
    if (!this.state.debugPanel) return;

    this.state.debugPanel.executions.push(execution);

    // Keep recent executions only
    if (this.state.debugPanel.executions.length > 50) {
      this.state.debugPanel.executions.shift();
    }

    // Update the panel content
    const panel = document.getElementById('fx-debug-panel');
    if (panel) {
      this.updateDebugPanelContent(panel);
    }
  }

  private getActivityColor(type: SnippetExecution['type']): string {
    const colors = {
      read: '#00ff00',
      write: '#ff6600',
      function_call: '#6600ff'
    };
    return colors[type] || '#ffffff';
  }

  // Public API for integration
  public showTimeline(nodeId: string): void {
    this.visualizer.showVersionTimeline(nodeId);
  }

  public createSnapshot(nodeId: string): void {
    const snapshot = this.timeTravel.snapshot(`Manual snapshot for ${nodeId}`);
    console.log('📸 Snapshot created:', snapshot.id);

    // Show notification
    this.showNotification(`Snapshot created for ${nodeId}`);
  }

  public showConnections(nodeId: string): void {
    // Highlight all active data flows for this node
    this.state.dataFlows.forEach(flow => {
      if (flow.from === nodeId || flow.to === nodeId) {
        flow.pulseIntensity = 1.0;
        flow.active = true;
      }
    });

    this.updateDataFlowVisuals();
  }

  private showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(100, 200, 255, 0.2);
      color: #64c8ff;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      border: 1px solid #64c8ff;
      z-index: 3000;
      backdrop-filter: blur(10px);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Demo methods for testing
  public startDemo(): void {
    console.log('🎬 Starting live visualization demo...');

    // Simulate user interaction sequence
    setTimeout(() => this.simulateSnippetCall('snippet.auth.login', { username: 'charl', password: '***' }), 500);
    setTimeout(() => this.simulateSnippetCall('snippet.data.users', { query: 'active' }), 1000);
    setTimeout(() => this.simulateSnippetCall('snippet.user.list', { users: ['alice', 'bob', 'charlie'] }), 1500);
    setTimeout(() => this.simulateSnippetCall('snippet.user.card', { user: 'alice' }), 2000);

    // Show debug panel for user.card
    setTimeout(() => this.selectNodeForDebugging('snippet.user.card'), 2500);
  }

  public testDataFlow(): void {
    // Trigger a series of connected calls to show data flow
    $$('snippet.user.card.displayName').val('Charl Cronjé');

    setTimeout(() => {
      $$('snippet.profile.header.title').val('CHARL CRONJÉ');
    }, 500);

    setTimeout(() => {
      $$('snippet.user.list.users').val(['alice', 'bob', 'charl']);
    }, 1000);
  }

  dispose(): void {
    clearInterval(this.processingInterval);
    this.clearDataFlowVisuals();

    const panel = document.getElementById('fx-debug-panel');
    if (panel) {
      panel.remove();
    }
  }
}

// Make it globally accessible for demo
declare global {
  interface Window {
    fxLiveViz: FXLiveVisualizer;
  }
}

export function createLiveVisualizer(container: HTMLElement): FXLiveVisualizer {
  const visualizer = new FXLiveVisualizer(container);
  (window as any).fxLiveViz = visualizer;
  return visualizer;
}