/**
 * fx-atomics.ts - Entangled Node Syncing for FXD
 *
 * Adapted from fx-atomics.v3.ts to work with fxn.ts
 *
 * Features:
 * - Bi-directional sync between two nodes (A ↔ B)
 * - Lifecycle hooks (beforeSet, set, afterSet) per side
 * - Transform functions (mapAToB, mapBToA)
 * - Re-entrancy guard (no ping-pong)
 * - Microtask coalescing (avoid thrashing)
 * - Pause/Resume/Dispose controls
 */

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode } from '../fxn.ts';

type NodeRef = string | FXNode;
type Source = 'local' | 'propagation';
type Side = 'A' | 'B';

export type HookResult<T> =
  | { action: 'proceed'; value: T }
  | { action: 'skip' }
  | { action: 'redirect'; to: Side; value: any };

export type BeforeSetHook<T> = (args: {
  side: Side;
  incoming: T;
  current: T;
  source: Source;
  meta?: Record<string, unknown>;
}) => HookResult<T> | void;

export type SetHook<T> = (args: {
  side: Side;
  value: T;
  source: Source;
  meta?: Record<string, unknown>;
}) => HookResult<T> | void;

export type AfterSetHook<T> = (args: {
  side: Side;
  value: T;
  source: Source;
  durationMs: number;
  meta?: Record<string, unknown>;
}) => void;

export interface AtomicOptions<A = any, B = any> {
  // Direction
  bidirectional?: boolean;
  oneWayAToB?: boolean;
  oneWayBToA?: boolean;

  // Initial sync
  syncInitialValue?: boolean;

  // Transforms
  mapAToB?: (a: A) => B;
  mapBToA?: (b: B) => A;

  // Equality
  equalsA?: (x: A, y: A) => boolean;
  equalsB?: (x: B, y: B) => boolean;

  // Hooks per side
  hooksA?: {
    beforeSet?: BeforeSetHook<A> | BeforeSetHook<A>[];
    set?: SetHook<A> | SetHook<A>[];
    afterSet?: AfterSetHook<A> | AfterSetHook<A>[];
  };
  hooksB?: {
    beforeSet?: BeforeSetHook<B> | BeforeSetHook<B>[];
    set?: SetHook<B> | SetHook<B>[];
    afterSet?: AfterSetHook<B> | AfterSetHook<B>[];
  };

  // Misc
  swallowHookErrors?: boolean;
  meta?: Record<string, unknown>;
  label?: string;
}

function arrify<T>(x?: T | T[]): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function defaultEq<T>(x: T, y: T) { return Object.is(x, y); }

export interface AtomicLink {
  pause(): void;
  resume(): void;
  dispose(): void;
  isPaused(): boolean;

  onA(h: {
    beforeSet?: BeforeSetHook<any> | BeforeSetHook<any>[];
    set?: SetHook<any> | SetHook<any>[];
    afterSet?: AfterSetHook<any> | AfterSetHook<any>[];
  }): void;

  onB(h: {
    beforeSet?: BeforeSetHook<any> | BeforeSetHook<any>[];
    set?: SetHook<any> | SetHook<any>[];
    afterSet?: AfterSetHook<any> | AfterSetHook<any>[];
  }): void;
}

/**
 * FX Atomics Plugin - Create entanglements between nodes
 */
export class FXAtomicsPlugin {
  public name = "atomics";
  public version = "3.0.0";
  public description = "Entangled nodes with lifecycle hooks and deterministic propagation";

