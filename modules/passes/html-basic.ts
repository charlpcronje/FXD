// /modules/passes/html-basic.ts
import { registerPass } from "../fx-scan-registry.ts";
import type { ScanPass } from "../fx-scan-core.ts";

const htmlSplit: ScanPass = (ctx) => {
    const lines = ctx.text.split(/\r?\n/);
    const snippets: Array<{ id: string; from: number; to: number; kind: string; name: string }> = [];
    const stack: { tag: string; line: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        for (let p = 0; (p = L.indexOf("<", p)) !== -1;) {
            const close = L[p + 1] === "/"; let q = p + (close ? 2 : 1);
            while (q < L.length && /[A-Za-z0-9:-]/.test(L[q])) q++;
            const tag = L.slice(p + (close ? 2 : 1), q).toLowerCase();
            if (!tag) { p = q; continue; }
            if (!close && L.indexOf("/>", q) !== -1) { p = q; continue; }
            if (!close) stack.push({ tag, line: i });
            else {
                for (let k = stack.length - 1; k >= 0; k--) {
                    if (stack[k].tag === tag) {
                        const open = stack.splice(k, 1)[0];
                        const from = pos(lines, open.line);
                        const to = pos(lines, i) + lines[i].length;
                        const kind = tag === "style" ? "style" : (["section", "article", "header", "footer", "main", "table"].includes(tag) ? "section" : "tag");
                        snippets.push({ id: `${ctx.filePath}::${open.line}-${i}`, from, to, kind, name: tag });
                        break;
                    }
                }
            }
            p = q;
        }
    }
    return { snippets };
};
registerPass("html", htmlSplit);

function pos(lines: string[], line: number) { let o = 0; for (let i = 0; i < line; i++) o += lines[i].length + 1; return o; }
