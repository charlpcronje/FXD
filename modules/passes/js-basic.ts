// /modules/passes/js-basic.ts
import { registerPass } from "../fx-scan-registry.ts";
import type { ScanPass } from "../fx-scan-core.ts";

const jsSplit: ScanPass = (ctx) => {
    const lines = ctx.text.split(/\r?\n/);
    const snippets: Array<{ id: string; from: number; to: number; kind: string; name: string }> = [];
    let i = 0;
    while (i < lines.length) {
        const L = lines[i];
        const isClass = /^\s*class\s+[A-Za-z_]\w*/.test(L);
        const fnName = extractAfter(L, "function ") || extractAfter(L, "async function ") || tryArrowName(L);
        if (fnName || isClass) {
            const name = fnName || (L.match(/^\s*class\s+([A-Za-z_]\w*)/) || [, ""])[1];
            const start = i;
            const end = findBalancedEnd(lines, i);
            const from = pos(lines, start), to = pos(lines, end) + lines[end].length;
            snippets.push({ id: `${ctx.filePath}::${start}-${end}`, from, to, kind: fnName ? "function" : "class", name });
            i = end + 1; continue;
        }
        i++;
    }
    return { snippets };
};

registerPass("js", jsSplit);
registerPass("ts", jsSplit);
registerPass("jsx", jsSplit);
registerPass("tsx", jsSplit);

// helpers
function pos(lines: string[], line: number) { let o = 0; for (let i = 0; i < line; i++) o += lines[i].length + 1; return o; }
function extractAfter(line: string, kw: string) { const i = line.indexOf(kw); if (i < 0) return; let p = i + kw.length; while (/\s/.test(line[p])) p++; let n = ""; while (/[$\w]/.test(line[p])) n += line[p++]; return n || undefined; }
function tryArrowName(line: string) { const m = line.match(/^\s*(const|let|var)\s+([A-Za-z_]\w*)\s*=\s*/); return m?.[2]; }
function findBalancedEnd(lines: string[], from: number) {
    let depth = 0, started = false;
    for (let i = from; i < lines.length; i++) {
        const L = lines[i].split("//")[0].replace(/\/\*.*?\*\//g, "");
        for (const ch of L) {
            if (ch === "{") { depth++; started = true; }
            else if (ch === "}") { depth--; if (started && depth === 0) return i; }
        }
    }
    return lines.length - 1;
}