/**
 * Simple FXD Server - Basic working version
 * Gets core functionality running quickly
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { $$ } from '../fx.ts';
import { FXTerminalServer } from '../modules/fx-terminal-server.ts';

const PORT = 3000;

console.log(`
🚀 Starting Simple FXD Server on port ${PORT}

📍 Main App: http://localhost:${PORT}/app
📍 API: http://localhost:${PORT}/api/
📍 Visualizer: http://localhost:8080 (separate server)
`);

// Initialize basic FX data
$$('app.name').val('FXD Simple Server');
$$('app.version').val('1.0.0');
$$('snippets').val({
  'example-1': {
    id: 'example-1',
    name: 'Hello World',
    content: 'console.log("Hello from FXD!");',
    language: 'javascript',
    created: Date.now()
  },
  'example-2': {
    id: 'example-2', 
    name: 'Sample Function',
    content: 'function greet(name) {\n  return `Hello, ${name}!`;\n}',
    language: 'javascript',
    created: Date.now()
  }
});

$$('views').val({
  'main.js': 'console.log("Hello from FXD!");\n\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}',
  'utils.js': '// Utility functions\nexport const helpers = {};'
});

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  console.log(`${req.method} ${path}`);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  try {
    // Route handling
    if (path === '/' || path === '/app') {
      const html = await Deno.readTextFile('./public/fxd-working-app.html');
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    if (path === '/visualizer') {
      const html = await Deno.readTextFile('./public/visualizer-demo.html');
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // API Routes
    if (path.startsWith('/api/')) {
      return await handleAPI(req, corsHeaders);
    }
    
    // Static files
    return await serveDir(req, {
      fsRoot: "./public",
      urlRoot: "/",
      enableCors: true,
    });
    
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

async function handleAPI(req: Request, corsHeaders: HeadersInit): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/', '');
  
  try {
    // Snippets API
    if (path === 'snippets' || path.startsWith('snippets/')) {
      const snippets = $$('snippets').val() || {};
      
      if (req.method === 'GET') {
        return new Response(JSON.stringify(snippets), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (req.method === 'POST') {
        const newSnippet = await req.json();
        const id = crypto.randomUUID();
        newSnippet.id = id;
        newSnippet.created = Date.now();
        
        $$(`snippets.${id}`).val(newSnippet);
        
        return new Response(JSON.stringify(newSnippet), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Views API  
    if (path === 'views' || path.startsWith('views/')) {
      const views = $$('views').val() || {};
      
      if (req.method === 'GET') {
        return new Response(JSON.stringify(views), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (req.method === 'POST') {
        const { name, content } = await req.json();
        $$(`views.${name}`).val(content);
        
        return new Response(JSON.stringify({ name, content }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Status API
    if (path === 'status') {
      return new Response(JSON.stringify({
        status: 'running',
        version: '1.0.0',
        snippets: Object.keys($$('snippets').val() || {}).length,
        views: Object.keys($$('views').val() || {}).length,
        uptime: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Import API - Basic file import
    if (path === 'import' && req.method === 'POST') {
      const { filename, content } = await req.json();
      
      // Simple import - create a view from the file content
      $$(`views.${filename}`).val(content);
      
      return new Response(JSON.stringify({ 
        success: true, 
        filename, 
        message: 'File imported successfully' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

const startTime = Date.now();

// Start terminal server
const terminalServer = new FXTerminalServer(3001);
terminalServer.start().catch(console.error);
terminalServer.startCleanupTask();

console.log('✅ Simple FXD Server ready!');
console.log('📍 Open http://localhost:3000/app to get started');
console.log('🖥️ Terminal WebSocket: ws://localhost:3001');

await serve(handler, { port: PORT });