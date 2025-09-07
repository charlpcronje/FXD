// deno run -A server/fxdisk-dev.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { join, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const ROOT = Deno.cwd();
const mounts: Record<string, string> = {
  "/public": join(ROOT, "public"),
  "/fx": join(ROOT, "fx"),
  "/modules": join(ROOT, "modules"),
};

function resolveMount(urlPath: string): { filePath: string | null; ctype?: string } {
  // exact mount
  for (const prefix of Object.keys(mounts)) {
    if (urlPath === prefix) {
      const p = join(mounts[prefix], "index.html");
      return { filePath: p, ctype: "text/html; charset=utf-8" };
    }
    if (urlPath.startsWith(prefix + "/")) {
      const rel = urlPath.slice(prefix.length + 1);
      const fp = join(mounts[prefix], rel);
      return { filePath: fp };
    }
  }
  // special file served from project root
  if (urlPath === "/fx.ts") {
    const p = join(ROOT, "fx.ts");
    return { filePath: p, ctype: contentType(p) ?? "application/typescript" };
  }
  // root → /public/index.html
  if (urlPath === "/" || urlPath === "") {
    const p = join(mounts["/public"], "index.html");
    return { filePath: p, ctype: "text/html; charset=utf-8" };
  }
  // /public fallback
  if (!urlPath.startsWith("/api/")) {
    const p = join(mounts["/public"], urlPath.replace(/^\/+/, ""));
    return { filePath: p };
  }
  return { filePath: null };
}

async function readFileSafe(path: string) {
  try {
    const data = await Deno.readFile(path);
    return data;
  } catch {
    return null;
  }
}

async function handleStatic(req: Request, url: URL) {
  const { filePath, ctype } = resolveMount(url.pathname);
  if (!filePath) return null;
  const path = normalize(filePath);
  const data = await readFileSafe(path);
  if (!data) {
    // if a directory was requested without trailing slash, try index.html inside it
    try {
      const stat = await Deno.stat(path);
      if (stat.isDirectory) {
        const idx = join(path, "index.html");
        const data2 = await readFileSafe(idx);
        if (data2) {
          return new Response(data2, { headers: { "content-type": "text/html; charset=utf-8" } });
        }
      }
    } catch {}
    return new Response("Not found", { status: 404 });
  }
  const ct = ctype ?? contentType(path) ?? "application/octet-stream";
  return new Response(data, { headers: { "content-type": ct } });
}

// ------------ FX runtime glue (import your modules) ------------
const fxMod = await import(`file://${join(ROOT, "fx.ts")}`);
const { $$ } = fxMod;

// load helpers (render / ingest)
const { renderView } = await import(`file://${join(ROOT, "modules", "fx-view.ts")}`);
const { ingestFile } = await import(`file://${join(ROOT, "modules", "fx-scan-ingest.ts")}`);

// preload scan passes (so /api/ingest works)
await import(`file://${join(ROOT, "modules", "fx-scan-registry.ts")}`);
await import(`file://${join(ROOT, "modules", "passes", "js-basic.ts")}`);
await import(`file://${join(ROOT, "modules", "passes", "html-basic.ts")}`);
await import(`file://${join(ROOT, "modules", "passes", "css-basic.ts")}`);
await import(`file://${join(ROOT, "modules", "passes", "build-view.ts")}`);

// ensure output dir
await Deno.mkdir(join(ROOT, "views.out"), { recursive: true });

async function apiIngest(url: URL) {
  const root = url.searchParams.get("root") ?? ".";
  const abs = join(ROOT, root);
  try {
    for await (const e of walk(abs, { includeDirs: false })) {
      const rel = e.path.slice(abs.length + 1);
      const text = await Deno.readTextFile(e.path);
      ingestFile(rel, text); // triggers pipeline
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Ingest error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

async function apiMaterialize(url: URL) {
  const view = url.searchParams.get("view");
  if (!view) {
    return new Response(JSON.stringify({ ok: false, error: "missing ?view=" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    // get ext from view options (fallback .txt)
    const opts = $$(view).options?.() || {};
    const ext = typeof opts.ext === "string" && opts.ext.length ? opts.ext : ".txt";
    const base = view.replace(/[^\w.-]+/g, "_");
    const filePath = join(ROOT, "views.out", `${base}${ext}`);
    const text = await renderView(view, {
      lang: opts.lang ?? "text",
      eol: opts.eol ?? "lf",
      hoistImports: !!opts.hoistImports,
    });
    await Deno.writeTextFile(filePath, text);
    const bytes = new TextEncoder().encode(text).length;
    return new Response(JSON.stringify({ ok: true, filePath, bytes }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Materialize error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);

    // APIs
    if (url.pathname === "/api/ingest") return await apiIngest(url);
    if (url.pathname === "/api/materialize") return await apiMaterialize(url);

    // Static
    const staticResp = await handleStatic(req, url);
    if (staticResp) return staticResp;

    // Fallback → index.html
    const fallback = await handleStatic(req, new URL(new URL(req.url).origin + "/public/index.html"));
    if (fallback) return fallback;

    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error("Server error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}, { port: 5173 });

console.log("FXDisk dev server on http://localhost:5173");
console.log("Mounts: /public → public/, /fx → fx/, /modules → modules/");
