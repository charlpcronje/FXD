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

// Batch patch application with transaction semantics
export interface BatchPatchResult {
    succeeded: Patch[];
    failed: Array<{ patch: Patch; error: string }>;
    rollbackAvailable: boolean;
}

export function applyPatchesBatch(
    patches: Patch[],
    opts: { 
        onMissing?: "create" | "skip", 
        orphanRoot?: string,
        transaction?: boolean,  // If true, all succeed or all fail
        validateFirst?: boolean // If true, validate all before applying any
    } = {}
): BatchPatchResult {
    const { 
        onMissing = "create", 
        orphanRoot = "snippets.orphans",
        transaction = false,
        validateFirst = true
    } = opts;
    
    const backups = new Map<string, any>();
    const succeeded: Patch[] = [];
    const failed: Array<{ patch: Patch; error: string }> = [];
    
    // Validation phase
    if (validateFirst) {
        for (const patch of patches) {
            const known = findBySnippetId(patch.id);
            if (!known && onMissing === "skip") {
                failed.push({ 
                    patch, 
                    error: `Snippet ${patch.id} not found and onMissing is 'skip'` 
                });
            }
        }
        
        if (transaction && failed.length > 0) {
            return { succeeded: [], failed, rollbackAvailable: false };
        }
    }
    
    // Application phase
    for (const patch of patches) {
        try {
            const known = findBySnippetId(patch.id);
            
            if (known) {
                // Backup current value for rollback
                const currentValue = $$(known.path).val();
                backups.set(known.path, currentValue);
                
                // Check for checksum mismatch
                const current = String(currentValue ?? "");
                const curHash = simpleHash(normalizeEol(current));
                if (patch.checksum && patch.checksum !== curHash) {
                    if (transaction) {
                        throw new Error(`Checksum mismatch for ${patch.id}: expected ${patch.checksum}, got ${curHash}`);
                    }
                    // In non-transaction mode, we still apply but could log warning
                }
                
                // Apply patch
                $$(known.path).set(patch.value);
                succeeded.push(patch);
                
            } else if (onMissing === "create") {
                const safe = patch.id.replace(/[^\w.-]/g, "_");
                const path = `${orphanRoot}.${safe}`;
                
                // Store null as backup to indicate it was created
                backups.set(path, null);
                
                createSnippet(path, patch.value, { id: patch.id, version: patch.version });
                indexSnippet(path, patch.id);
                succeeded.push(patch);
                
            } else {
                throw new Error(`Snippet ${patch.id} not found`);
            }
            
        } catch (error) {
            failed.push({ 
                patch, 
                error: error instanceof Error ? error.message : String(error) 
            });
            
            if (transaction) {
                // Rollback all changes
                for (const [path, value] of backups) {
                    if (value === null) {
                        // Was created, remove it
                        // Note: We'd need a delete function in FX
                        $$(path).set(undefined);
                    } else {
                        // Restore original value
                        $$(path).set(value);
                    }
                }
                
                return { 
                    succeeded: [], 
                    failed: [...failed, ...succeeded.map(p => ({ 
                        patch: p, 
                        error: "Rolled back due to transaction failure" 
                    }))],
                    rollbackAvailable: true
                };
            }
        }
    }
    
    return { succeeded, failed, rollbackAvailable: backups.size > 0 };
}

// Conflict detection for concurrent edits
export interface ConflictDetectionResult {
    hasConflicts: boolean;
    conflicts: Array<{
        id: string;
        localChecksum: string;
        remoteChecksum: string;
        currentChecksum: string;
    }>;
}

export function detectConflicts(patches: Patch[]): ConflictDetectionResult {
    const conflicts: ConflictDetectionResult['conflicts'] = [];
    
    for (const patch of patches) {
        if (!patch.checksum) continue;
        
        const known = findBySnippetId(patch.id);
        if (!known) continue;
        
        const current = String($$(known.path).val() ?? "");
        const currentChecksum = simpleHash(normalizeEol(current));
        
        // If checksum doesn't match, there's been a concurrent edit
        if (patch.checksum !== currentChecksum) {
            conflicts.push({
                id: patch.id,
                localChecksum: currentChecksum,
                remoteChecksum: patch.checksum,
                currentChecksum: simpleHash(normalizeEol(patch.value))
            });
        }
    }
    
    return {
        hasConflicts: conflicts.length > 0,
        conflicts
    };
}
