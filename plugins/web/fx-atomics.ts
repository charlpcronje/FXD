/**
 * fx-atomics.ts — TypeScript port + enhancements
 * - Entanglement (1:1, 1:N, N:M)
 * - Before/after hooks with type safety
 * - Mapping functions + guards
 * - Reentrancy protection
 */
import type { FX, FXNode, FXPlugin } from "./fx-types";

type NodeRef = string | FXNode;
type HookPhase = "beforeSet" | "afterSet";
type HookFn<T = any> = (node: FXNode, nextValue: T, prevValue?: T) => T | void | false;

interface EntangleOptions<T = any> {
  bidirectional?: boolean;
  syncInitialValue?: boolean;
  mapAtoB?: (a: T) => T;
  mapBtoA?: (b: T) => T;
  guard?: (node: FXNode, value: T) => boolean;
  label?: string;
}

export class FXAtomicsPlugin implements FXPlugin {
  public name = "atomics";
  public version = "1.1.0";
  public description = "Entangled nodes with atomic updates, hooks and guards";

  private fx: FX;
  private entanglements = new Map<string, Set<string>>();
  private hooks = new Map<string, { beforeSet: HookFn[]; afterSet: HookFn[] }>();
  private setTraps = new Map<string, HookFn>();
  private _originalSet: FX["set"];
  private _active = new Set<string>(); // reentrancy protection

  constructor(fx: FX, options: Partial<EntangleOptions> = {}) {
    this.fx = fx;
    this._originalSet = fx.set.bind(fx);
    // Intercept fx.set to keep API sync
    fx.set = this._interceptedSet.bind(this);
  }

  install = (fx: FX) => void 0;

  private _id(n: NodeRef): string | null {
    const node = typeof n === "string" ? this.fx.resolvePath(n, this.fx.root) : n;
    return node?.__id ?? null;
  }
  private _node(n: NodeRef): FXNode | null {
    return typeof n === "string" ? this.fx.resolvePath(n, this.fx.root) : n;
  }

  /** Core intercepted set — sync by design */
  private _interceptedSet(node: FXNode, value: any) {
    const id = node.__id;
    const key = `${id}|${JSON.stringify(value)}`;
    if (this._active.has(key)) {
      // prevent loops
      return;
    }
    this._active.add(key);
    const prev = this.fx.val(node);

    // beforeSet hooks
    const h = this.hooks.get(id);
    if (h?.beforeSet?.length) {
      for (const hook of h.beforeSet) {
        const res = hook(node, value, prev);
        if (res === false) { this._active.delete(key); return; }
        if (res !== undefined) value = res;
      }
    }

    // custom trap (may veto or transform)
    const trap = this.setTraps.get(id);
    if (trap) {
      const res = trap(node, value, prev);
      if (res === false) { this._active.delete(key); return; }
      if (res !== undefined) value = res;
    }

    // set
    this._originalSet(node, value);

    // propagate to entangled nodes (if any)
    const peers = this.entanglements.get(id);
    if (peers?.size) {
      for (const peerId of peers) {
        const peer = this._findById(peerId);
        if (!peer) continue;
        // Remove reverse edge to avoid ping-pong during this update
        const rev = this.entanglements.get(peerId);
        rev?.delete(id);
        try {
          this._originalSet(peer, value);
        } finally {
          rev?.add(id);
        }
      }
    }

    // afterSet hooks
    if (h?.afterSet?.length) {
      for (const hook of h.afterSet) {
        hook(node, value, prev);
      }
    }

    this._active.delete(key);
  }

  /** Link two nodes with optional mapping + guards */
  entangle<A = any, B = any>(a: NodeRef, b: NodeRef, opts: EntangleOptions = {}) {
    const A = this._node(a), B = this._node(b);
    if (!A || !B) throw new Error("Atomics.entangle: node(s) not found");

    const ida = A.__id, idb = B.__id;
    if (!this.entanglements.has(ida)) this.entanglements.set(ida, new Set());
    this.entanglements.get(ida)!.add(idb);
    if (opts.bidirectional !== false) {
      if (!this.entanglements.has(idb)) this.entanglements.set(idb, new Set());
      this.entanglements.get(idb)!.add(ida);
    }

    // mapping via hooks
    if (opts.mapAtoB) {
      this.addHook(B, "beforeSet", (node, next) => opts.mapAtoB!(next as any));
    }
    if (opts.mapBtoA) {
      this.addHook(A, "beforeSet", (node, next) => opts.mapBtoA!(next as any));
    }
    if (opts.guard) {
      this.addHook(A, "beforeSet", (n, v) => (opts.guard!(n, v as any) ? undefined : false));
      this.addHook(B, "beforeSet", (n, v) => (opts.guard!(n, v as any) ? undefined : false));
    }

    // sync initial value (deterministic: prefer defined)
    if (opts.syncInitialValue !== false) {
      const va = this.fx.val(A), vb = this.fx.val(B);
      if (va !== undefined && vb === undefined) this._originalSet(B, va);
      else if (vb !== undefined && va === undefined) this._originalSet(A, vb);
    }
    return this;
  }

  disentangle(a: NodeRef, b: NodeRef) {
    const ida = this._id(a), idb = this._id(b);
    if (!ida || !idb) return this;
    this.entanglements.get(ida)?.delete(idb);
    this.entanglements.get(idb)?.delete(ida);
    return this;
  }

  addHook(node: NodeRef, phase: HookPhase, fn: HookFn) {
    const n = this._node(node);
    if (!n) throw new Error("Atomics.addHook: node not found");
    const id = n.__id;
    if (!this.hooks.has(id)) this.hooks.set(id, { beforeSet: [], afterSet: [] });
    this.hooks.get(id)![phase].push(fn);
    return this;
  }

  setTrap(node: NodeRef, trap: HookFn) {
    const n = this._node(node);
    if (!n) throw new Error("Atomics.setTrap: node not found");
    this.setTraps.set(n.__id, trap);
    return this;
  }

  /** Helper: find node by id through a DFS from root */
  private _findById(targetId: string): FXNode | null {
    const stack: FXNode[] = [this.fx.root];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.__id === targetId) return cur;
      const kids = cur.__nodes ? Object.values(cur.__nodes) : [];
      for (const k of kids) stack.push(k);
    }
    return null;
  }
}

export default FXAtomicsPlugin;
