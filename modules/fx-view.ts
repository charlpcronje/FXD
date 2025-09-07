import { wrapSnippet, chooseEol } from "./fx-snippets.ts";

type RenderOpts = {
    lang?: string;
    sep?: string;
    eol?: "lf" | "crlf";
    hoistImports?: boolean; // JS/TS guardrailed hoist
};

export function renderView(viewPath: string, opts: RenderOpts = {}) {
    const { lang = "js", sep = "\n\n", eol = "lf", hoistImports = false } = opts;
    const g = $$(viewPath).group();

    // Expect g.list(): { path, node, id?, lang?, file?, order? }[]
    const items = g.list().map((it: any, idx: number) => {
        const id = it.id ?? it.path;
        const l = it.lang ?? $$(it.path).options()?.lang ?? lang;
        const f = it.file ?? $$(it.path).options()?.file;
        const ord = it.order ?? $$(it.path).options()?.order ?? idx;
        const body = it.node?.get?.() ?? $$(it.path).get();
        return { id, l, f, ord, body: body ?? "" };
    });

    items.sort((a, b) => (a.ord - b.ord));

    const text = items
        .map(s => wrapSnippet(s.id, String(s.body), s.l, { file: s.f, order: s.ord }))
        .join(sep);

    const final = hoistImports ? hoistImportsOnce(text) : text;

    const endl = chooseEol(eol);
    return final.replace(/\r?\n/g, endl);
}

// Guardrailed single-line import hoist for JS/TS
const RE_IMPORT = /^\s*import\s+.+?\s+from\s+['"][^'"]+['"]\s*;?\s*$/;
const RE_IMPORT_SIDE = /^\s*import\s+['"][^'"]+['"]\s*;?\s*$/;
const IS_MARKER = /FX:(BEGIN|END)\b/;

export function hoistImportsOnce(s: string) {
    const lines = s.split(/\r?\n/);
    const imports: string[] = [];
    const rest: string[] = [];
    for (const l of lines) {
        if (IS_MARKER.test(l)) { rest.push(l); continue; }
        if (RE_IMPORT.test(l) || RE_IMPORT_SIDE.test(l)) imports.push(l);
        else rest.push(l);
    }
    const uniq = Array.from(new Set(imports));
    return uniq.length ? `${uniq.join("\n")}\n\n${rest.join("\n")}` : rest.join("\n");
}
