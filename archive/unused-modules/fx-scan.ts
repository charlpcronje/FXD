// /modules/fx-scan.ts
export type Lang = "js" | "ts" | "jsx" | "tsx" | "py" | "html" | "css" | "text";
export type Block = {
    kind: "function" | "class" | "tag" | "style" | "rule" | "section" | "para";
    name?: string;
    fromLine: number; toLine: number;       // inclusive
    from: number; to: number;               // byte offsets [from, to)
};

export function detectLang(text: string): Lang {
    const t = text.trimStart();
    if (t.startsWith("<!DOCTYPE") || /^<html\b/i.test(t) || /<\/(html|body|div|span)/i.test(text)) return "html";
    if (/<style\b/i.test(text) && /{[^}]+}/.test(text)) return "html";
    if (/^\s*@?(interface|type|enum)\b/m.test(text)) return "ts";
    if (/<[A-Z]\w+/.test(text)) return "jsx";
    if (/^\s*def\s+\w+\s*\(/m.test(text)) return "py";
    if (/^\s*[.#@]?\w+\s*{/.test(text) && !/function|class/.test(text)) return "css";
    return "js";
}

export function splitBlocks(text: string, lang: Lang = detectLang(text)): Block[] {
    const lines = text.split(/\r?\n/);
    const blocks: Block[] = [];

    const push = (kind: Block["kind"], startL: number, endL: number, name?: string) => {
        const from = posOfLine(lines, startL);
        const to = posOfLine(lines, endL) + (lines[endL]?.length ?? 0);
        blocks.push({ kind, name, fromLine: startL, toLine: endL, from, to });
    };

    if (lang === "py") {
        // Python: detect 'def ' / 'class ' by indentation
        const indents: number[] = lines.map(l => l.match(/^\s*/)![0].length);
        let i = 0;
        while (i < lines.length) {
            const L = lines[i];
            if (/^\s*(def|class)\s+\w+/.test(L)) {
                const name = (L.match(/^\s*(def|class)\s+([A-Za-z_]\w*)/) || [, "", ""])[2];
                const baseIndent = indents[i];
                let j = i + 1;
                while (j < lines.length && (lines[j].trim() === "" || indents[j] > baseIndent)) j++;
                push(L.trim().startsWith("def") ? "function" : "class", i, j - 1, name);
                i = j; continue;
            }
            i++;
        }
        // Fill gaps as paragraphs
        fillGapsAsParas(lines.length, blocks, push);
        return blocks;
    }

    if (lang === "html") {
        // HTML: take top-level block tags (header, section, article, table, style) + generic
        const openStack: { tag: string; line: number }[] = [];
        for (let i = 0; i < lines.length; i++) {
            const L = lines[i];
            // naive tag scan (no regex backtracking): find "<", then read name
            for (let p = 0; (p = L.indexOf("<", p)) !== -1;) {
                const isClose = L[p + 1] === "/";
                const start = p + (isClose ? 2 : 1);
                let q = start;
                while (q < L.length && /[A-Za-z0-9:-]/.test(L[q])) q++;
                const tag = L.slice(start, q).toLowerCase();
                if (!tag) { p = start; continue; }
                if (!isClose && L.indexOf("/>", q) !== -1) { p = q; continue; } // self-close
                if (!isClose) openStack.push({ tag, line: i });
                else {
                    // close: find last matching open
                    for (let k = openStack.length - 1; k >= 0; k--) {
                        if (openStack[k].tag === tag) {
                            const open = openStack.splice(k, 1)[0];
                            const kind: Block["kind"] =
                                tag === "style" ? "style" :
                                    (tag === "section" || tag === "article" || tag === "header" || tag === "footer" || tag === "main") ? "section" :
                                        tag === "table" ? "section" : "tag";
                            push(kind, open.line, i, tag);
                            break;
                        }
                    }
                }
                p = q;
            }
        }
        // Fill gaps as paragraphs
        fillGapsAsParas(lines.length, blocks, push);
        return coalesceSmallParas(blocks);
    }

    if (lang === "css") {
        // CSS: rule blocks by braces
        let depth = 0, start = -1;
        for (let i = 0; i < lines.length; i++) {
            const L = stripCssComments(lines[i]);
            for (let c of L) {
                if (c === "{") { if (depth === 0) start = i; depth++; }
                else if (c === "}") { depth--; if (depth === 0 && start >= 0) { push("rule", start, i); start = -1; } }
            }
        }
        fillGapsAsParas(lines.length, blocks, push);
        return blocks;
    }

    // JS/TS/JSX/TSX: function|class + brace tracking
    let i = 0;
    while (i < lines.length) {
        const L = lines[i];
        // function start signals
        const fnName =
            extractAfter(L, "function ") ||
            extractAfter(L, "async function ") ||
            (L.includes("=>") && tryArrowName(lines, i)) ||
            undefined;
        const isClass = /^\s*class\s+[A-Za-z_]\w*/.test(L);
        if (fnName || isClass) {
            const name = fnName || (L.match(/^\s*class\s+([A-Za-z_]\w*)/) || [, ""])[1];
            // brace-balanced block from first '{'
            const startLine = i;
            const end = findBalancedEnd(lines, i);
            push(fnName ? "function" : "class", startLine, end, name || undefined);
            i = end + 1; continue;
        }
        i++;
    }
    fillGapsAsParas(lines.length, blocks, push);
    return coalesceSmallParas(blocks);
}

// ---- helpers (all regex-light / linear) ----
function posOfLine(lines: string[], line: number) {
    let off = 0; for (let i = 0; i < line; i++) off += lines[i].length + 1; return off;
}
function extractAfter(line: string, kw: string) {
    const idx = line.indexOf(kw); if (idx < 0) return undefined;
    let p = idx + kw.length; while (p < line.length && /\s/.test(line[p])) p++;
    let name = ""; while (p < line.length && /[$A-Za-z0-9_]/.test(line[p])) { name += line[p++]; }
    return name || undefined;
}
function tryArrowName(lines: string[], i: number) {
    // looks for "const foo = (...)" as a signal; no heavy parsing
    const m = lines[i].match(/^\s*(const|let|var)\s+([A-Za-z_]\w*)\s*=\s*/);
    return m?.[2];
}
function findBalancedEnd(lines: string[], from: number) {
    // find first '{' from 'from', then scan braces until depth==0
    let depth = 0, started = false, end = from;
    for (let i = from; i < lines.length; i++) {
        const L = stripJsComments(lines[i]);
        for (let ch of L) {
            if (ch === "{") { depth++; started = true; }
            else if (ch === "}") { depth--; if (started && depth === 0) return i; }
        }
        end = i;
    }
    return end;
}
function stripJsComments(s: string) {
    // fast-ish: remove //... and /** */ markers coarsely (no strings handling for Phase-1)
    const noLine = s.split("//")[0];
    return noLine.replace(/\/\*.*?\*\//g, "");
}
function stripCssComments(s: string) { return s.replace(/\/\*.*?\*\//g, ""); }

function fillGapsAsParas(total: number, blocks: Block[], push: (...a: any[]) => void) {
    blocks.sort((a, b) => a.fromLine - b.fromLine);
    let cur = 0;
    for (const b of blocks) {
        if (b.fromLine > cur) {
            const start = cur, end = b.fromLine - 1;
            if (!isBlankRange(start, end, blocks, total)) push("para", start, end);
        }
        cur = b.toLine + 1;
    }
    if (cur < total) {
        if (!isBlankRange(cur, total - 1, blocks, total)) push("para", cur, total - 1);
    }
}
function isBlankRange(start: number, end: number, _blocks: Block[], total: number) {
    if (start > end) return true;
    // caller should pass text if we wanted to check real blanks; Phase-1: assume non-blank
    return false;
}
function coalesceSmallParas(blocks: Block[]) {
    // merge adjacent small paras to reduce noise
    const out: Block[] = [];
    for (const b of blocks.sort((a, b) => a.fromLine - b.fromLine)) {
        const last = out[out.length - 1];
        if (b.kind === "para" && last?.kind === "para" && (b.fromLine - last.toLine) <= 1) {
            last.toLine = b.toLine; last.to = b.to; continue;
        }
        out.push(b);
    }
    return out;
}