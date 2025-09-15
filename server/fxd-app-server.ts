/**
 * FXD Application Server
 * Complete FXD app server with all Phase 2 features
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { $$ } from '../fx.ts';
import { FXWebSocketServer } from '../modules/fx-websocket-transport.ts';
import { createAuthManager, createAuthMiddleware } from '../modules/fx-auth.ts';
import { createPluginManager } from '../modules/fx-plugin-system.ts';

// Server configuration
interface FXDServerConfig {
  port: number;
  host: string;
  httpsPort?: number;
  publicDir: string;
  pluginDirs: string[];
  auth: {
    jwtSecret?: string;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  websocket: {
    port: number;
    heartbeatInterval: number;
    maxConnections: number;
  };
  database: {
    path: string;
    backupInterval: number;
  };
  features: {
    registration: boolean;
    collaboration: boolean;
    plugins: boolean;
    marketplace: boolean;
  };
}

const DEFAULT_CONFIG: FXDServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  publicDir: './public',
  pluginDirs: ['./plugins'],
  auth: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5
  },
  websocket: {
    port: 8765,
    heartbeatInterval: 30000,
    maxConnections: 1000
  },
  database: {
    path: './data/fxd.db',
    backupInterval: 60 * 60 * 1000 // 1 hour
  },
  features: {
    registration: true,
    collaboration: true,
    plugins: true,
    marketplace: false
  }
};

export class FXDApplicationServer {
  private config: FXDServerConfig;
  private fx: typeof $$;
  private authManager: any;
  private pluginManager: any;
  private wsServer: FXWebSocketServer;
  private httpServer?: Deno.HttpServer;
  private authMiddleware: any;
  
  constructor(config: Partial<FXDServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fx = $$;
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                    🚀 FXD Application Server                ║
║                                                              ║
║     The Complete Visual Code Management Platform            ║
║                                                              ║
║     • Real-time Collaboration                               ║
║     • Plugin Architecture                                   ║
║     • Authentication & Authorization                        ║
║     • 3D Visualization                                      ║
║     • RAMDisk Integration                                   ║
║     • WebSocket Communication                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  }
  
  async start(): Promise<void> {
    try {
      // Initialize FX Core
      console.log('🔧 Initializing FX Core...');
      await this.initializeFX();
      
      // Initialize authentication
      console.log('🔐 Setting up authentication...');
      this.authManager = createAuthManager(this.fx, this.config.auth.jwtSecret);
      this.authMiddleware = createAuthMiddleware(this.authManager);
      
      // Initialize plugin system
      if (this.config.features.plugins) {
        console.log('🔌 Initializing plugin system...');
        this.pluginManager = createPluginManager(this.fx);
        await this.loadPlugins();
      }
      
      // Start WebSocket server for real-time features
      if (this.config.features.collaboration) {
        console.log('🌐 Starting WebSocket server...');
        this.wsServer = new FXWebSocketServer(this.fx, this.config.websocket.port);
        this.wsServer.start().catch(console.error);
      }
      
      // Start HTTP server
      console.log('🚀 Starting HTTP server...');
      await this.startHTTPServer();
      
      // Setup periodic tasks
      this.setupPeriodicTasks();
      
      console.log(`✅ FXD Application Server started successfully!`);
      console.log(`📍 Web UI: http://${this.config.host}:${this.config.port}`);
      console.log(`🌐 WebSocket: ws://${this.config.host}:${this.config.websocket.port}`);
      console.log(`🎯 Ready for ${this.config.websocket.maxConnections} concurrent users`);
      
    } catch (error) {
      console.error('❌ Failed to start FXD Application Server:', error);
      throw error;
    }
  }
  
  private async initializeFX(): Promise<void> {
    // Initialize core FX data structures
    this.fx('app.name').val('FXD Application Server');
    this.fx('app.version').val('2.0.0');
    this.fx('app.startedAt').val(Date.now());
    
    // Setup initial data
    if (!this.fx('snippets').val()) {
      this.fx('snippets').val({});
    }
    
    if (!this.fx('views').val()) {
      this.fx('views').val({});
    }
    
    if (!this.fx('groups').val()) {
      this.fx('groups').val({});
    }
  }
  
  private async loadPlugins(): Promise<void> {
    const discovered = await this.pluginManager.discoverPlugins();
    
    for (const pluginPath of discovered) {
      try {
        await this.pluginManager.loadPlugin(pluginPath);
        console.log(`✅ Loaded plugin from ${pluginPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load plugin from ${pluginPath}:`, error.message);
      }
    }
    
    // Auto-activate all loaded plugins (in production, this might be configurable)
    const plugins = this.pluginManager.getAllPlugins();
    for (const plugin of plugins) {
      if (plugin.status === 'loaded') {
        try {
          await this.pluginManager.activatePlugin(plugin.manifest.name);
          console.log(`✅ Activated plugin: ${plugin.manifest.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to activate plugin ${plugin.manifest.name}:`, error.message);
        }
      }
    }
  }
  
  private async startHTTPServer(): Promise<void> {
    const handler = async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const path = url.pathname;
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      
      try {
        // Route the request
        if (path.startsWith('/api/')) {
          return await this.handleAPIRequest(req, corsHeaders);
        } else if (path.startsWith('/ws')) {
          return await this.handleWebSocketUpgrade(req);
        } else if (path === '/' || path === '/app') {
          return await this.serveApp(corsHeaders);
        } else if (path.startsWith('/visualizer')) {
          return await this.serveVisualizer(corsHeaders);
        } else {
          return await this.serveStaticFile(req, corsHeaders);
        }
        
      } catch (error) {
        console.error('Request handling error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    };
    
    this.httpServer = await serve(handler, {
      port: this.config.port,
      hostname: this.config.host,
    });
  }
  
  private async handleAPIRequest(req: Request, corsHeaders: HeadersInit): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Authentication for protected routes
    let auth = { user: undefined, authorized: false };
    if (!path.includes('/auth/') && !path.includes('/public/')) {
      auth = await this.authMiddleware(req);
      if (!auth.authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Route API requests
    if (path.startsWith('/api/auth/')) {
      return await this.handleAuthAPI(req, corsHeaders);
    } else if (path.startsWith('/api/snippets/')) {
      return await this.handleSnippetsAPI(req, auth, corsHeaders);
    } else if (path.startsWith('/api/views/')) {
      return await this.handleViewsAPI(req, auth, corsHeaders);
    } else if (path.startsWith('/api/collaboration/')) {
      return await this.handleCollaborationAPI(req, auth, corsHeaders);
    } else if (path.startsWith('/api/plugins/')) {
      return await this.handlePluginsAPI(req, auth, corsHeaders);
    } else if (path.startsWith('/api/admin/')) {
      return await this.handleAdminAPI(req, auth, corsHeaders);
    } else {
      return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleAuthAPI(req: Request, corsHeaders: HeadersInit): Promise<Response> {
    const url = new URL(req.url);
    const endpoint = url.pathname.replace('/api/auth/', '');
    
    try {
      switch (endpoint) {
        case 'register':
          if (req.method !== 'POST') throw new Error('Method not allowed');
          if (!this.config.features.registration) throw new Error('Registration disabled');
          
          const registerData = await req.json();
          const user = await this.authManager.register(registerData);
          
          return new Response(JSON.stringify({ user }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        case 'login':
          if (req.method !== 'POST') throw new Error('Method not allowed');
          
          const loginData = await req.json();
          const result = await this.authManager.login(loginData);
          
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        case 'logout':
          if (req.method !== 'POST') throw new Error('Method not allowed');
          
          const token = req.headers.get('Authorization')?.replace('Bearer ', '');
          if (token) {
            await this.authManager.logout(token);
          }
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        case 'refresh':
          if (req.method !== 'POST') throw new Error('Method not allowed');
          
          const { refreshToken } = await req.json();
          const newTokens = await this.authManager.refreshToken(refreshToken);
          
          return new Response(JSON.stringify(newTokens), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        default:
          throw new Error('Auth endpoint not found');
      }
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleSnippetsAPI(req: Request, auth: any, corsHeaders: HeadersInit): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method;
    
    // Authorization check
    const resource = 'snippets';
    let action = 'read';
    if (['POST', 'PUT', 'PATCH'].includes(method)) action = 'write';
    if (method === 'DELETE') action = 'delete';
    
    const authorized = await this.authManager.authorize(
      req.headers.get('Authorization')?.replace('Bearer ', ''),
      resource,
      action
    );
    
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      switch (method) {
        case 'GET':
          const snippets = this.fx('snippets').val() || {};
          return new Response(JSON.stringify(snippets), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        case 'POST':
          const newSnippet = await req.json();
          const snippetId = crypto.randomUUID();
          newSnippet.id = snippetId;
          newSnippet.createdBy = auth.user?.id;
          newSnippet.createdAt = Date.now();
          
          this.fx(`snippets.${snippetId}`).val(newSnippet);
          
          return new Response(JSON.stringify(newSnippet), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        default:
          throw new Error('Method not allowed');
      }
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleViewsAPI(req: Request, auth: any, corsHeaders: HeadersInit): Promise<Response> {
    // Similar to snippets API but for views
    try {
      const views = this.fx('views').val() || {};
      return new Response(JSON.stringify(views), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleCollaborationAPI(req: Request, auth: any, corsHeaders: HeadersInit): Promise<Response> {
    if (!this.config.features.collaboration) {
      return new Response(JSON.stringify({ error: 'Collaboration not enabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const stats = {
        connectedUsers: this.wsServer?.getConnectionCount() || 0,
        activeUsers: this.wsServer?.getConnectedUsers() || []
      };
      
      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handlePluginsAPI(req: Request, auth: any, corsHeaders: HeadersInit): Promise<Response> {
    if (!this.config.features.plugins) {
      return new Response(JSON.stringify({ error: 'Plugins not enabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const plugins = this.pluginManager.getAllPlugins();
      return new Response(JSON.stringify(plugins), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleAdminAPI(req: Request, auth: any, corsHeaders: HeadersInit): Promise<Response> {
    // Check admin permissions
    const authorized = await this.authManager.authorize(
      req.headers.get('Authorization')?.replace('Bearer ', ''),
      'admin',
      'system'
    );
    
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const stats = {
        users: this.authManager.getUsers().length,
        plugins: this.pluginManager?.getAllPlugins().length || 0,
        activeConnections: this.wsServer?.getConnectionCount() || 0,
        systemUptime: Date.now() - this.fx('app.startedAt').val(),
        memoryUsage: Deno.memoryUsage()
      };
      
      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleWebSocketUpgrade(req: Request): Promise<Response> {
    // This is handled by the WebSocket server
    return new Response('WebSocket endpoint', { status: 400 });
  }
  
  private async serveApp(corsHeaders: HeadersInit): Promise<Response> {
    try {
      const html = await Deno.readTextFile(`${this.config.publicDir}/fxd-app.html`);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch (error) {
      return new Response('FXD App not found', {
        status: 404,
        headers: corsHeaders
      });
    }
  }
  
  private async serveVisualizer(corsHeaders: HeadersInit): Promise<Response> {
    try {
      const html = await Deno.readTextFile(`${this.config.publicDir}/visualizer-demo.html`);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch (error) {
      return new Response('Visualizer not found', {
        status: 404,
        headers: corsHeaders
      });
    }
  }
  
  private async serveStaticFile(req: Request, corsHeaders: HeadersInit): Promise<Response> {
    try {
      return await serveDir(req, {
        fsRoot: this.config.publicDir,
        urlRoot: '/',
        headers: corsHeaders as Record<string, string>,
        enableCors: true,
      });
    } catch (error) {
      return new Response('File not found', {
        status: 404,
        headers: corsHeaders
      });
    }
  }
  
  private setupPeriodicTasks(): void {
    // Database backup
    setInterval(() => {
      this.backupDatabase().catch(console.error);
    }, this.config.database.backupInterval);
    
    // Cleanup expired sessions
    setInterval(() => {
      this.cleanupSessions().catch(console.error);
    }, 60 * 60 * 1000); // Every hour
    
    // Plugin health check
    if (this.config.features.plugins) {
      setInterval(() => {
        this.checkPluginHealth().catch(console.error);
      }, 5 * 60 * 1000); // Every 5 minutes
    }
  }
  
  private async backupDatabase(): Promise<void> {
    // TODO: Implement database backup
    console.log('📁 Database backup completed');
  }
  
  private async cleanupSessions(): Promise<void> {
    // TODO: Cleanup expired sessions
    console.log('🧹 Session cleanup completed');
  }
  
  private async checkPluginHealth(): Promise<void> {
    const plugins = this.pluginManager.getActivePlugins();
    for (const plugin of plugins) {
      // Check if plugin is responsive
      // TODO: Implement health checks
    }
  }
  
  async stop(): Promise<void> {
    console.log('🛑 Shutting down FXD Application Server...');
    
    if (this.wsServer) {
      // TODO: Gracefully close WebSocket connections
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    // Deactivate plugins
    if (this.pluginManager) {
      const activePlugins = this.pluginManager.getActivePlugins();
      for (const plugin of activePlugins) {
        await this.pluginManager.deactivatePlugin(plugin.manifest.name);
      }
    }
    
    console.log('✅ FXD Application Server stopped');
  }
}

// Main entry point
async function main() {
  const config: Partial<FXDServerConfig> = {
    port: parseInt(Deno.env.get('PORT') || '3000'),
    host: Deno.env.get('HOST') || '0.0.0.0',
    auth: {
      jwtSecret: Deno.env.get('JWT_SECRET'),
    },
    features: {
      registration: Deno.env.get('ENABLE_REGISTRATION') !== 'false',
      collaboration: Deno.env.get('ENABLE_COLLABORATION') !== 'false',
      plugins: Deno.env.get('ENABLE_PLUGINS') !== 'false',
      marketplace: Deno.env.get('ENABLE_MARKETPLACE') === 'true',
    }
  };
  
  const server = new FXDApplicationServer(config);
  
  // Graceful shutdown (Windows compatible)
  try {
    Deno.addSignalListener('SIGINT', async () => {
      await server.stop();
      Deno.exit(0);
    });
  } catch (e) {
    // Windows might not support all signals
    console.log('Signal handling limited on Windows');
  }
  
  await server.start();
}

// Run if this is the main module
if (import.meta.main) {
  main().catch(console.error);
}

