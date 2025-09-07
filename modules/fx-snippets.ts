// Phase-1 utilities: stable snippet creation, comment styles, wrappers, checksum, ID index.

type Lang = "js" | "ts" | "jsx" | "tsx" | "py" | "sh" | "ini" | "php" | "go" | "cxx" | "text" | string;

export type Marker = {
    id: string;
    lang?: string;
    file?: string;
    checksum?: string;
    order?: number;
    version?: number; // default 1
};

export const COMMENT: Record<string, { open?: string; close?: string; line?: string }> = {
    js: { open: "/*", close: "*/", line: "//" }, ts: { open: "/*", close: "*/", line: "//" },
    jsx: { open: "/*", close: "*/", line: "//" }, tsx: { open: "/*", close: "*/", line: "//" },
    py: { line: "#" }, sh: { line: "#" }, ini: { line: ";" }, php: { open: "/*", close: "*/", line: "//" },
    go: { open: "/*", close: "*/", line: "//" }, cxx: { open: "/*", close: "*/", line: "//" },
    text: { line: "//" }
};

// ——— ID index (id -> path) ———
const snippetIdx = new Map<string, string>();

export function indexSnippet(path: string, id?: string) {
    const usedId = id ?? $$(path).options()?.id;
    if (usedId) snippetIdx.set(usedId, path);
}
export function removeSnippetIndex(path: string) {
    const id = $$(path).options()?.id;
    if (id) snippetIdx.delete(id);
}
export function findBySnippetId(id: string) {
    const path = snippetIdx.get(id);
    return path ? { id, path } : null;
}

// Lifecycle hooks (call these from your FX core when options/path change)
export function onSnippetOptionsChanged(path: string, oldId?: string, newId?: string) {
    if (oldId && oldId !== newId) snippetIdx.delete(oldId);
    if (newId) snippetIdx.set(newId, path);
}
export function onSnippetMoved(oldPath: string, newPath: string) {
    const id = $$(newPath).options()?.id ?? $$(oldPath).options()?.id;
    if (!id) return;
    snippetIdx.set(id, newPath);
}

// ——— helpers ———
export function normalizeEol(s: string) { return s.replace(/\r\n/g, "\n"); }
export function chooseEol(eol: "lf" | "crlf" = "lf") { return eol === "crlf" ? "\r\n" : "\n"; }
export function simpleHash(s: string) { // fast, non-crypto
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}

export function makeBegin(m: Marker) {
    const parts = [`id=${m.id}`];
    if (m.lang) parts.push(`lang=${m.lang}`);
    if (m.file) parts.push(`file=${m.file}`);
    if (m.checksum) parts.push(`checksum=${m.checksum}`);
    if (m.order !== undefined) parts.push(`order=${m.order}`);
    parts.push(`version=${m.version ?? 1}`);
    return `FX:BEGIN ${parts.join(" ")}`;
}
export function makeEnd(m: Marker) { return `FX:END id=${m.id}`; }

/** Emit BEGIN/BODY/END using block comments if available else single-line prefix. */
export function wrapSnippet(id: string, body: string, lang: Lang = "js", meta: Partial<Marker> = {}) {
    const c = COMMENT[lang] ?? COMMENT.js;
    const checksum = meta.checksum ?? simpleHash(normalizeEol(body));
    const begin = makeBegin({ id, lang, file: meta.file, checksum, order: meta.order, version: meta.version ?? 1 });
    const end = makeEnd({ id });

    if (c.open && c.close) {
        return `${c.open} ${begin} ${c.close}\n${body}\n${c.open} ${end} ${c.close}`;
    } else {
        const lp = c.line ?? "//";
        return `${lp} ${begin}\n${body}\n${lp} ${end}`;
    }
}

/** Stable snippet factory (sets id/lang/file/version and indexes it). */
export function createSnippet(
    path: string,
    body: string,
    opts: { lang?: Lang; file?: string; id?: string; order?: number; version?: number } = {}
) {
    const id = opts.id ?? path;
    $$(path)
        .val(body)
        .setType("snippet")
        .options({ lang: opts.lang ?? "js", file: opts.file ?? "", id, order: opts.order, version: opts.version ?? 1 });
    indexSnippet(path, id);
    return $$(path);
}
