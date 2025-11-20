// /modules/fx-scan-ingest.ts
import { runPipeline } from "./fx-scan-registry.ts";

// 1) drop a file into FX
export function ingestFile(path: string, text: string, lang?: string) {
    const id = path.replace(/[\/\\]/g, ".");              // e.g. src.repo.js -> "src.repo.js"
    const node = $$(`files.${id}`).val({ path, text }).setType("file").options({ lang });
    // reactive binding: re-run when text changes
    $$(`files.${id}`).watch((nv) => {
        const l = nv?.lang || node.options?.().lang || detect(text);
        runPipeline(path, l, nv?.text ?? "");
    });
    // initial run
    const l = lang ?? detect(text);
    runPipeline(path, l, text);
    return $$(`files.${id}`);
}

function detect(text: string): string {
    const t = text.trimStart();
    if (t.startsWith("<")) return "html";
    if (t.includes("{") && t.includes("}")) return "js";
    return "text";
}
