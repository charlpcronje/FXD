// plugins/fx-observatory.ts
// Phase-1 minimal event hub: graph deltas, file changes, and custom pings.
// No rendering here; just a tiny pub/sub others can subscribe to.

export type ObsEvent =
    | { type: "fileChanged"; path: string }
    | { type: "graphUpdated"; delta?: any }
    | { type: "ping"; at: number }
    | { type: "log"; level: "info" | "warn" | "error"; msg: string; meta?: any };

export interface Observatory {
    emit(e: ObsEvent): void;
    on(cb: (e: ObsEvent) => void): () => void;
    /** Optional: wire to FX core graph updates if you have an emitter */
    wireGraph(source?: { onUpdate?: (cb: (d: any) => void) => void }): void;
}

export default function fxObservatory(): Observatory {
    const subs = new Set<(e: ObsEvent) => void>();

    return {
        emit(e) { for (const s of subs) { try { s(e); } catch { } } },
        on(cb) { subs.add(cb); return () => subs.delete(cb); },
        wireGraph(source) {
            if (source?.onUpdate) {
                source.onUpdate((delta: any) => this.emit({ type: "graphUpdated", delta }));
            }
        }
    };
}