  /** Create an entanglement between two nodes */
  entangle<A = any, B = any>(a: NodeRef, b: NodeRef, opts: AtomicOptions<A, B> = {}): AtomicLink {
    // Store paths for later access
    const pathA = typeof a === "string" ? a : a.__id;
    const pathB = typeof b === "string" ? b : b.__id;

    const nodeA = this._node(a);
    const nodeB = this._node(b);

    if (!nodeA || !nodeB) {
      throw new Error("FXAtomics.entangle: node(s) not found");
    }

    const equalsA = opts.equalsA ?? defaultEq<A>;
    const equalsB = opts.equalsB ?? defaultEq<B>;
    const bidir = opts.bidirectional !== false && !opts.oneWayAToB && !opts.oneWayBToA;
    const swallow = opts.swallowHookErrors ?? true;
    const syncInitial = opts.syncInitialValue !== false;
    const meta = opts.meta ?? {};

    const hooksA = {
      before: arrify(opts.hooksA?.beforeSet),
      set:    arrify(opts.hooksA?.set),
      after:  arrify(opts.hooksA?.afterSet),
    };
    const hooksB = {
      before: arrify(opts.hooksB?.beforeSet),
      set:    arrify(opts.hooksB?.set),
      after:  arrify(opts.hooksB?.afterSet),
    };

    let paused = false;
    let phase: 'idle' | 'pushingAtoB' | 'pushingBtoA' = 'idle';

    // Burst coalescing
    let pendingA: A | undefined;
    let pendingB: B | undefined;
    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (paused) { pendingA = undefined; pendingB = undefined; return; }
        if (pendingA !== undefined && (bidir || !opts.oneWayBToA)) {
          const a = pendingA as A; pendingA = undefined;
          pushAtoB(a, 'propagation');
        }
        if (pendingB !== undefined && (bidir || !opts.oneWayAToB)) {
          const b = pendingB as B; pendingB = undefined;
          pushBtoA(b, 'propagation');
        }
      });
    };

    const runBefore = <T>(side: Side, incoming: T, current: T, source: Source) => {
      const list = side === 'A' ? hooksA.before as BeforeSetHook<T>[] : (hooksB.before as BeforeSetHook<T>[]);
      let val: T = incoming;
      for (const fn of list) {
        try {
          const r = fn({ side, incoming: val, current, source, meta });
          if (!r) continue;
          if (r.action === 'skip') return r;
          if (r.action === 'redirect') return r;
          if (r.action === 'proceed') val = r.value as T;
        } catch (e) {
          if (!swallow) throw e;
        }
      }
      return { action: 'proceed', value: val } as HookResult<T>;
    };

    const runSet = <T>(side: Side, value: T, source: Source) => {
      const list = side === 'A' ? hooksA.set as SetHook<T>[] : (hooksB.set as SetHook<T>[]);
      let val: T = value;
      for (const fn of list) {
        try {
          const r = fn({ side, value: val, source, meta });
          if (!r) continue;
          if (r.action === 'skip') return r;
          if (r.action === 'redirect') return r;
          if (r.action === 'proceed') val = r.value as T;
        } catch (e) {
          if (!swallow) throw e;
        }
      }
      return { action: 'proceed', value: val } as HookResult<T>;
    };

    const runAfter = <T>(side: Side, value: T, source: Source, durationMs: number) => {
      const list = side === 'A' ? hooksA.after as AfterSetHook<T>[] : (hooksB.after as AfterSetHook<T>[]);
      for (const fn of list) {
        try { fn({ side, value, source, durationMs, meta }); } catch (e) { if (!swallow) throw e; }
      }
    };

    const mapAToB = opts.mapAToB ?? ((a: A) => a as unknown as B);
    const mapBToA = opts.mapBToA ?? ((b: B) => b as unknown as A);

    // Get current values using our FX API (use paths not IDs!)
    const getValA = () => $$(pathA).val() as A;
    const getValB = () => $$(pathB).val() as B;
    const setValA = (v: A) => $$(pathA).val(v);
    const setValB = (v: B) => $$(pathB).val(v);

    const pushAtoB = (a: A, source: Source) => {
      if (paused || phase !== 'idle') return;
      const mapped = mapAToB(a);
      const before = runBefore<B>('B', mapped as B, getValB(), source);
      if (!before || before.action === 'skip') return;
      if (before.action === 'redirect') {
        if (before.to === 'A') pushBtoA(before.value as B, 'propagation');
        return;
      }
      const setR = runSet<B>('B', before.value as B, source);
      if (!setR || setR.action === 'skip') return;
      if (setR.action === 'redirect') {
        if (setR.to === 'A') pushBtoA(setR.value as B, 'propagation');
        return;
      }
      const nextB = setR.value as B;
      const curB = getValB();
      if (equalsB(nextB as any, curB as any)) return;
      const t0 = performance.now();
      phase = 'pushingAtoB';
      try { setValB(nextB); }
      finally {
        phase = 'idle';
        const t1 = performance.now();
        runAfter<B>('B', nextB, source, t1 - t0);
      }
    };

    const pushBtoA = (b: B, source: Source) => {
      if (paused || phase !== 'idle') return;
      const mapped = mapBToA(b);
      const before = runBefore<A>('A', mapped as A, getValA(), source);
      if (!before || before.action === 'skip') return;
      if (before.action === 'redirect') {
        if (before.to === 'B') pushAtoB(before.value as A, 'propagation');
        return;
      }
      const setR = runSet<A>('A', before.value as A, source);
      if (!setR || setR.action === 'skip') return;
      if (setR.action === 'redirect') {
        if (setR.to === 'B') pushAtoB(setR.value as A, 'propagation');
        return;
      }
      const nextA = setR.value as A;
      const curA = getValA();
      if (equalsA(nextA as any, curA as any)) return;
      const t0 = performance.now();
      phase = 'pushingBtoA';
      try { setValA(nextA); }
      finally {
        phase = 'idle';
        const t1 = performance.now();
        runAfter<A>('A', nextA, source, t1 - t0);
      }
    };

    // Watch for changes on both nodes (use paths!)
    const unwatchA = $$(pathA).watch((newVal: any, oldVal: any) => {
      // Extract actual value from FX value bag
      const actualNew = $$(pathA).val();
      if (phase === 'pushingBtoA') return; // Don't propagate during sync
      if (bidir || !opts.oneWayBToA) {
        pendingA = actualNew as A;
        schedule();
      }
    });

    const unwatchB = $$(pathB).watch((newVal: any, oldVal: any) => {
      // Extract actual value from FX value bag
      const actualNew = $$(pathB).val();
      if (phase === 'pushingAtoB') return;
      if (bidir || !opts.oneWayAToB) {
        pendingB = actualNew as B;
        schedule();
      }
    });

    // Public controls
    const link: AtomicLink = {
      pause: () => {
        paused = true;
        pendingA = undefined;
        pendingB = undefined;
      },
      resume: () => {
        paused = false;
        if (!syncInitial) return;
        if (bidir || !opts.oneWayBToA) { pendingA = getValA(); }
        if (bidir || !opts.oneWayAToB) { pendingB = getValB(); }
        schedule();
      },
      dispose: () => {
        paused = true;
        pendingA = undefined;
        pendingB = undefined;
        unwatchA();
        unwatchB();
      },
      isPaused: () => paused,
      onA: (h) => {
        if (h.beforeSet) hooksA.before.push(...arrify(h.beforeSet));
        if (h.set)       hooksA.set.push(...arrify(h.set));
        if (h.afterSet)  hooksA.after.push(...arrify(h.afterSet));
      },
      onB: (h) => {
        if (h.beforeSet) hooksB.before.push(...arrify(h.beforeSet));
        if (h.set)       hooksB.set.push(...arrify(h.set));
        if (h.afterSet)  hooksB.after.push(...arrify(h.afterSet));
      }
    };

    // Initial reconciliation
    if (syncInitial) {
      const valA = getValA();
      const valB = getValB();

      if (bidir || !opts.oneWayBToA) {
        pendingA = valA as A;
      }
      if (bidir || !opts.oneWayAToB) {
        pendingB = valB as B;
      }
      schedule();
    }

    return link;
  }

  // Helper to resolve node reference
  private _node(n: NodeRef): FXNode | null {
    if (typeof n === "string") {
      const proxy = $$(n);
      return proxy ? proxy.node() : null;
    }
    return n;
  }
}

// Create and register the plugin
export function loadAtomicsPlugin() {
  // Store plugin in FX graph
  const plugin = new FXAtomicsPlugin();
  $$("plugins.atomics").set(plugin);

  // Also create global accessor
  (globalThis as any).$atomics = {
    entangle: plugin.entangle.bind(plugin)
  };

  console.log('[FX-Atomics] Plugin loaded and ready');
  return plugin;
}

// Export for direct use
export default FXAtomicsPlugin;
