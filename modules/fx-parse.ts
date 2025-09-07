import { normalizeEol, findBySnippetId, simpleHash, indexSnippet, createSnippet } from "./fx-snippets.ts";

export type Patch = { id: string; value: string; checksum?: string; version?: number };

const RE_BEGIN = /^FX:BEGIN\s+(.+)$/;
const RE_END = /^FX:END\s+id=([^\s]+)\s*$/;

// Stricter: only treat as metadata if line starts with a comment token AND has an FX marker
function stripFence(line: string) {
    const trimmed = line.trim();
    if (!/^([#/;]|\/\*|""")/.test(trimmed) || !/FX:(BEGIN|END)\b/.test(trimmed)) return line;
    return trimmed
        .replace(/^((\/\*)|(#)|(;)|(\/\/)|("""))\s?/, "")
        .replace(/\s?(\*\/|""")\s*$/, "")
        .trim();
}

function parseAttrs(s: string) {
    const out: Record<string, string> = {};
    s.trim().split(/\s+/).forEach(kv => {
        const [k, v] = kv.split("=");
        if (k) out[k] = v ?? "";
    });
    return out;
}

export function toPatches(fileText: string): Patch[] {
    const lines = fileText.split(/\r?\n/);
    const patches: Patch[] = [];
    let cur: { id: string; checksum?: string; version?: number } | null = null;
    let buf: string[] = [];

    for (const raw of lines) {
        const stripped = stripFence(raw);

        if (!cur) {
            const m = stripped.match(RE_BEGIN);
            if (m) {
                const attrs = parseAttrs(m[1]);
                cur = { id: attrs.id, checksum: attrs.checksum, version: attrs.version ? Number(attrs.version) : 1 };
                buf = [];
            }
            continue;
        }

        const end = stripped.match(RE_END);
        if (end && end[1] === cur.id) {
            const body = buf.join("\n"); // preserve original whitespace
            patches.push({ id: cur.id, value: body, checksum: cur.checksum, version: cur.version });
            cur = null; buf = [];
        } else {
            buf.push(raw); // keep raw for faithful round-trip
        }
    }
    return patches;
}

export function applyPatches(
    patches: Patch[],
    opts: { onMissing?: "create" | "skip", orphanRoot?: string } = {}
) {
    const { onMissing = "create", orphanRoot = "snippets.orphans" } = opts;

    for (const p of patches) {
        const known = findBySnippetId(p.id);
        if (known) {
            const current = String($$(known.path).get() ?? "");
            const curHash = simpleHash(normalizeEol(current)); // hash normalized current
            if (p.checksum && p.checksum !== curHash) {
                // divergence detected — surface/log if you want (Phase-1 still applies)
            }
            $$(known.path).set(p.value);
        } else if (onMissing === "create") {
            const safe = p.id.replace(/[^\w.-]/g, "_");
            const path = `${orphanRoot}.${safe}`;
            createSnippet(path, p.value, { id: p.id, version: p.version });
            indexSnippet(path, p.id);
        }
    }
}
