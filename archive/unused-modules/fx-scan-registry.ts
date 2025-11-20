// /modules/fx-scan-registry.ts
import { ScanPass, ScanCtx, applyScanOut } from "./fx-scan-core.ts";

type Pipeline = { name: string; passes: ScanPass[] };

const pipelines: Record<string, Pipeline> = Object.create(null);

export function registerPass(lang: string, pass: ScanPass) {
    if (!pipelines[lang]) pipelines[lang] = { name: lang, passes: [] };
    pipelines[lang].passes.push(pass);
}

export function setPipeline(lang: string, passes: ScanPass[]) {
    pipelines[lang] = { name: lang, passes };
}

export function runPipeline(filePath: string, lang: string, text: string) {
    const ctx: ScanCtx = { filePath, lang, text, meta: {} };
    for (const pass of pipelines[lang]?.passes ?? []) {
        const out = pass(ctx);
        if (out) applyScanOut(ctx, out, "scan");
    }
    return ctx;
}
