// /modules/passes/build-view.ts
import { registerPass } from "../fx-scan-registry.ts";
import type { ScanPass } from "../fx-scan-core.ts";

const makeFileView: ScanPass = (ctx) => {
  // collect snippets created so far (previous passes); simple heuristic:
  const prefix = `snippets.${ctx.filePath}::`;
  const members = Object.keys($$("snippets").nodes?.() ?? {})
    .filter(k => k.startsWith(ctx.filePath + "::"))
    .map(k => `snippets.${k}`);

  return members.length ? {
    groups: [{ path: `views.file.${ctx.filePath.replace(/[\/\\]/g,"_")}`, members, options: { reactive: true, mode: "set" } }]
  } : undefined;
};

registerPass("js", makeFileView);
registerPass("ts", makeFileView);
registerPass("html", makeFileView);
registerPass("css", makeFileView);
