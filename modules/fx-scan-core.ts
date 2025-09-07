// /modules/fx-scan-core.ts
export type ScanCtx = {
    filePath: string;
    lang: string;
    text: string;
    // shared scratchpad across passes in the same run
    meta: Record<string, any>;
};

export type ScanOut = {
    // snippet tuples: { id, from, to, kind, name?, options? }
    snippets?: Array<{ id: string; from: number; to: number; kind: string; name?: string; options?: any }>;
    // optional groups to construct/augment
    groups?: Array<{ path: string; members: string[]; options?: any }>;
    // any annotations for visualizer
    marks?: Array<{ from: number; to: number; tag: string; data?: any }>;
};

export type ScanPass = (ctx: ScanCtx) => ScanOut | void;

// Helpers to materialize results into FX nodes
export function applyScanOut(ctx: ScanCtx, out: ScanOut, basePath = "scan") {
    const base = `${basePath}.${ctx.lang}`;
    out.snippets?.forEach(s => {
        const snipPath = `snippets.${s.id}`;
        const body = ctx.text.slice(s.from, s.to);
        $$(snipPath)
            .val(body)
            .setType("snippet")
            .options({ lang: ctx.lang, file: ctx.filePath, kind: s.kind, name: s.name, ...s.options });
    });
    out.groups?.forEach(g => {
        $$(g.path).group(g.members).options({ reactive: true, mode: "set", ...(g.options || {}) });
    });
    if (out.marks?.length) {
        $$(base + `.marks.${hash(ctx.filePath)}`).val(out.marks);
    }
}

const enc = new TextEncoder();
export function hash(s: string) {
    // light, stable-ish: djb2
    let h = 5381;
    for (const b of enc.encode(s)) h = ((h << 5) + h) ^ b;
    return (h >>> 0).toString(16);
}