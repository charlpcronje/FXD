// server/dev.ts
// Dev bootstrap: load FX core, seed examples, map views to /fs/*, and start HTTP server.

import "../fx.ts"; // ensure $$ and core are loaded
import { seedRepoSnippets } from "../examples/repo-js/seed.ts";
import { startHttpServer } from "./http.ts";

// 1) seed graph
seedRepoSnippets();

// 2) start HTTP server with a simple resolver that maps /fs/src/<name> to views.<name>File
const { fsBridge } = startHttpServer({
  port: 4400,
  autoResolver: (filePath) => {
    // Example rule: "src/repo.js" -> "views.repoFile"
    // Feel free to swap with a table or a smarter resolver.
    const clean = filePath.replace(/^\/+/, "");
    if (clean === "src/repo.js") return { viewId: "views.repoFile", lang: "js" };
    return null;
  }
});

// 3) Explicit registration works too (keeps it clear)
fsBridge.register({
  filePath: "src/repo.js",
  viewId: "views.repoFile",
  lang: "js",
  hoistImports: true
});

console.log("[fxd] Open http://localhost:4400/fs/src/repo.js to see the composed file");
console.log("[fxd] Connect to SSE at  http://localhost:4400/events for live changes");
