// plugins/fx-fs-fuse.ts
// Phase-1 FS bridge (no real FUSE yet). Exposes readFile/writeFile/readdir + view mapping.

import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";

export type ViewEntry = {
    filePath: string;     // e.g. "src/repo.js"
    viewId: string;       // e.g. "views.repoFile"
    lang?: "js" | "ts" | "py" | "php" | "sh" | "ini" | "jsx" | "tsx" | "go" | "cxx" | "text" | string;
    eol?: "lf" | "crlf";
    hoistImports?: boolean;
};

type FSMap = Map<string, ViewEntry>; // filePath -> entry

export interface FxFsApi {
    /** Register or update a view mapping */
    register(entry: ViewEntry): void;
    /** Remove a mapping */
    unregister(filePath: string): void;
    /** Resolve a filePath into a ViewEntry (or null) */
    resolve(filePath: string): ViewEntry | null;

    /** Read a file by path (renders the view) */
    readFile(filePath: string): string;
    /** Write a file by path (parses markers and applies patches) */
    writeFile(filePath: string, text: string): void;
    /** List “files” from the registry; Phase-1 returns registered paths under a pseudo-root */
    readdir(dirPath: string): string[];

    /** Subscribe to change events (SSE/WS can hook here) */
    on(evt: "fileChanged", cb: (p: string) => void): () => void;
}

export default function fxFsFuse(): FxFsApi {
    const views: FSMap = new Map();
    const listeners = new Set<(p: string) => void>();

    function emitChange(p: string) { for (const l of listeners) try { l(p); } catch { } }

    const api: FxFsApi = {
        register(entry) { views.set(normalize(entry.filePath), entry); },
        unregister(filePath) { views.delete(normalize(filePath)); },
        resolve(filePath) { return views.get(normalize(filePath)) ?? null; },

        readFile(filePath) {
            const entry = api.resolve(filePath);
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);
            const { viewId, lang = "js", eol = "lf", hoistImports = false } = entry;
            return renderView(viewId, { lang, eol, hoistImports });
        },

        writeFile(filePath, text) {
            const entry = api.resolve(filePath);
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);
            const patches = toPatches(text);
            applyPatches(patches);
            emitChange(normalize(filePath));
        },

        readdir(dirPath) {
            // Phase-1: present registered files under "/" and their folder parts.
            const dir = stripLeadingSlash(dirPath);
            const parts = new Set<string>();
            for (const p of views.keys()) {
                if (dir === "" || p.startsWith(dir + "/")) {
                    const rest = dir === "" ? p : p.slice(dir.length + 1);
                    const head = rest.split("/")[0];
                    if (head) parts.add(head);
                }
            }
            return Array.from(parts).sort();
        },

        on(evt, cb) {
            if (evt !== "fileChanged") return () => { };
            listeners.add(cb);
            return () => listeners.delete(cb);
        }
    };

    return api;
}

// helpers
function normalize(p: string) { return p.replace(/^\/+/, ""); }
function stripLeadingSlash(p: string) { return p.replace(/^\/+/, ""); }
