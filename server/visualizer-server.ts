/**
 * Simple server for FX 3D Visualizer Demo
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";

const PORT = 8080;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     FX 3D Visualizer with Version Control                ║
║                                                           ║
║     Server running at: http://localhost:${PORT}/         ║
║                                                           ║
║     Features:                                             ║
║     • 3D node visualization                              ║
║     • Version timelines as spiral paths                  ║
║     • Interactive version switching                      ║
║     • Branch creation and comparison                     ║
║     • Node entanglement                                  ║
║                                                           ║
║     Keyboard Shortcuts:                                  ║
║     • V - Show version timeline                          ║
║     • B - Create branch                                  ║
║     • Ctrl+Z - Undo                                      ║
║     • Ctrl+Y - Redo                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

serve(
  async (req) => {
    const url = new URL(req.url);
    
    // Serve the visualizer demo
    if (url.pathname === "/" || url.pathname === "/visualizer") {
      const html = await Deno.readTextFile("./public/visualizer-demo.html");
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    }
    
    // Serve static files
    return serveDir(req, {
      fsRoot: "./public",
      urlRoot: "/",
      enableCors: true,
    });
  },
  { port: PORT }
);