// /modules/passes/css-basic.ts
import { registerPass } from "../fx-scan-registry.ts";
import type { ScanPass } from "../fx-scan-core.ts";

const cssSplit: ScanPass = (ctx) => {
    const lines = ctx.text.split(/\r?\n/);
    const snippets: Array<{ id: string; from: number; to: number; kind: string }> = [];
    let depth = 0, start = -1;
    for (let i = 0; i < lines.length; i++) {
        const L = lines[i].replace(/\/\*.*?\*\//g, "");
        for (const ch of L) {
            if (ch === "{") { if (depth === 0) start = i; depth++; }
            else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { snippets.push({ id: `${ctx.filePath}::${start}-${i}`, from: pos(lines, start), to: pos(lines, i) + lines[i].length, kind: "rule" }); start = -1; } }
        }
    }
    return { snippets };
};
registerPass("css", cssSplit);

function pos(lines: string[], line: number) { let o = 0; for (let i = 0; i < line; i++) o += lines[i].length + 1; return o; }
