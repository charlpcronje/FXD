// server/http.ts
// Phase-1 HTTP + SSE server for FXD.
// Routes:
//   GET  /fs/<path>           -> render view as file
//   PUT  /fs/<path>           -> write file (parse markers, apply patches)
//   GET  /fs/ls/<dir?>        -> list pseudo-dir
//   GET  /events              -> Server-Sent Events stream (fileChanged, graphUpdated, ping)

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import fxFsFuse, { FxFsApi } from "../plugins/fx-fs-fuse.ts";
import fxObservatory from "../plugins/fx-observatory.ts";

export interface HttpServerOpts {
    port?: number;
    /** Allow mapping path -> viewId without pre-registering each file */
    autoResolver?: (filePath: string) => { viewId: string, lang?: string } | null;
}

export function startHttpServer(opts: HttpServerOpts = {}) {
    const port = opts.port ?? 4400;
    const fsBridge: FxFsApi = fxFsFuse();
    const obs = fxObservatory();

    // pipe fs changes to SSE
    fsBridge.on("fileChanged", (p) => obs.emit({ type: "fileChanged", path: `/${p}` }));

    // SSE clients
    const clients = new Set<ServerResponse>();

    const server = createServer(async (req, res) => {
        const url = parse(req.url ?? "", true);
        const m = req.method ?? "GET";
        const path = decodeURIComponent(url.pathname ?? "/");

        // CORS/dev-friendly
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (m === "OPTIONS") { res.writeHead(204).end(); return; }

        // SSE
        if (m === "GET" && path === "/events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            });
            res.write(`event: ping\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
            clients.add(res);
            const unsub = obs.on((e) => {
                res.write(`data: ${JSON.stringify(e)}\n\n`);
            });
            req.on("close", () => { unsub(); clients.delete(res); });
            return;
        }

        // list
        if (m === "GET" && path.startsWith("/fs/ls")) {
            const dir = (path.replace(/^\/fs\/ls/, "") || "/").replace(/^\/+/, "");
            const list = fsBridge.readdir(dir);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ dir: "/" + dir, entries: list }));
            return;
        }

        // read
        if (m === "GET" && path.startsWith("/fs/")) {
            const filePath = path.replace(/^\/fs\//, "");
            ensureRegistered(fsBridge, opts.autoResolver, filePath);
            try {
                const text = fsBridge.readFile(filePath);
                res.writeHead(200, inferContentType(filePath));
                res.end(text);
            } catch (e: any) {
                res.writeHead(404).end(String(e?.message ?? "not found"));
            }
            return;
        }

        // write
        if (m === "PUT" && path.startsWith("/fs/")) {
            const filePath = path.replace(/^\/fs\//, "");
            ensureRegistered(fsBridge, opts.autoResolver, filePath);
            const body = await readBody(req);
            try {
                fsBridge.writeFile(filePath, body);
                res.writeHead(200).end("ok");
                obs.emit({ type: "fileChanged", path: "/" + filePath });
            } catch (e: any) {
                res.writeHead(400).end(String(e?.message ?? "bad request"));
            }
            return;
        }

        res.writeHead(404).end("not found");
    });

    // periodic pings
    const t = setInterval(() => {
        const evt = { type: "ping", at: Date.now() } as const;
        for (const c of clients) try { c.write(`data: ${JSON.stringify(evt)}\n\n`); } catch { }
    }, 15000);

    server.listen(port);
    console.log(`[fxd] HTTP listening on http://localhost:${port}`);

    return { server, fsBridge, obs, stop: () => { clearInterval(t); server.close(); } };
}

// --- helpers ---
function inferContentType(p: string) {
    if (p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".ts")) return { "Content-Type": "text/javascript; charset=utf-8" };
    if (p.endsWith(".json")) return { "Content-Type": "application/json; charset=utf-8" };
    if (p.endsWith(".css")) return { "Content-Type": "text/css; charset=utf-8" };
    if (p.endsWith(".html")) return { "Content-Type": "text/html; charset=utf-8" };
    return { "Content-Type": "text/plain; charset=utf-8" };
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const bufs: Buffer[] = [];
        req.on("data", (c) => bufs.push(Buffer.from(c)));
        req.on("end", () => resolve(Buffer.concat(bufs).toString("utf8")));
        req.on("error", reject);
    });
}

function ensureRegistered(fsBridge: FxFsApi, auto?: HttpServerOpts["autoResolver"], filePath?: string) {
    if (!filePath) return;
    if (fsBridge.resolve(filePath)) return;
    if (!auto) return;
    const meta = auto(filePath);
    if (meta) fsBridge.register({ filePath, viewId: meta.viewId, lang: meta.lang });
}
