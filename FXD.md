# Combined Markdown Export

Generated: 2025-08-24T09:25:00.471619


## Index


### 1: Core
- `fx.config.json` — ~0 tokens
- `fx.ts` — ~10327 tokens

### 2: Plugins
- `plugins\fx-fs-fuse.ts` — ~546 tokens
- `plugins\fx-observatory.ts` — ~220 tokens

### 3: Modules
- `modules\fx-group-extras.ts` — ~82 tokens
- `modules\fx-parse.ts` — ~444 tokens
- `modules\fx-snippets.ts` — ~706 tokens
- `modules\fx-view.ts` — ~305 tokens

### 4: Server
- `server\dev.ts` — ~191 tokens
- `server\http.ts` — ~695 tokens

### 5: Examples
- `examples\repo-js\demo.ts` — ~162 tokens
- `examples\repo-js\seed.ts` — ~144 tokens

### 6: Docs
- `docs\FXD-PHASE-1-Demo.md` — ~469 tokens
- `docs\FXD-PHASE-1.md` — ~1234 tokens
- `docs\design.md` — ~969 tokens

**Total tokens: ~16494**

---

## 1: Core

### `fx.config.json`

```json

```


### `fx.ts`

```ts
/**
 * @file fx.ts
 * @version 1.0.0 "The Synthesis"
 * @description The definitive, unified FX Core Framework. This version integrates the
 * powerful Group Composition Engine directly into the core, providing reactive links,
 * live CSS-style selectors, and a complete set of data manipulation tools on every node.
 * It is a complete, isomorphic, single-file application operating system.
 *
 * Portable core for FX + FXD views:
 * Node graph + proxies + behaviors
 * Worker+SAB sync module loader (client), blocking fetch (server)
 * @-syntax (leading-@ returns module default; path@spec attaches or calls API)
 * .as<T>() typed unwrap; implicit reactive links
 * CSS-style selectors + reactive Groups (manual + include/exclude)
 * Config via $config.fx (+ runtime $system.fx overrides)
 * Optional Deno server for /fx/proxy and /fx/module (not OS-specific)
 * 
 * Architecture by: Charl Cronje
 */

//////////////////////////////
// Environment & Utilities //
//////////////////////////////

const HAS_DENO = typeof (globalThis as any).Deno !== "undefined";
const IS_SERVER = HAS_DENO;
const IS_CLIENT = !IS_SERVER;

const nowId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const isHttp = (u: string) => /^https?:\/\//i.test(u);
const isRel = (u: string) => u.startsWith("/") && !u.startsWith("//");
const toNumIfStr = (v: any) => (typeof v === "string" && v.trim() !== "" && isFinite(v as any)) ? parseFloat(v as any) : v;
const safeJson = (v: unknown) => { try { return JSON.stringify(v); } catch { return String(v); } };
const prop = (o: any, k: string, v: any, enumerable = false) =>
  Object.defineProperty(o, k, { value: v, configurable: true, writable: false, enumerable });

/////////////////////
// Core Structures //
/////////////////////

export interface FXNode {
  __id: string;
  __parent_id: string | null;
  __nodes: Record<string, FXNode>;
  __value: any;
  __type: string | null;
  __proto: string[];
  __behaviors: Map<string, any>;
  __instances: Map<string, any>;
  __effects: Function[];
  __watchers: Set<(nv: unknown, ov: unknown) => void>;
  __meta?: Record<string, any>; // optional metadata (e.g., { can: ['user'] })
}

export type FXMutableValue = unknown;

export type FXOpts = {
  default?: any;
  child?: string;
  cast?: "number" | "string" | "boolean" | "json" | ((v: any) => any);
  emptyAs?: Array<"undefined" | "null" | "NaN" | "" | 0 | false>;
  createIfMissing?: boolean;
};

export interface FXBuiltInViews {
  str(): string;
  num(): number;
  bool(): boolean;
  raw(): any;
}

export interface FXNodeProxy<V extends FXMutableValue = any, T = {}> extends FXBuiltInViews {
  (path: string, value?: any): FXNodeProxy<any, any>;

  val(): V;
  val(opts: FXOpts): V;
  val<NewV extends FXMutableValue>(newValue: NewV): FXNodeProxy<NewV, T>;
  val<NewV extends FXMutableValue>(newValue: NewV, opts: FXOpts): FXNodeProxy<NewV, T>;

  set<NewV extends FXMutableValue>(newValue: NewV): FXNodeProxy<NewV, T>;
  set<NewV extends FXMutableValue>(newValue: NewV, child: string): FXNodeProxy<NewV, T>;
  set<NewV extends FXMutableValue>(newValue: NewV, opts: FXOpts): FXNodeProxy<NewV, T>;
  set<NewV extends FXMutableValue>(newValue: NewV, child: string, opts: FXOpts): FXNodeProxy<NewV, T>;

  get(): V;
  get(defaultValue: any): V;
  get(defaultValue: any, opts: FXOpts): V;
  get(child: string): FXNodeProxy<any, any>;
  get(child: string, opts: FXOpts): FXNodeProxy<any, any>;
  get(defaultValue: any, child: string): FXNodeProxy<any, any>;
  get(defaultValue: any, child: string, opts: FXOpts): FXNodeProxy<any, any>;

  node(): FXNode;
  proxy(): this;
  type(): string | null;

  /** Type-safe instance unwrap: class or name; cross-realm tolerant */
  as<T>(ctorOrName: { new (...a: any[]): T } | string): T | null;

  inherit(...behaviors: any[]): this & T;
  watch(callback: (newValue: any, oldValue: any) => void): () => void;
  nodes(): { [key: string]: FXNodeProxy<any, any> };
}

/////////////////////////
// Sync Module Loader  //
/////////////////////////

class SyncModuleLoader {
  private worker: Worker | null = null;
  private sab: SharedArrayBuffer | null = null;
  private lock: Int32Array | null = null;
  private len: Int32Array | null = null;
  private buf: Uint8Array | null = null;
  private cache = new Map<string, string>();

  constructor() {
    if (IS_CLIENT && typeof SharedArrayBuffer !== "undefined") this.initWorker();
  }

  private initWorker() {
    this.sab = new SharedArrayBuffer(2 * 1024 * 1024); // 2MB
    this.lock = new Int32Array(this.sab, 0, 1);
    this.len = new Int32Array(this.sab, 4, 1);
    this.buf = new Uint8Array(this.sab, 8);

    const code = `
      self.onmessage = async (e) => {
        const { id, url, sab } = e.data;
        const lock = new Int32Array(sab, 0, 1);
        const len  = new Int32Array(sab, 4, 1);
        const buf  = new Uint8Array(sab, 8);
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const text = await res.text();
          const enc = new TextEncoder().encode(text);
          if (enc.length > buf.length) {
            Atomics.store(lock, 0, -id); Atomics.notify(lock, 0); return;
          }
          buf.set(enc); len[0] = enc.length;
          Atomics.store(lock, 0, id);
        } catch (err) {
          Atomics.store(lock, 0, -id);
        }
        Atomics.notify(lock, 0);
      };
    `;
    const blob = new Blob([code], { type: "application/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  loadSync(url: string): string {
    if (this.cache.has(url)) return this.cache.get(url)!;

    if (IS_SERVER) {
      let done = false, text = "", err: any;
      (async () => {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error("HTTP " + r.status);
          text = await r.text();
        } catch (e) { err = e; }
        done = true;
      })();
      const sleep = (ms: number) => (globalThis as any).Atomics
        ? Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
        : new Promise(r => setTimeout(r, ms));
      // @ts-ignore
      while (!done) await sleep(2);
      if (err) throw err;
      this.cache.set(url, text);
      return text;
    }

    if (!this.worker || !this.sab || !this.lock || !this.len || !this.buf) {
      throw new Error("SyncModuleLoader not initialized.");
    }

    const id = Math.floor(Math.random() * 1e9);
    Atomics.store(this.lock, 0, 0);
    this.worker.postMessage({ id, url, sab: this.sab });
    const result = Atomics.wait(this.lock, 0, 0, 15000);
    if (result === "timed-out") throw new Error("Module load timeout " + url);

    const signal = Atomics.load(this.lock, 0);
    if (signal !== id) throw new Error("Worker error or buffer too small for " + url);

    const n = this.len[0];
    const text = new TextDecoder().decode(this.buf.subarray(0, n));
    Atomics.store(this.lock, 0, 0);
    this.cache.set(url, text);
    return text;
  }
}

//////////////////////
// Plugin Management//
//////////////////////

class PluginManager {
  private fx: FXCore;
  private loaded = new Map<string, any>();
  private prefix = new Map<string, FXNodeProxy>();

  constructor(fx: FXCore) { this.fx = fx; }

  register<T extends object>(name: string, factoryOrObj: any, opts?: { global?: string; prefix?: string }) {
    if (this.loaded.has(name)) return this.fx.proxy(opts?.prefix ? `${opts.prefix}.${name}` : `plugins.${name}`) as FXNodeProxy<T>;
    const instance = typeof factoryOrObj === "function" ? factoryOrObj(this.fx) : factoryOrObj;
    const mount = opts?.prefix ? `${opts.prefix}.${name}` : `plugins.${name}`;
    const node = this.fx.proxy(mount);
    node.val(instance);
    if (instance && typeof instance === "object") this.fx.graftObject(node.node(), instance as any);
    this.loaded.set(name, instance);
    if (opts?.global) (globalThis as any)[opts.global] = node;
    if (opts?.prefix) this.prefix.set(opts.prefix, node);
    return node as FXNodeProxy<T>;
  }

  getByPrefix(prefix: string) { return this.prefix.get(prefix); }
}

//////////////
// FX Core  //
//////////////

export class FXCore {
  public root: FXNode;
  public pluginManager: PluginManager;
  public moduleLoader: SyncModuleLoader;

  // parent map for O(1) ancestry checks
  private __parentMap = new Map<string, FXNode>();

  // structure event bus (batched)
  private __structureListeners = new Set<(e: {kind: "create"|"remove"|"move"|"mutate", node: FXNode, parent?: FXNode, key?: string}) => void>();
  private __batchTimer: any = null;
  private __batchedEvents: any[] = [];

  constructor() {
    this.root = this.createNode(null);
    this.moduleLoader = new SyncModuleLoader();
    this.pluginManager = new PluginManager(this);
    this.ensureSystemRoots();
    this.installDefaults();
  }

  ensureSystemRoots() {
    const mk = (n: string) => { if (!this.root.__nodes[n]) { const c = this.createNode(this.root.__id); this.root.__nodes[n] = c; this.__parentMap.set(c.__id, this.root); } };
    ["app","config","plugins","modules","atomics","dom","session","system","cache","code","views","fs","history"].forEach(mk);
  }

  installDefaults() {
    // default config (can be overridden by $system.fx.* at runtime)
    $_$$('config.fx').set({
      selectors: {
        // attribute resolution order
        attrResolution: ["type", "raw", "child"],
        // allowed attribute operators
        enabledAttrOps: ["=", "!=", "^=", "$=", "*="],
        // enable :has()
        enableHas: false,
        // .class matches both __type and __proto
        classMatchesType: true,
      },
      groups: {
        reactiveDefault: true,
        debounceMs: 20,
      },
      performance: {
        enableParentMap: true,
        structureBatchMs: 5,
      }
    });
  }

  public onStructure(cb: (e:{kind:"create"|"remove"|"move"|"mutate", node: FXNode, parent?: FXNode, key?: string}) => void) {
    this.__structureListeners.add(cb);
    return () => this.__structureListeners.delete(cb);
  }
  private emitStructure(e:any) {
    const ms = fxCfg('performance.structureBatchMs', 5);
    this.__batchedEvents.push(e);
    if (ms <= 0) return this.__flushStructure();
    if (this.__batchTimer) return;
    this.__batchTimer = setTimeout(() => this.__flushStructure(), ms);
  }
  private __flushStructure() {
    const list = this.__batchedEvents.splice(0);
    clearTimeout(this.__batchTimer); this.__batchTimer = null;
    for (const ev of list) for (const cb of Array.from(this.__structureListeners)) { try { cb(ev); } catch {} }
  }

  createNode(parentId: string | null): FXNode {
    return {
      __id: nowId(),
      __parent_id: parentId,
      __nodes: Object.create(null),
      __value: undefined,
      __type: "raw",
      __proto: [],
      __behaviors: new Map(),
      __instances: new Map(),
      __effects: [],
      __watchers: new Set(),
    };
  }

  graftObject(host: FXNode, obj: Record<string, any>) {
    for (const k of Object.keys(obj)) this.setPath(k, obj[k], host);
  }

  private _finishSet(node: FXNode, old: any) {
    this.triggerEffects(node, "after.set", "__value", node.__value);
    node.__watchers.forEach(cb => { try { cb(node.__value, old); } catch (e) { console.error(e); } });
    this.emitStructure({ kind: "mutate", node });
  }

  set(node: FXNode, value: any) {
    const old = node.__value;
    this.triggerEffects(node, "before.set", "__value", value);

    // FXNode link
    if (value && typeof value === "object") {
      const maybe = (value as any).node?.() ?? value;
      if (maybe?.__id && maybe.__nodes) {
        node.__type = "FXNode";
        node.__value = { raw: maybe, FXNode: maybe, stringified: `[FXNode ${maybe.__id}]`, boolean: true };
        return this._finishSet(node, old);
      }
    }
    // Class instance
    if (value && typeof value === "object" && value.constructor?.name !== "Object") {
      const cname = value.constructor?.name ?? "Instance";
      node.__type = cname;
      node.__value = { [cname]: value, raw: value, stringified: safeJson(value) };
      node.__instances.set(cname, value);
      return this._finishSet(node, old);
    }
    // Plain object -> store + graft
    if (value && typeof value === "object" && value.constructor?.name === "Object") {
      node.__type = "object";
      node.__value = value;
      this.graftObject(node, value);
      return this._finishSet(node, old);
    }
    // Primitive/function -> view bag
    const bag = { raw: value, parsed: toNumIfStr(value), stringified: String(value), boolean: Boolean(value) };
    node.__type = (typeof bag.parsed === "number" && !Number.isNaN(bag.parsed)) ? "parsed" : "raw";
    node.__value = bag;
    return this._finishSet(node, old);
  }

  val(node: FXNode): any {
    const v = node.__value;
    if (v == null) return v;
    if (typeof v === "object" && "raw" in (v as any)) {
      const t = node.__type as string | undefined;
      if (t && (v as any)[t] !== undefined) return (v as any)[t];
      return (v as any).raw;
    }
    return v;
  }

  resolvePath(path: string, start: FXNode): FXNode | undefined {
    const keys = path.split(".").filter(Boolean);
    let cur: FXNode | undefined = start;
    for (const k of keys) {
      if (!cur) return;
      const v = this.val(cur);
      if (v?.__id) cur = v;
      if (!cur?.__nodes[k]) return;
      cur = cur.__nodes[k];
    }
    return cur;
  }

  setPath(path: string, value: any, start: FXNode): FXNode {
    const keys = path.split(".").filter(Boolean);
    let cur = start;
    for (const k of keys) {
      if (!cur.__nodes[k]) {
        const created = this.createNode(cur.__id);
        cur.__nodes[k] = created;
        this.__parentMap.set(created.__id, cur);
        this.emitStructure({ kind: "create", node: created, parent: cur, key: k });
      }
      cur = cur.__nodes[k];
    }
    if (value !== undefined) this.set(cur, value);
    return cur;
  }

  findParentFast(n: FXNode) {
    if (!fxCfg('performance.enableParentMap', true)) return null;
    return this.__parentMap.get(n.__id) || null;
  }

  triggerEffects(node: FXNode, event: string, key: string, value: any) {
    const proxy = this.createNodeProxy(node);
    for (const eff of node.__effects) { try { eff(event, proxy, key, value); } catch (e) { console.error(e); } }
  }

  createNodeProxy<V extends FXMutableValue, T extends object>(node: FXNode): FXNodeProxy<V, T> {
    const self = this;

    const isOpts = (x: any): x is FXOpts => x && typeof x === "object" && !Array.isArray(x);
    const isProxy = (v: any) => v && typeof v === "function" && typeof v.node === "function";
    const isEmpty = (v: any, opts?: FXOpts) => {
      const rules = opts?.emptyAs ?? ["undefined", "null"];
      for (const r of rules) {
        if (r === "undefined" && v === undefined) return true;
        if (r === "null" && v === null) return true;
        if (r === "NaN" && typeof v === "number" && Number.isNaN(v)) return true;
        if (r === "" && v === "") return true;
        if (r === 0 && v === 0) return true;
        if (r === false && v === false) return true;
      }
      return false;
    };
    const cast = (v: any, opts?: FXOpts) => {
      const c = opts?.cast;
      if (!c) return v;
      if (typeof c === "function") return c(v);
      switch (c) {
        case "number": return typeof v === "number" ? v : (v === "" || v == null ? NaN : Number(v));
        case "string": return String(v);
        case "boolean": return Boolean(v);
        case "json": try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; }
        default: return v;
      }
    };
    const ensureChild = (p: FXNode, k: string, create: boolean) => {
      let c = p.__nodes[k];
      if (!c && create) c = self.setPath(k, undefined, p);
      return c;
    };

    const baseFn = (path: string, value?: any): FXNodeProxy => {
      let target = self.resolvePath(path, node);
      if (!target) target = self.setPath(path, undefined, node);
      const proxy = self.createNodeProxy(target);
      if (value !== undefined) proxy.val(value);
      return proxy;
    };

    const builtViews: Record<string, string> = { str: "stringified", num: "parsed", bool: "boolean", raw: "raw" };

    const proxy = new Proxy(baseFn, {
      apply(_t, _thisArg, args: [string, any?]) { return baseFn(args[0], args[1]); },
      get(_t, key: string, receiver) {
        if (key === "val") {
          return (a?: any, b?: FXOpts) => {
            const setter = !(a && isOpts(a));
            if (setter && arguments.length >= 1) {
              const value = a, opts = b && isOpts(b) ? b : undefined;

              // implicit reactive link
              if (isProxy(value)) {
                const prev = (node as any).__linkFrom as undefined | { unwatch: () => void };
                if (prev) try { prev.unwatch(); } catch {}
                const fromNode = (value as FXNodeProxy).node();
                const unwatch = (value as FXNodeProxy).watch((_nv: any) => {
                  self.set(node, self.val(fromNode));
                });
                (node as any).__linkFrom = { unwatch };
                self.set(node, self.val(fromNode));
                return receiver;
              }

              const toSet = isEmpty(value, opts) ? opts?.default : value;
              self.set(node, cast(toSet, opts));
              return receiver;
            }
            const opts = a && isOpts(a) ? (a as FXOpts) : undefined;
            let v = self.val(node);
            if (isEmpty(v, opts)) v = opts?.default;
            return cast(v, opts);
          };
        }
        if (key === "set") {
          return (value: any, b?: any, c?: FXOpts) => {
            let child: string | undefined; let opts: FXOpts | undefined;
            if (typeof b === "string") { child = b; opts = isOpts(c) ? c : undefined; } else { opts = isOpts(b) ? b : undefined; }
            if (opts?.child && !child) child = opts.child;

            // reactive link
            if (isProxy(value)) {
              const prev = (node as any).__linkFrom as undefined | { unwatch: () => void };
              if (prev) try { prev.unwatch(); } catch {}
              const fromNode = (value as FXNodeProxy).node();
              const unwatch = (value as FXNodeProxy).watch((_nv: any) => self.set(node, self.val(fromNode)));
              (node as any).__linkFrom = { unwatch };
              self.set(node, self.val(fromNode));
              return receiver;
            }

            const toSet = isEmpty(value, opts) ? opts?.default : value;
            const cv = cast(toSet, opts);

            if (child) {
              const create = opts?.createIfMissing ?? true;
              const cnode = ensureChild(node, child, create);
              if (cnode) self.set(cnode, cv);
              return receiver;
            }
            self.set(node, cv); return receiver;
          };
        }
        if (key === "inherit") {
          return (...behaviors: any[]) => {
            for (const b of behaviors) {
              if (b?.name) {
                node.__behaviors.set(b.name, b);
                if (!node.__proto.includes(b.name)) node.__proto.push(b.name);
                if (typeof b.effect === "function") node.__effects.push(b.effect);
              }
            }
            return receiver;
          };
        }
        if (key === "get") {
          return (a?: any, b?: any, c?: FXOpts) => {
            let def: any = undefined, child: string | undefined, opts: FXOpts | undefined;
            if (typeof a === "string" && !isOpts(b)) { child = a; def = b; opts = isOpts(c) ? c : undefined; }
            else { def = a; if (typeof b === "string") child = b; opts = isOpts(b) ? b : (isOpts(c) ? c : undefined); }
            if (opts && opts.default !== undefined && def === undefined) def = opts.default;

            if (child) {
              const create = opts?.createIfMissing ?? true;
              const cnode = ensureChild(node, child, create);
              if (!cnode) return undefined;
              return self.createNodeProxy(cnode);
            }
            let v = self.val(node);
            if (isEmpty(v, opts)) v = def;
            return cast(v, opts);
          };
        }
        if (key === "node") return () => node;
        if (key === "proxy") return () => self.createNodeProxy(node);
        if (key === "type") return () => node.__type;

        if (key === "as") {
          return <T>(ctorOrName: { new (...a: any[]): T } | string): T | null => {
            const name = typeof ctorOrName === "string" ? ctorOrName : ctorOrName.name;
            const cached = node.__instances.get(name);
            if (cached) return cached as T;
            const raw = self.val(node);
            if (typeof ctorOrName !== "string" && raw instanceof ctorOrName) return raw as T;
            if (raw && raw.constructor && raw.constructor.name === name) return raw as T;
            return null;
          };
        }

        if (key === "watch") return (cb: any) => { node.__watchers.add(cb); return () => node.__watchers.delete(cb); };
        if (key === "nodes") {
          return () => {
            const out: Record<string, FXNodeProxy<any, any>> = {};
            for (const ck in node.__nodes) out[ck] = self.createNodeProxy(node.__nodes[ck]);
            return out;
          };
        }
        if (key in builtViews) return () => {
          const v = node.__value;
          if (v && typeof v === "object") return (v as any)[builtViews[key]];
          return v as unknown;
        };

        // --- SELECT / GROUP API ---
        if (key === "select") {
          return (selOrType?: string | string[]) => {
            const g = new Group(self, node);
            if (typeof selOrType === "string" && /[#\.\[:]/.test(selOrType)) {
              g.selectCss(selOrType).reactiveMode(true);
            } else if (selOrType) {
              g.byType(...(Array.isArray(selOrType) ? selOrType : [selOrType]));
            }
            return wrapGroup(g.initSelection());
          };
        }
        if (key === "group") {
          return (paths: string[] = []) => {
            const g = new Group(self, self.root);
            for (const p of paths) g.addPath(p);
            return wrapGroup(g);
          };
        }

        if (node.__behaviors?.has(key)) {
          const api = node.__behaviors.get(key);
          return new Proxy(api, {
            get(t, k: string) {
              const m = (t as any)[k];
              return typeof m === "function" ? m.bind(receiver) : m;
            }
          });
        }

        const cur = self.val(node);
        if (cur?.__id) return (self.createNodeProxy(cur) as any)[key];
        if (node.__nodes[key]) return self.createNodeProxy(node.__nodes[key]);

        return (baseFn as any)[key];
      }
    });

    return proxy as any;
  }

  proxy(path?: string) {
    const root = this.createNodeProxy(this.root);
    return path ? (root(path) as FXNodeProxy) : root;
  }
}

//////////////////////////////
// Config access helper     //
//////////////////////////////

const fxCfg = (path: string, fallback?: any) => {
  const sys = $_$$(`system.fx.${path}`).val();
  if (sys !== undefined) return sys;
  const cfg = $_$$(`config.fx.${path}`).val();
  return cfg !== undefined ? cfg : fallback;
};

//////////////////////////////
// Type-surface Attachments //
//////////////////////////////

type AttachOptions = {
  type: string;
  global?: string;
  instantiateDefault?: boolean | { args?: any[] };
  mode?: "mixin+type" | "type-only" | "mixin-only";
  onConflict?: "keep-first" | "overwrite" | "warn-and-namespace";
};

function attachNamespaceToNode(
  fx: FXCore,
  node: FXNode,
  ns: any,
  opts: AttachOptions
) {
  const typeName = opts.type;
  if (!node.__nodes) node.__nodes = Object.create(null);

  const shape = (ns?.default && typeof ns.default === "object")
    ? { ...(ns.default), ...Object.fromEntries(Object.entries(ns).filter(([k]) => k !== "default")) }
    : ns;

  if (!node.__value || typeof node.__value !== "object" || !("raw" in (node.__value as any))) {
    node.__value = { raw: node.__value, stringified: String(node.__value), boolean: Boolean(node.__value) };
  }
  const bag = node.__value as Record<string, any>;
  bag[typeName] ??= {};

  if (node.__type == null) node.__type = typeName;
  else if (node.__type !== typeName && !node.__proto.includes(typeName)) node.__proto.push(typeName);

  const attachFnToNode = (k: string, fn: Function) => {
    const sub = node.__nodes[k] || (node.__nodes[k] = fx.createNode(node.__id));
    (sub as any).__value = (...a: any[]) => fn(...a);
    prop(node, k, (...a: any[]) => fn(...a));
  };
  const attachValToNode = (k: string, v: any) => {
    const sub = node.__nodes[k] || (node.__nodes[k] = fx.createNode(node.__id));
    (sub as any).__value = v;
    Object.defineProperty(node, k, { configurable: true, enumerable: false, get: () => v });
  };
  const attachIntoTypeSurface = (k: string, v: any) => {
    const surface = bag[typeName];
    if (typeof v === "function") surface[k] = v.bind(surface);
    else surface[k] = v;
  };

  const onConflict = opts.onConflict ?? "warn-and-namespace";
  const allowMixin = (k: string) => {
    if (node.__nodes[k]) {
      if (onConflict === "overwrite") return true;
      if (onConflict === "warn-and-namespace") {
        console.warn(`[FX] Mixin conflict on '${k}' (type '${typeName}'); preserving existing; available via .val().${typeName}.${k}`);
        return false;
      }
      return false; // keep-first
    }
    return true;
  };

  for (const [k, v] of Object.entries(shape)) {
    attachIntoTypeSurface(k, v);
    if (opts.mode !== "type-only") {
      if (typeof v === "function") {
        if (allowMixin(k)) attachFnToNode(k, v);
      } else {
        if (!node.__nodes[k]) attachValToNode(k, v);
      }
    }
  }

  Object.defineProperty(node, typeName, {
    configurable: true,
    enumerable: false,
    get: () => (node.__value as any)[typeName],
  });
}

/////////////////////////////
// HTTP (API) Shortcuts    //
/////////////////////////////

type HttpArgs = { method?: string; headers?: Record<string, string>; body?: any; global?: string };
const toHeaders = (h: Record<string,string>) => { const out = new Headers(); for (const k in h) out.set(k, h[k]); return out; };
const deserialize = (x: any) => (typeof x === "string" ? (() => { try { return JSON.parse(x); } catch { return x; } })() : x);

function serverFetch(url: string, method: string, headers: Record<string,string>, body?: any) {
  return fetch(url, {
    method,
    headers,
    body: body == null ? undefined :
      (typeof body === "string" || body instanceof Blob ? body : JSON.stringify(body))
  });
}

type FutureOpts = { targetNode?: FXNode; globalName?: string; onResolve?: (v:any)=>void };
function FutureProxy(fx: FXCore, promise: Promise<any>, opts: FutureOpts = {}) {
  const { targetNode, globalName, onResolve } = opts;
  const state = { resolved: false, value: undefined as any, error: undefined as any };
  promise.then(v => {
    state.resolved = true; state.value = v;
    if (targetNode) fx.set(targetNode, v);
    if (globalName) (globalThis as any)[globalName] = v;
    onResolve?.(v);
  }).catch(e => { state.resolved = true; state.error = e; if (targetNode) fx.set(targetNode, { error: String(e) }); });

  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === "then") return (cb: (v:any)=>void) => { (!state.resolved) ? promise.then(cb) : cb(state.value); };
      if (prop === "await") return () => promise;
      if (!state.resolved) return undefined;
      const v = state.value, out = (v as any)?.[prop as any];
      return typeof out === "function" ? out.bind(v) : out;
    },
    apply(_t, _this, args) {
      if (!state.resolved) throw new Error("Future not resolved yet");
      if (typeof state.value === "function") return state.value(...args);
      throw new Error("Resolved value is not callable");
    }
  };
  const callable = function (...args: any[]) {
    if (!state.resolved) throw new Error("Future not resolved yet");
    if (typeof state.value === "function") return state.value(...args);
    return state.value;
  };
  return new Proxy(callable as any, handler);
}

function httpCall(url: string, method: string, args: HttpArgs | undefined, fx: FXCore, node: FXNode, forcedGlobal?: string) {
  const { headers = {}, body, global } = args || {};
  const g = forcedGlobal || global;

  if (IS_SERVER) {
    const p = serverFetch(url, method, headers, body).then(async r => {
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) return r.json();
      return r.text();
    }).then(deserialize);
    return FutureProxy(fx, p, { targetNode: node, globalName: g });
  }

  const sameOrigin = isRel(url) ? url : `/fx/proxy?url=${encodeURIComponent(url)}`;
  const p = fetch(sameOrigin, {
    method,
    headers: toHeaders(headers),
    body: body == null ? undefined : (typeof body === "string" || body instanceof Blob ? body : JSON.stringify(body))
  }).then(async r => {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    return r.text();
  }).then(deserialize);

  return FutureProxy(fx, p, { targetNode: node, globalName: g });
}

//////////////////////////
// @-syntax integration //
//////////////////////////

function loadModuleSyncDefaultOrNS(fx: FXCore, specUrl: string) {
  const code = fx.moduleLoader.loadSync(specUrl);
  const module: { exports: any } = { exports: {} };
  const exports = module.exports;
  const fn = new Function("module", "exports", "fx", code);
  fn.call(exports, module, exports, fx);

  const ns = module.exports || {};
  const def = Object.prototype.hasOwnProperty.call(ns, "default") ? ns.default : undefined;

  if (typeof def === "function") {
    for (const [k, v] of Object.entries(ns)) if (k !== "default" && !(k in def)) prop(def, k, v);
    if (!("new" in def)) prop(def, "new", (...a:any[]) => new (def as any)(...a));
    prop(def, "ns", ns);
    return def;
  }
  if (def && typeof def === "object") {
    for (const [k, v] of Object.entries(ns)) if (k !== "default" && !(k in def)) prop(def, k, v);
    prop(def, "ns", ns);
    return def;
  }
  return ns;
}

type AttachOptionsFull = AttachOptions & { global?: string };

function buildAtBinding(fx: FXCore, baseNode: FXNode, spec: string) {
  const isApi = isHttp(spec) || isRel(spec);
  const ctx: { node: FXNode | undefined; ns: any; opts: AttachOptionsFull | any } = { node: baseNode, ns: undefined, opts: {} };

  function options(o: Partial<AttachOptionsFull>) { ctx.opts = { ...ctx.opts, ...o }; return api; }

  function exportsProxy() {
    const target = ctx.ns?.default ?? ctx.ns;
    const handler: ProxyHandler<any> = {
      get(_t, prop) {
        if (isApi && typeof prop === "string" && ["get","post","put","patch","delete","fetch"].includes(prop)) {
          const meth = prop === "fetch" ? "GET" : prop.toUpperCase();
          if (ctx.node?.__nodes[prop]) return fx.createNodeProxy(ctx.node.__nodes[prop]); // real subnode wins
          return (args?: HttpArgs) => httpCall(spec, meth, args, fx, ctx.node!, ctx.opts.global);
        }
        const val = (ctx.ns?.default && (ctx.ns.default as any)[prop]) ?? (ctx.ns as any)[prop];
        if (typeof val === "function") return (...a:any[]) => val.apply(ctx.ns.default ?? ctx.ns, a);
        return val;
      },
      apply(_t,_this,args) {
        const d = ctx.ns?.default;
        if (typeof d === "function") return d(...args);
        throw new Error("Default export is not callable.");
      }
    };
    const callable = function (...args:any[]) {
      const d = ctx.ns?.default;
      if (typeof d === "function") return d(...args);
      throw new Error("Default export is not callable.");
    };
    return new Proxy(callable as any, handler);
  }

  function loadModuleAndBind(url: string) {
    const code = fx.moduleLoader.loadSync(url);
    const module: { exports: any } = { exports: {} };
    const exports = module.exports;
    const fn = new Function("module", "exports", "fx", code);
    fn.call(exports, module, exports, fx);

    if (ctx.opts?.instantiateDefault) {
      const d = module.exports.default;
      const isClass = typeof d === "function" && /^class\s/.test(Function.prototype.toString.call(d));
      if (isClass) {
        const args = typeof ctx.opts.instantiateDefault === "object" ? (ctx.opts.instantiateDefault.args ?? []) : [];
        module.exports.default = new d(...args);
      }
    }

    ctx.ns = module.exports;
    attachNamespaceToNode(fx, ctx.node!, ctx.ns, { type: ctx.opts?.type || "module", ...ctx.opts });
    if (ctx.opts?.global) (globalThis as any)[ctx.opts.global] = ctx.ns.default ?? ctx.ns;
    return exportsProxy();
  }

  function fetchApi(url: string) {
    const callable:any = {};
    callable.fetch = (args?: HttpArgs) => httpCall(url, "GET", args, fx, ctx.node!, ctx.opts.global);
    callable.get   = (args?: HttpArgs) => ctx.node?.__nodes["get"]    ? fx.createNodeProxy(ctx.node.__nodes["get"])    : httpCall(url, "GET", args, fx, ctx.node!, ctx.opts.global);
    callable.post  = (args?: HttpArgs) => ctx.node?.__nodes["post"]   ? fx.createNodeProxy(ctx.node.__nodes["post"])   : httpCall(url, "POST", args, fx, ctx.node!, ctx.opts.global);
    callable.put   = (args?: HttpArgs) => ctx.node?.__nodes["put"]    ? fx.createNodeProxy(ctx.node.__nodes["put"])    : httpCall(url, "PUT", args, fx, ctx.node!, ctx.opts.global);
    callable.patch = (args?: HttpArgs) => ctx.node?.__nodes["patch"]  ? fx.createNodeProxy(ctx.node.__nodes["patch"])  : httpCall(url, "PATCH", args, fx, ctx.node!, ctx.opts.global);
    callable.delete= (args?: HttpArgs) => ctx.node?.__nodes["delete"] ? fx.createNodeProxy(ctx.node.__nodes["delete"]) : httpCall(url, "DELETE", args, fx, ctx.node!, ctx.opts.global);
    callable.options = options;
    return callable;
  }

  const api: any = isApi ? fetchApi(spec) : loadModuleAndBind(spec);
  api.options = options;
  return api;
}

function patchDollarAtSyntax(fx: FXCore) {
  const original = fx.proxy(); // root proxy
  const baseDollar = (path: string) => original(path);

  const dollar = new Proxy(baseDollar as any, {
    apply(_t, _this, args: [string]) {
      const s = args[0];

      // Leading-@ => synchronous module default/NS value returned directly
      if (typeof s === "string" && s.startsWith("@")) {
        const spec = s.slice(1).trim();
        return loadModuleSyncDefaultOrNS(fx, spec);
      }

      // path@spec => attach to node or API shortcuts
      if (typeof s === "string" && s.includes("@")) {
        const idx = s.indexOf("@");
        const path = s.slice(0, idx).trim();
        const spec = s.slice(idx + 1).trim();
        const node = path ? fx.setPath(path, undefined, fx.root) : fx.root;
        return buildAtBinding(fx, node, spec);
      }

      return baseDollar(s);
    },
    get(_t, key: string) {
      // $$["@..."] => sync module value
      if (typeof key === "string" && key.startsWith("@")) {
        return loadModuleSyncDefaultOrNS(fx, key.slice(1).trim());
      }
      return (original as any)[key];
    }
  });

  (globalThis as any).$$ = dollar;
  return dollar as FXNodeProxy;
}

//////////////////////////////
// Selector Engine (CSS-ish)//
//////////////////////////////

type SelSimple =
  | { kind: "class"; name: string }
  | { kind: "id"; id: string }
  | { kind: "attr"; key: string; op: "="|"!="|"^="|"$="|"*="; value: string }
  | { kind: "not"; inner: SelCompound }
  | { kind: "can"; inner: SelSimple }
  | { kind: "has"; inner: SelCompound };

type SelStep = { simple: SelSimple[] };
type SelCombinator = "desc" | "child";
type SelCompound = { chain: Array<SelStep | SelCombinator> };
type SelList = SelCompound[];

function parseSelector(input: string): SelList {
  const tokens = input.split(",").map(s => s.trim()).filter(Boolean);
  return tokens.map(parseOne);
}
function parseOne(s: string): SelCompound {
  const chain: Array<SelStep|SelCombinator> = [];
  let i = 0;
  const ws = () => { while (/\s/.test(s[i]||"")) i++; };
  const readIdent = () => { const m = /^[A-Za-z0-9_\-\$]+/.exec(s.slice(i)); if (!m) return ""; i += m[0].length; return m[0]; };
  const step: SelStep = { simple: [] };
  const pushStepIfNeeded = () => { if (step.simple.length) { chain.push({ simple: [...step.simple] }); step.simple.length = 0; } };

  while (i < s.length) {
    ws();
    const c = s[i];
    if (!c) break;
    if (c === '.') {
      i++; const name = readIdent(); step.simple.push({ kind: "class", name });
    } else if (c === '#') {
      i++; const id = readIdent(); step.simple.push({ kind: "id", id });
    } else if (c === '[') {
      i++; ws();
      const key = readIdent(); ws();
      let op: any = "=";
      if ("=!^$*".includes(s[i] || "")) {
        const allowed = new Set(fxCfg('selectors.enabledAttrOps', ["="]));
        if (s[i] === '=') { op = "="; i++; }
        else if (s[i] === '!' && s[i+1] === '=') { i+=2; op = "!="; }
        else if (s[i] === '^' && s[i+1] === '=') { i+=2; op = "^="; }
        else if (s[i] === '$' && s[i+1] === '=') { i+=2; op = "$="; }
        else if (s[i] === '*' && s[i+1] === '=') { i+=2; op = "*="; }
        if (!allowed.has(op)) op = "=";
      }
      ws();
      let value = "";
      if (s[i] === '"' || s[i] === "'") {
        const q = s[i++]; const start = i;
        while (i < s.length && s[i] !== q) i++;
        value = s.slice(start, i); i++;
      } else {
        const m = /^[^\]\s]+/.exec(s.slice(i)); value = m ? m[0] : ""; i += value.length;
      }
      ws(); if (s[i] === ']') i++;
      step.simple.push({ kind: "attr", key, op, value });
    } else if (c === ':') {
      i++; const id = readIdent(); ws();
      if (s[i] === '(') {
        i++;
        const inside = readBalanced();
        if (id === "not") {
          const inner = parseOne(inside);
          step.simple.push({ kind: "not", inner });
        } else if (id === "can") {
          const innerAst = parseSelector(inside)[0];
          const firstStep = innerAst?.chain?.find((x:any)=> (x as any).simple) as SelStep;
          const firstSimple = firstStep?.simple?.[0] as SelSimple;
          if (firstSimple) step.simple.push({ kind: "can", inner: firstSimple });
        } else if (id === "has") {
          const enabled = fxCfg('selectors.enableHas', false);
          if (enabled) step.simple.push({ kind: "has", inner: parseOne(inside) });
        }
      }
      function readBalanced() {
        let depth = 1, out = "";
        while (i < s.length && depth > 0) {
          if (s[i] === '(') depth++;
          else if (s[i] === ')') depth--;
          if (depth > 0) out += s[i];
          i++;
        }
        return out.trim();
      }
    } else if (c === '>') {
      pushStepIfNeeded(); chain.push("child"); i++;
    } else if (/\s/.test(c)) {
      pushStepIfNeeded();
      if (chain.length && chain[chain.length-1] !== "desc") chain.push("desc");
      ws();
    } else {
      i++;
    }
  }
  pushStepIfNeeded();
  return { chain };
}

function matchSimple(fx: FXCore, node: FXNode, s: SelSimple): boolean {
  if (s.kind === "class") {
    const t = node.__type, protos = node.__proto || [];
    const matchType = fxCfg('selectors.classMatchesType', true);
    return (matchType && t === s.name) || protos.includes(s.name);
  }
  if (s.kind === "id") return node.__id === s.id;
  if (s.kind === "attr") {
    const order = fxCfg('selectors.attrResolution', ["type","raw","child"]);
    const rawBag = fx.val(node);
    const typeName = node.__type || null;
    const typeSurface = (rawBag && typeName && typeof rawBag === "object") ? (rawBag as any)[typeName] : undefined;
    let found: any;

    for (const where of order) {
      if (where === "type" && typeSurface && typeof typeSurface === "object" && s.key in typeSurface) { found = (typeSurface as any)[s.key]; break; }
      if (where === "raw" && rawBag && typeof rawBag === "object" && s.key in (rawBag as any)) { found = (rawBag as any)[s.key]; break; }
      if (where === "child" && node.__nodes[s.key]) { found = fx.val(node.__nodes[s.key]); break; }
    }

    const val = String(found ?? "");
    const rhs = s.value;
    switch (s.op) {
      case "=":  return val === rhs;
      case "!=": return val !== rhs;
      case "^=": return val.startsWith(rhs);
      case "$=": return val.endsWith(rhs);
      case "*=": return val.includes(rhs);
      default:   return false;
    }
  }
  if (s.kind === "can") {
    const inner = s.inner;
    const meta = (node as any).__meta;
    const can = meta?.can as string[] | undefined;
    if (inner.kind === "class") return Array.isArray(can) && can.includes(inner.name);
    return false;
  }
  if (s.kind === "has") {
    if (!fxCfg('selectors.enableHas', false)) return false;
    const inner = s.inner;
    const stack = Object.values(node.__nodes);
    while (stack.length) {
      const c = stack.pop()!;
      if (matchCompound(fx, c, inner)) return true;
      for (const k in c.__nodes) stack.push(c.__nodes[k]);
    }
    return false;
  }
  if (s.kind === "not") return !matchCompound(fx, node, s.inner);
  return false;
}
function matchStep(fx: FXCore, node: FXNode, step: SelStep): boolean {
  return step.simple.every(s => matchSimple(fx, node, s));
}
function findParent(fx: FXCore, n: FXNode) {
  const m = (fx as any).findParentFast?.(n);
  if (m !== undefined) return m;
  const stack = [fx.root];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const k in cur.__nodes) {
      const c = cur.__nodes[k];
      if (c === n) return cur;
      stack.push(c);
    }
  }
  return null;
}
function matchCompound(fx: FXCore, node: FXNode, ast: SelCompound): boolean {
  const parts = ast.chain.filter(Boolean);
  let curNodes: FXNode[] = [node];
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part === "desc" || part === "child") continue;
    const step = part as SelStep;
    curNodes = curNodes.filter(n => matchStep(fx, n, step));
    if (!curNodes.length) return false;

    const prev = parts[i-1];
    if (prev === "child") {
      curNodes = curNodes.map(n => findParent(fx, n)).filter(Boolean) as FXNode[];
      i--;
      if (!curNodes.length) return false;
    } else if (prev === "desc") {
      const ancestors = new Set<FXNode>();
      for (const n of curNodes) {
        let p = findParent(fx, n);
        while (p) { ancestors.add(p); p = findParent(fx, p); }
      }
      curNodes = Array.from(ancestors);
      i--;
      if (!curNodes.length) return false;
    } else {
      break;
    }
  }
  return curNodes.length > 0;
}

/////////////////////
// Reactive Groups //
/////////////////////

type GroupMode = "list" | "set";
type GroupListener = (g: Group, payload?: any) => void;

class Group {
  private fx: FXCore;
  private anchor: FXNode;
  private members = new Set<FXNode>();          // current reconciled members
  private perNodeUnwatch = new Map<string, () => void>();

  private mode: GroupMode = "list";
  private deepFlag = false;
  private listeners = new Map<string, Set<GroupListener>>();
  private filterFn: ((p: FXNodeProxy) => boolean) | null = null;
  private typeFilter: string[] | null = null;

  private reactive = fxCfg('groups.reactiveDefault', true);
  private debounceMs = fxCfg('groups.debounceMs', 20);
  private offStructure?: () => void;

  // CSS composition
  private includeSelectors: SelList[] = [];
  private excludeSelectors: SelList[] = [];

  // Ordered manual set
  private manualOrder: string[] = [];
  private manualSet   = new Set<string>();

  constructor(fx: FXCore, anchor: FXNode) {
    this.fx = fx; this.anchor = anchor;
  }

  // type guards
  private isPredicate(x: any): x is (p: FXNodeProxy) => boolean {
    // FXNodeProxy is also a function; it has a .node() method. A user predicate won't.
    return typeof x === "function" && typeof (x as any).node !== "function";
  }

  // ---------- selection & filters ----------
  byType(...types: string[]) { this.typeFilter = types.filter(Boolean); this.reconcile(); return this; }
  where(fn: (p: FXNodeProxy) => boolean) { this.filterFn = fn; this.reconcile(); return this; }
  deep(flag = true) { this.deepFlag = flag; this.reconcile(); return this; }
  modeSet() { this.mode = "set"; return this; }
  modeList() { this.mode = "list"; return this; }

  reactiveMode(flag = true) { this.reactive = flag; if (flag) this.hook(); else this.unhook(); return this; }
  debounce(ms: number) { this.debounceMs = ms; return this; }

  selectCss(selector: string) { this.includeSelectors.push(parseSelector(selector)); this.reconcile(); return this; }
  excludeCss(selector: string) { this.excludeSelectors.push(parseSelector(selector)); this.reconcile(); return this; }
  removeSelector(selector: string) {
    const ast = JSON.stringify(parseSelector(selector));
    this.includeSelectors = this.includeSelectors.filter(s => JSON.stringify(s) !== ast);
    this.excludeSelectors = this.excludeSelectors.filter(s => JSON.stringify(s) !== ast);
    this.reconcile(); return this;
  }
  clearSelectors(kind: "include" | "exclude" | "all" = "all") {
    if (kind === "include" || kind === "all") this.includeSelectors = [];
    if (kind === "exclude" || kind === "all") this.excludeSelectors = [];
    this.reconcile(); return this;
  }

  // ---------- manual ordered membership ----------
  addPath(path: string) { const n = this.fx.resolvePath(path, this.fx.root); if (n) this.add(n); return this; }
  private idOf(n: FXNode) { return n.__id; }
  private resolveTarget(t: string | FXNodeProxy | FXNode): FXNode | null {
    if (!t) return null;
    if (typeof t === "string") return this.fx.resolvePath(t, this.fx.root) || null;
    if (typeof t === "function" && typeof (t as any).node === "function") return (t as any).node();
    const n = t as FXNode;
    return n?.__id ? n : null;
  }

  add(target: string | FXNodeProxy | FXNode) {
    const n = this.resolveTarget(target); if (!n) return this;
    const id = this.idOf(n);
    if (!this.manualSet.has(id)) { this.manualSet.add(id); this.manualOrder.push(id); this.emit("change"); }
    return this;
  }
  prepend(target: string | FXNodeProxy | FXNode) {
    const n = this.resolveTarget(target); if (!n) return this;
    const id = this.idOf(n);
    if (!this.manualSet.has(id)) { this.manualSet.add(id); this.manualOrder.unshift(id); this.emit("change"); }
    return this;
  }
  insert(index: number, target: string | FXNodeProxy | FXNode) {
    const n = this.resolveTarget(target); if (!n) return this;
    const id = this.idOf(n);
    if (!this.manualSet.has(id)) {
      this.manualSet.add(id);
      const i = Math.max(0, Math.min(index, this.manualOrder.length));
      this.manualOrder.splice(i, 0, id);
      this.emit("change");
    }
    return this;
  }
  addAfter(existing: string | FXNodeProxy | FXNode, target: string | FXNodeProxy | FXNode, opts?: { occurrence?: number }) {
    const ex = this.resolveTarget(existing); const add = this.resolveTarget(target);
    if (!ex || !add) return this;
    const exId = this.idOf(ex), addId = this.idOf(add);
    let occ = opts?.occurrence ?? 1, pos = -1;
    for (let i = 0; i < this.manualOrder.length; i++) {
      if (this.manualOrder[i] === exId && --occ === 0) { pos = i; break; }
    }
    if (pos === -1) return this.add(add);
    if (!this.manualSet.has(addId)) {
      this.manualSet.add(addId);
      this.manualOrder.splice(pos + 1, 0, addId);
      this.emit("change");
    }
    return this;
  }
  addBefore(existing: string | FXNodeProxy | FXNode, target: string | FXNodeProxy | FXNode) {
    const ex = this.resolveTarget(existing); const add = this.resolveTarget(target);
    if (!ex || !add) return this;
    const exId = this.idOf(ex), addId = this.idOf(add);
    const pos = this.manualOrder.indexOf(exId);
    if (pos < 0) return this.prepend(add);
    if (!this.manualSet.has(addId)) {
      this.manualSet.add(addId);
      this.manualOrder.splice(pos, 0, addId);
      this.emit("change");
    }
    return this;
  }
  remove(target: string | FXNodeProxy | FXNode | ((p: FXNodeProxy)=>boolean)) {
    if (this.isPredicate(target)) {
      for (let i = this.manualOrder.length - 1; i >= 0; i--) {
        const id = this.manualOrder[i];
        const node = this.findById(id);
        if (node && target(this.fx.createNodeProxy(node))) {
          this.manualOrder.splice(i, 1); this.manualSet.delete(id);
        }
      }
      this.emit("change");
      return this;
    }
    const n = this.resolveTarget(target); if (!n) return this;
    const id = this.idOf(n);
    if (this.manualSet.has(id)) {
      this.manualSet.delete(id);
      const idx = this.manualOrder.indexOf(id);
      if (idx >= 0) this.manualOrder.splice(idx, 1);
      this.emit("change");
    }
    return this;
  }
  clear() { this.manualOrder.length = 0; this.manualSet.clear(); this.emit("change"); return this; }
  private findById(id: string): FXNode | null {
    const stack = [this.fx.root];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.__id === id) return n;
      for (const k in n.__nodes) stack.push(n.__nodes[k]);
    }
    return null;
  }

  // ---------- materialization & reconcile ----------
  private collectBySelectors(lists: SelList[]): FXNode[] {
    if (!lists.length) return [];
    const res: FXNode[] = [];
    const visit = (n: FXNode) => {
      for (const k in n.__nodes) {
        const c = n.__nodes[k];
        const ok = lists.some(list => list.some(comp => matchCompound(this.fx, c, comp)));
        if (ok) res.push(c);
        if (this.deepFlag) visit(c);
      }
    };
    visit(this.anchor);
    return res;
  }

  private materialize(): FXNode[] {
    // 1) manual list in order
    const out: FXNode[] = [];
    const seen = new Set<string>();
    for (const id of this.manualOrder) {
      const n = this.findById(id); if (!n) continue;
      out.push(n); seen.add(id);
    }
    // 2) includes
    const inc = this.collectBySelectors(this.includeSelectors);
    for (const n of inc) {
      const id = this.idOf(n);
      if (!seen.has(id)) { out.push(n); seen.add(id); }
    }
    // 3) excludes
    const exc = new Set(this.collectBySelectors(this.excludeSelectors).map(n => this.idOf(n)));
    const filtered = out.filter(n => !exc.has(this.idOf(n)));
    return filtered;
  }

  private scanFallback(): FXNode[] {
    const res: FXNode[] = [];
    const visit = (n: FXNode) => {
      for (const k in n.__nodes) {
        const c = n.__nodes[k];
        let ok = true;
        if (this.typeFilter && this.typeFilter.length) ok = !!c.__type && this.typeFilter.includes(c.__type);
        if (ok && this.filterFn) ok = this.filterFn(this.fx.createNodeProxy(c));
        if (ok) res.push(c);
        if (this.deepFlag) visit(c);
      }
    };
    visit(this.anchor);
    return res;
  }

  private scanOnce() {
    const haveCss = this.includeSelectors.length || this.excludeSelectors.length;
    return haveCss ? this.materialize() : this.scanFallback();
  }

  private resubscribe() {
    for (const un of this.perNodeUnwatch.values()) try { un(); } catch {}
    this.perNodeUnwatch.clear();
    for (const n of this.members) {
      const un = this.fx.createNodeProxy(n).watch((_nv: any) => this.emit("change"));
      this.perNodeUnwatch.set(n.__id, un);
    }
  }

  private reconcile() {
    const next = new Set(this.scanOnce());
    let changed = false;

    for (const n of Array.from(this.members)) {
      if (!next.has(n)) { this.members.delete(n); changed = true; const un = this.perNodeUnwatch.get(n.__id); if (un) { un(); this.perNodeUnwatch.delete(n.__id); } }
    }
    for (const n of next) {
      if (!this.members.has(n)) { this.members.add(n); changed = true; const un = this.fx.createNodeProxy(n).watch((_nv:any)=> this.emit("change")); this.perNodeUnwatch.set(n.__id, un); }
    }
    if (changed) this.emit("change");
  }

  initSelection() { this.reconcile(); if (this.reactive) this.hook(); return this; }

  private isInSubtree(n: FXNode, root: FXNode) {
    if (n === root) return true;
    let p = findParent(this.fx, n);
    while (p) { if (p === root) return true; p = findParent(this.fx, p); }
    return false;
  }

  private hook() {
    if (this.offStructure) return;
    let pending = false, timer: any = null;
    const flush = () => { pending = false; timer = null; this.reconcile(); };
    const schedule = () => {
      if (pending) return;
      pending = true;
      if (this.debounceMs <= 0) flush();
      else timer = setTimeout(flush, this.debounceMs);
    };

    this.offStructure = this.fx.onStructure((e) => {
      if (!this.isInSubtree(e.node, this.anchor)) return;
      schedule();
    });
    this.reconcile();
  }

  private unhook() {
    if (this.offStructure) { try { this.offStructure(); } catch {} this.offStructure = undefined; }
    for (const un of this.perNodeUnwatch.values()) try { un(); } catch {}
    this.perNodeUnwatch.clear();
  }

  // ---------- public read ops ----------
  list(): FXNodeProxy[] {
    const arr = Array.from(this.members).map(n => this.fx.createNodeProxy(n));
    return this.mode === "list" ? arr : Array.from(new Set(arr));
  }
  private values() { return this.list().map(p => p.val()); }
  sum() { return this.values().reduce((a: any, b: any) => Number(a) + Number(b), 0); }
  concat(sep = "") { return this.values().join(sep); }
  // overloads ensure correct return typing
  cast(kind: "number"): number[];
  cast(kind: "string"): string[];
  cast(kind: "boolean"): boolean[];
  cast(kind: "number"|"string"|"boolean") { const v = this.values(); if (kind === "number") return v.map(Number); if (kind === "boolean") return v.map(Boolean); return v.map(String); }
  max() { return Math.max(...(this.cast("number") as number[])); }
  min() { return Math.min(...(this.cast("number") as number[])); }
  average() { const a = this.cast("number") as number[]; return a.length ? a.reduce((x,y)=>x+y,0)/a.length : NaN; }
  sort(dir: "asc"|"desc" = "asc") { const v = [...this.values()].sort((a:any,b:any)=> (a<b?-1:a>b?1:0)); return dir==="asc"?v:v.reverse(); }
  same(kind: "value"|"type" = "value") {
    const arr = this.list();
    if (!arr.length) return true;
    if (kind === "type") { const t = arr[0].type(); return arr.every(n => n.type() === t); }
    const v = arr[0].val(); return arr.every(n => n.val() === v);
  }
  has(v: any) { return this.values().some(x => x === v); }

  // events
  on(ev: string, handler: GroupListener | any) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    const wrap: GroupListener =
      typeof handler === "function"
        ? handler
        : (g: Group) => {
            if (ev === "has" && handler?.value !== undefined) {
              if (g.has(handler.value)) handler.callback?.(g);
            } else if (ev === "average") {
              const avg = g.average();
              if ((handler.equalTo !== undefined && avg === handler.equalTo)
               || (handler.greaterThan !== undefined && avg > handler.greaterThan)
               || (handler.lessThan !== undefined && avg < handler.lessThan)) {
                handler.callback?.(g, avg);
              }
            } else {
              handler?.callback?.(g);
            }
          };
    this.listeners.get(ev)!.add(wrap);
    return () => this.off(ev, wrap);
  }
  off(ev: string, handler: GroupListener) { this.listeners.get(ev)?.delete(handler); }
  emit(ev: string) { const ls = this.listeners.get(ev); if (!ls) return; for (const h of Array.from(ls)) try { h(this); } catch (e) { console.error(e); } }
}

function wrapGroup(g: Group) {
  return {
    // membership (paths or proxies)
    add: (t:any) => { g.add(t); return wrapGroup(g); },
    insert: (i:number, t:any) => { g.insert(i, t); return wrapGroup(g); },
    addAfter: (ex:any, t:any, o?:{occurrence?:number}) => { g.addAfter(ex, t, o); return wrapGroup(g); },
    addBefore: (ex:any, t:any) => { g.addBefore(ex, t); return wrapGroup(g); },
    prepend: (t:any) => { g.prepend(t); return wrapGroup(g); },
    remove: (t:any) => { g.remove(t); return wrapGroup(g); },
    clear: () => { g.clear(); return wrapGroup(g); },

    // composition (CSS)
    select: (cssOrType?: string | string[]) => {
      if (typeof cssOrType === "string" && /[#\.\[:]/.test(cssOrType)) g.selectCss(cssOrType);
      else if (cssOrType) g.byType(...(Array.isArray(cssOrType) ? cssOrType : [cssOrType]));
      return wrapGroup(g.initSelection());
    },
    include: (css: string) => { g.selectCss(css); return wrapGroup(g); },
    exclude: (css: string) => { g.excludeCss(css); return wrapGroup(g); },
    removeSelector: (css: string) => { g.removeSelector(css); return wrapGroup(g); },
    clearSelectors: (kind?: "include"|"exclude"|"all") => { g.clearSelectors(kind); return wrapGroup(g); },

    // config
    options: (o:{mode?: "set"|"list"}) => { if (o.mode === "set") g.modeSet(); else if (o.mode === "list") g.modeList(); return wrapGroup(g); },
    deep: (flag = true) => { g.deep(flag); return wrapGroup(g); },
    where: (fn:(p: FXNodeProxy)=>boolean) => { g.where(fn); return wrapGroup(g); },
    reactive: (flag = true) => { g.reactiveMode(flag); return wrapGroup(g); },
    debounce: (ms:number) => { g.debounce(ms); return wrapGroup(g); },
    name: (_n: string) => wrapGroup(g),

    // events
    on: (ev: string, h:any) => g.on(ev, h),
    off: (ev: string, h:any) => g.off(ev, h),

    // access & ops
    list: () => g.list(),
    sum: () => g.sum(),
    concat: (sep?:string) => g.concat(sep),
    cast: (k:"number"|"string"|"boolean") => g.cast(k as any),
    max: ()=> g.max(),
    min: ()=> g.min(),
    average: ()=> g.average(),
    sort: (dir?: "asc"|"desc") => g.sort(dir),
    same: (kind?: "value"|"type") => g.same(kind ?? "value"),
    hasValue: (v:any)=> g.has(v),

    _group: g,
  };
}

/////////////////////////////
// Globals & Bootstrapping //
/////////////////////////////

export const fx = new FXCore();
export const $_$$ = fx.createNodeProxy(fx.root);
fx.ensureSystemRoots();

// expose early config defaults
// (already set in constructor via installDefaults)

export let $$: FXNodeProxy = $_$$("app");
export const $root = (p: string) => { $$ = $_$$(p); (globalThis as any).$$ = $$; };
export const $val = (path: string, value?: any, def?: any) => { const r = $$(path).val(); if (value !== undefined) { $$(path).val(value); return $$(path); } return r === undefined ? def : r; };
export const $set = (path: string, value: any) => $$(path).set(value);
export const $get = (path: string) => $$(path).get();
export const $has = (path: string) => $$(path).val() !== undefined;

// convenience globals
export const $app = $_$$('app');
export const $config = $_$$('config');
export const $plugins = $_$$('plugins');
export const $modules = $_$$('modules');
export const $atomics = $_$$('atomics');
export const $dom = $_$$('dom');
export const $session = $_$$('session');
export const $system = $_$$('system');
export const $cache = $_$$('cache');

Object.assign(globalThis as any, { fx, $_$$, $$, $root, $val, $set, $get, $has, $app, $config, $plugins, $modules, $atomics, $dom, $session, $system, $cache });

// Enable @-syntax (module loading + API shortcuts)
$$ = patchDollarAtSyntax(fx);

///////////////////////
// Optional Deno srv //
///////////////////////

if (IS_SERVER && (globalThis as any).Deno?.serve) {
  const PORT = Number((globalThis as any).Deno.env.get("PORT") || "8787");

  (globalThis as any).Deno.serve({ port: PORT }, async (req: Request) => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (path === "/fx/health") return cors(json({ ok: true, time: new Date().toISOString() }));

    if (path === "/fx/proxy") {
      const target = url.searchParams.get("url");
      if (!target) return cors(json({ error: "Missing url" }, 400));
      try {
        const body = await maybeBody(req);
        const headers = new Headers(req.headers);
        headers.delete("host"); headers.delete("origin"); headers.delete("referer");
        const r = await fetch(target, { method: req.method, headers, body: body?.raw });
        const h = new Headers(r.headers);
        h.set("content-type", r.headers.get("content-type") || "application/octet-stream");
        return cors(new Response(await r.arrayBuffer(), { status: r.status, headers: h }));
      } catch (e: any) {
        return cors(json({ error: String(e?.message || e) }, 500));
      }
    }

    if (path === "/fx/module") {
      const target = url.searchParams.get("url");
      if (!target) return cors(json({ error: "Missing url" }, 400));
      try {
        const r = await fetch(target);
        if (!r.ok) return cors(json({ error: `Upstream ${r.status}` }, r.status));
        const code = await r.text();
        return cors(new Response(code, { status: 200, headers: new Headers({ "content-type": "application/javascript; charset=utf-8" }) }));
      } catch (e: any) {
        return cors(json({ error: String(e?.message || e) }, 500));
      }
    }

    return cors(json({
      fx: "online",
      endpoints: { health: "/fx/health", proxy: "/fx/proxy?url=<encoded>", module: "/fx/module?url=<encoded>" }
    }));
  });

  console.log(`[FX] Deno server listening on http://localhost:${(globalThis as any).Deno.env.get("PORT") || 8787}`);
}

async function maybeBody(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) { const j = await req.json().catch(() => undefined); return { raw: JSON.stringify(j ?? {}) }; }
  if (ct.includes("text/")) { const t = await req.text(); return { raw: t }; }
  if (ct.includes("form")) {
    const form = await req.formData();
    const data = new URLSearchParams(); for (const [k, v] of (form as any).entries()) data.append(k, String(v));
    return { raw: data.toString() };
  }
  try { const b = await req.arrayBuffer(); return { raw: b }; } catch { return undefined; }
}
function json(obj: any, status = 200) { return new Response(JSON.stringify(obj), { status, headers: new Headers({ "content-type": "application/json; charset=utf-8" }) }); }
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("access-control-allow-headers", "Content-Type,Authorization,Accept");
  return new Response(res.body, { status: res.status, headers: h });
}

export default fx;

/**
 * Quick refs:
 *
 * // Leading-@ → sync module default
 * const User = $$("@/plugins/User.ts");
 * const u = new User("Charl", "Cronje");
 * 
 * // path@spec → attach
 * $$("app.user@/plugins/User.ts").options({ type: "user", instantiateDefault: { args: ["Charl","Cronje"] }, global: "$user" });
 * const u2 = $$("app.user").as("User");
 *
 * // API shortcuts
 * $$("data@/api/users").get({ headers: { accept: "application/json" }, global: "$users" });
 *
 * // CSS groups
 * const actives = $$("app.users").select('.user[active=true]').on('change', () => console.log('changed'));
 * const team = $$("teams.core").group([]).include('.user').exclude('.banned').add($$("people.alice")).addAfter($$("people.alice"), $$("people.bob"));
 */
```

## 2: Plugins

### `plugins\fx-fs-fuse.ts`

```ts
// plugins/fx-fs-fuse.ts
// Phase-1 FS bridge (no real FUSE yet). Exposes readFile/writeFile/readdir + view mapping.

import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";

export type ViewEntry = {
    filePath: string;     // e.g. "src/repo.js"
    viewId: string;       // e.g. "views.repoFile"
    lang?: "js" | "ts" | "py" | "php" | "sh" | "ini" | "jsx" | "tsx" | "go" | "cxx" | "text" | string;
    eol?: "lf" | "crlf";
    hoistImports?: boolean;
};

type FSMap = Map<string, ViewEntry>; // filePath -> entry

export interface FxFsApi {
    /** Register or update a view mapping */
    register(entry: ViewEntry): void;
    /** Remove a mapping */
    unregister(filePath: string): void;
    /** Resolve a filePath into a ViewEntry (or null) */
    resolve(filePath: string): ViewEntry | null;

    /** Read a file by path (renders the view) */
    readFile(filePath: string): string;
    /** Write a file by path (parses markers and applies patches) */
    writeFile(filePath: string, text: string): void;
    /** List “files” from the registry; Phase-1 returns registered paths under a pseudo-root */
    readdir(dirPath: string): string[];

    /** Subscribe to change events (SSE/WS can hook here) */
    on(evt: "fileChanged", cb: (p: string) => void): () => void;
}

export default function fxFsFuse(): FxFsApi {
    const views: FSMap = new Map();
    const listeners = new Set<(p: string) => void>();

    function emitChange(p: string) { for (const l of listeners) try { l(p); } catch { } }

    const api: FxFsApi = {
        register(entry) { views.set(normalize(entry.filePath), entry); },
        unregister(filePath) { views.delete(normalize(filePath)); },
        resolve(filePath) { return views.get(normalize(filePath)) ?? null; },

        readFile(filePath) {
            const entry = api.resolve(filePath);
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);
            const { viewId, lang = "js", eol = "lf", hoistImports = false } = entry;
            return renderView(viewId, { lang, eol, hoistImports });
        },

        writeFile(filePath, text) {
            const entry = api.resolve(filePath);
            if (!entry) throw new Error(`FXD: no view mapping for ${filePath}`);
            const patches = toPatches(text);
            applyPatches(patches);
            emitChange(normalize(filePath));
        },

        readdir(dirPath) {
            // Phase-1: present registered files under "/" and their folder parts.
            const dir = stripLeadingSlash(dirPath);
            const parts = new Set<string>();
            for (const p of views.keys()) {
                if (dir === "" || p.startsWith(dir + "/")) {
                    const rest = dir === "" ? p : p.slice(dir.length + 1);
                    const head = rest.split("/")[0];
                    if (head) parts.add(head);
                }
            }
            return Array.from(parts).sort();
        },

        on(evt, cb) {
            if (evt !== "fileChanged") return () => { };
            listeners.add(cb);
            return () => listeners.delete(cb);
        }
    };

    return api;
}

// helpers
function normalize(p: string) { return p.replace(/^\/+/, ""); }
function stripLeadingSlash(p: string) { return p.replace(/^\/+/, ""); }
```


### `plugins\fx-observatory.ts`

```ts
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
```

## 3: Modules

### `modules\fx-group-extras.ts`

```ts
export function groupList(viewPath: string) {
    const g = $$(viewPath).group();
    return g.list ? g.list() : (g.items ? g.items() : []); // adapt if your Group exposes a different name
}

export function groupMapStrings(viewPath: string, map: (it: any, idx: number) => string, sep = "\n\n") {
    const items = groupList(viewPath);
    const strs = items.map(map);
    return { concat: (s = sep) => strs.join(s) };
}
```


### `modules\fx-parse.ts`

```ts
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
```


### `modules\fx-snippets.ts`

```ts
// Phase-1 utilities: stable snippet creation, comment styles, wrappers, checksum, ID index.

type Lang = "js" | "ts" | "jsx" | "tsx" | "py" | "sh" | "ini" | "php" | "go" | "cxx" | "text" | string;

export type Marker = {
    id: string;
    lang?: string;
    file?: string;
    checksum?: string;
    order?: number;
    version?: number; // default 1
};

export const COMMENT: Record<string, { open?: string; close?: string; line?: string }> = {
    js: { open: "/*", close: "*/", line: "//" }, ts: { open: "/*", close: "*/", line: "//" },
    jsx: { open: "/*", close: "*/", line: "//" }, tsx: { open: "/*", close: "*/", line: "//" },
    py: { line: "#" }, sh: { line: "#" }, ini: { line: ";" }, php: { open: "/*", close: "*/", line: "//" },
    go: { open: "/*", close: "*/", line: "//" }, cxx: { open: "/*", close: "*/", line: "//" },
    text: { line: "//" }
};

// ——— ID index (id -> path) ———
const snippetIdx = new Map<string, string>();

export function indexSnippet(path: string, id?: string) {
    const usedId = id ?? $$(path).options()?.id;
    if (usedId) snippetIdx.set(usedId, path);
}
export function removeSnippetIndex(path: string) {
    const id = $$(path).options()?.id;
    if (id) snippetIdx.delete(id);
}
export function findBySnippetId(id: string) {
    const path = snippetIdx.get(id);
    return path ? { id, path } : null;
}

// Lifecycle hooks (call these from your FX core when options/path change)
export function onSnippetOptionsChanged(path: string, oldId?: string, newId?: string) {
    if (oldId && oldId !== newId) snippetIdx.delete(oldId);
    if (newId) snippetIdx.set(newId, path);
}
export function onSnippetMoved(oldPath: string, newPath: string) {
    const id = $$(newPath).options()?.id ?? $$(oldPath).options()?.id;
    if (!id) return;
    snippetIdx.set(id, newPath);
}

// ——— helpers ———
export function normalizeEol(s: string) { return s.replace(/\r\n/g, "\n"); }
export function chooseEol(eol: "lf" | "crlf" = "lf") { return eol === "crlf" ? "\r\n" : "\n"; }
export function simpleHash(s: string) { // fast, non-crypto
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
}

export function makeBegin(m: Marker) {
    const parts = [`id=${m.id}`];
    if (m.lang) parts.push(`lang=${m.lang}`);
    if (m.file) parts.push(`file=${m.file}`);
    if (m.checksum) parts.push(`checksum=${m.checksum}`);
    if (m.order !== undefined) parts.push(`order=${m.order}`);
    parts.push(`version=${m.version ?? 1}`);
    return `FX:BEGIN ${parts.join(" ")}`;
}
export function makeEnd(m: Marker) { return `FX:END id=${m.id}`; }

/** Emit BEGIN/BODY/END using block comments if available else single-line prefix. */
export function wrapSnippet(id: string, body: string, lang: Lang = "js", meta: Partial<Marker> = {}) {
    const c = COMMENT[lang] ?? COMMENT.js;
    const checksum = meta.checksum ?? simpleHash(normalizeEol(body));
    const begin = makeBegin({ id, lang, file: meta.file, checksum, order: meta.order, version: meta.version ?? 1 });
    const end = makeEnd({ id });

    if (c.open && c.close) {
        return `${c.open} ${begin} ${c.close}\n${body}\n${c.open} ${end} ${c.close}`;
    } else {
        const lp = c.line ?? "//";
        return `${lp} ${begin}\n${body}\n${lp} ${end}`;
    }
}

/** Stable snippet factory (sets id/lang/file/version and indexes it). */
export function createSnippet(
    path: string,
    body: string,
    opts: { lang?: Lang; file?: string; id?: string; order?: number; version?: number } = {}
) {
    const id = opts.id ?? path;
    $$(path)
        .val(body)
        .setType("snippet")
        .options({ lang: opts.lang ?? "js", file: opts.file ?? "", id, order: opts.order, version: opts.version ?? 1 });
    indexSnippet(path, id);
    return $$(path);
}
```


### `modules\fx-view.ts`

```ts
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
```

## 4: Server

### `server\dev.ts`

```ts
// server/dev.ts
// Dev bootstrap: load FX core, seed examples, map views to /fs/*, and start HTTP server.

import "../fx.ts"; // ensure $$ and core are loaded
import { seedRepoSnippets } from "../examples/repo-js/seed.ts";
import { startHttpServer } from "./http.ts";

// 1) seed graph
seedRepoSnippets();

// 2) start HTTP server with a simple resolver that maps /fs/src/<name> to views.<name>File
const { fsBridge } = startHttpServer({
  port: 4400,
  autoResolver: (filePath) => {
    // Example rule: "src/repo.js" -> "views.repoFile"
    // Feel free to swap with a table or a smarter resolver.
    const clean = filePath.replace(/^\/+/, "");
    if (clean === "src/repo.js") return { viewId: "views.repoFile", lang: "js" };
    return null;
  }
});

// 3) Explicit registration works too (keeps it clear)
fsBridge.register({
  filePath: "src/repo.js",
  viewId: "views.repoFile",
  lang: "js",
  hoistImports: true
});

console.log("[fxd] Open http://localhost:4400/fs/src/repo.js to see the composed file");
console.log("[fxd] Connect to SSE at  http://localhost:4400/events for live changes");
```


### `server\http.ts`

```ts
// server/http.ts
// Phase-1 HTTP + SSE server for FXD.
// Routes:
//   GET  /fs/<path>           -> render view as file
//   PUT  /fs/<path>           -> write file (parse markers, apply patches)
//   GET  /fs/ls/<dir?>        -> list pseudo-dir
//   GET  /events              -> Server-Sent Events stream (fileChanged, graphUpdated, ping)

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse } from "node:url";
import fxFsFuse, { FxFsApi } from "../plugins/fx-fs-fuse.ts";
import fxObservatory from "../plugins/fx-observatory.ts";

export interface HttpServerOpts {
    port?: number;
    /** Allow mapping path -> viewId without pre-registering each file */
    autoResolver?: (filePath: string) => { viewId: string, lang?: string } | null;
}

export function startHttpServer(opts: HttpServerOpts = {}) {
    const port = opts.port ?? 4400;
    const fsBridge: FxFsApi = fxFsFuse();
    const obs = fxObservatory();

    // pipe fs changes to SSE
    fsBridge.on("fileChanged", (p) => obs.emit({ type: "fileChanged", path: `/${p}` }));

    // SSE clients
    const clients = new Set<ServerResponse>();

    const server = createServer(async (req, res) => {
        const url = parse(req.url ?? "", true);
        const m = req.method ?? "GET";
        const path = decodeURIComponent(url.pathname ?? "/");

        // CORS/dev-friendly
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (m === "OPTIONS") { res.writeHead(204).end(); return; }

        // SSE
        if (m === "GET" && path === "/events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            });
            res.write(`event: ping\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
            clients.add(res);
            const unsub = obs.on((e) => {
                res.write(`data: ${JSON.stringify(e)}\n\n`);
            });
            req.on("close", () => { unsub(); clients.delete(res); });
            return;
        }

        // list
        if (m === "GET" && path.startsWith("/fs/ls")) {
            const dir = (path.replace(/^\/fs\/ls/, "") || "/").replace(/^\/+/, "");
            const list = fsBridge.readdir(dir);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ dir: "/" + dir, entries: list }));
            return;
        }

        // read
        if (m === "GET" && path.startsWith("/fs/")) {
            const filePath = path.replace(/^\/fs\//, "");
            ensureRegistered(fsBridge, opts.autoResolver, filePath);
            try {
                const text = fsBridge.readFile(filePath);
                res.writeHead(200, inferContentType(filePath));
                res.end(text);
            } catch (e: any) {
                res.writeHead(404).end(String(e?.message ?? "not found"));
            }
            return;
        }

        // write
        if (m === "PUT" && path.startsWith("/fs/")) {
            const filePath = path.replace(/^\/fs\//, "");
            ensureRegistered(fsBridge, opts.autoResolver, filePath);
            const body = await readBody(req);
            try {
                fsBridge.writeFile(filePath, body);
                res.writeHead(200).end("ok");
                obs.emit({ type: "fileChanged", path: "/" + filePath });
            } catch (e: any) {
                res.writeHead(400).end(String(e?.message ?? "bad request"));
            }
            return;
        }

        res.writeHead(404).end("not found");
    });

    // periodic pings
    const t = setInterval(() => {
        const evt = { type: "ping", at: Date.now() } as const;
        for (const c of clients) try { c.write(`data: ${JSON.stringify(evt)}\n\n`); } catch { }
    }, 15000);

    server.listen(port);
    console.log(`[fxd] HTTP listening on http://localhost:${port}`);

    return { server, fsBridge, obs, stop: () => { clearInterval(t); server.close(); } };
}

// --- helpers ---
function inferContentType(p: string) {
    if (p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".ts")) return { "Content-Type": "text/javascript; charset=utf-8" };
    if (p.endsWith(".json")) return { "Content-Type": "application/json; charset=utf-8" };
    if (p.endsWith(".css")) return { "Content-Type": "text/css; charset=utf-8" };
    if (p.endsWith(".html")) return { "Content-Type": "text/html; charset=utf-8" };
    return { "Content-Type": "text/plain; charset=utf-8" };
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const bufs: Buffer[] = [];
        req.on("data", (c) => bufs.push(Buffer.from(c)));
        req.on("end", () => resolve(Buffer.concat(bufs).toString("utf8")));
        req.on("error", reject);
    });
}

function ensureRegistered(fsBridge: FxFsApi, auto?: HttpServerOpts["autoResolver"], filePath?: string) {
    if (!filePath) return;
    if (fsBridge.resolve(filePath)) return;
    if (!auto) return;
    const meta = auto(filePath);
    if (meta) fsBridge.register({ filePath, viewId: meta.viewId, lang: meta.lang });
}
```

## 5: Examples

### `examples\repo-js\demo.ts`

```ts
// examples/repo-js/demo.ts
//
// Demonstrates: render -> parse -> applyPatches -> render again.

import { renderView } from "../../modules/fx-view.ts";
import { toPatches, applyPatches } from "../../modules/fx-parse.ts";
import { seedRepoSnippets } from "./seed.ts";

// 1) Seed some snippets + view
seedRepoSnippets();

// 2) Render the view as a file
const text1 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- Initial Render ---\n");
console.log(text1);

// 3) Simulate editor change
const textEdited = text1.replace("findUser", "findUserById");

// 4) Parse edits into patches
const patches = toPatches(textEdited);
console.log("\n--- Patches ---\n");
console.log(JSON.stringify(patches, null, 2));

// 5) Apply patches back into FX graph
applyPatches(patches);

// 6) Render again → should reflect the change
const text2 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- After Apply ---\n");
console.log(text2);
```


### `examples\repo-js\seed.ts`

```ts
// examples/repo-js/seed.ts
//
// Seed a couple of snippets + a view node for Phase-1 demo.
// Run once at startup to populate the FX graph.

import { createSnippet } from "../../modules/fx-snippets.ts";

export function seedRepoSnippets() {
    // header import snippet
    createSnippet(
        "snippets.repo.header",
        `import { db } from './db.js'`,
        { lang: "js", file: "src/repo.js", order: 0 }
    );

    // find function snippet
    createSnippet(
        "snippets.repo.find",
        `export async function findUser(id){ return db.users.find(u => u.id===id) }`,
        { lang: "js", file: "src/repo.js", order: 1 }
    );

    // define a view (file) as a group of these snippets
    $$("views.repoFile")
        .group([
            "snippets.repo.header",
            "snippets.repo.find",
        ])
        .include(`.snippet[file="src/repo.js"][lang="js"]`)
        .options({ reactive: true, mode: "set" });

    console.log("[seed] repo snippets created");
}
```

## 6: Docs

### `docs\FXD-PHASE-1-Demo.md`

```md
## 📁 `examples/repo-js/seed.ts`

```ts
// examples/repo-js/seed.ts
//
// Seed a couple of snippets + a view node for Phase-1 demo.
// Run once at startup to populate the FX graph.

import { createSnippet } from "../../modules/fx-snippets.ts";

export function seedRepoSnippets() {
  // header import snippet
  createSnippet(
    "snippets.repo.header",
    `import { db } from './db.js'`,
    { lang: "js", file: "src/repo.js", order: 0 }
  );

  // find function snippet
  createSnippet(
    "snippets.repo.find",
    `export async function findUser(id){ return db.users.find(u => u.id===id) }`,
    { lang: "js", file: "src/repo.js", order: 1 }
  );

  // define a view (file) as a group of these snippets
  $$("views.repoFile")
    .group([
      "snippets.repo.header",
      "snippets.repo.find",
    ])
    .include(`.snippet[file="src/repo.js"][lang="js"]`)
    .options({ reactive: true, mode: "set" });

  console.log("[seed] repo snippets created");
}
```

---

## 📁 `examples/repo-js/demo.ts`

```ts
// examples/repo-js/demo.ts
//
// Demonstrates: render -> parse -> applyPatches -> render again.

import { renderView } from "../../modules/fx-view.ts";
import { toPatches, applyPatches } from "../../modules/fx-parse.ts";
import { seedRepoSnippets } from "./seed.ts";

// 1) Seed some snippets + view
seedRepoSnippets();

// 2) Render the view as a file
const text1 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- Initial Render ---\n");
console.log(text1);

// 3) Simulate editor change
const textEdited = text1.replace("findUser", "findUserById");

// 4) Parse edits into patches
const patches = toPatches(textEdited);
console.log("\n--- Patches ---\n");
console.log(JSON.stringify(patches, null, 2));

// 5) Apply patches back into FX graph
applyPatches(patches);

// 6) Render again → should reflect the change
const text2 = renderView("views.repoFile", { lang: "js", hoistImports: true });
console.log("\n--- After Apply ---\n");
console.log(text2);
```

---

## How to run (Phase-1)

```bash
# from project root
deno run -A examples/repo-js/demo.ts
# or node --loader ts-node/esm examples/repo-js/demo.ts
```

Expected output flow:

```
[seed] repo snippets created

--- Initial Render ---
/* FX:BEGIN id=snippets.repo.header lang=js file=src/repo.js checksum=... order=0 version=1 */
import { db } from './db.js'
/* FX:END id=snippets.repo.header */

/* FX:BEGIN id=snippets.repo.find lang=js file=src/repo.js checksum=... order=1 version=1 */
export async function findUser(id){ return db.users.find(u => u.id===id) }
/* FX:END id=snippets.repo.find */

--- Patches ---
[
  {
    "id":"snippets.repo.find",
    "value":"export async function findUserById(id){ return db.users.find(u => u.id===id) }",
    "checksum":"..."
  }
]

--- After Apply ---
/* ... header snippet ... */

 /* ... updated findUserById snippet ... */
```
```


### `docs\FXD-PHASE-1.md`

```md
# FXD-PHASE-1.md

## 0) Vision

**FX Disk (FXD)** is a RAM-backed virtual filesystem whose “files” are **views over FX nodes**. Code/content lives as **snippets** (nodes with stable IDs). Files are **Groups** of snippets rendered with **language-agnostic markers** so they can be safely round-tripped by any editor.

**Phase-1 goals**

* No ASTs • Language-agnostic • Sync only
* Round-trip safe (file → snippets → file)
* Reactive (groups update, views re-render)
* Deterministic snippet IDs + index
* Ready to wire to a FUSE/Dokan plugin

---

## 1) Building Blocks

### 1.1 Snippets

* Node with `__type="snippet"` and options `{ id, lang, file, order, version }`.
* Created via `createSnippet(path, body, opts)`.
* Stable **id** is the primary identity (path can change).

### 1.2 Groups → Files/Views

* A **Group** of snippet nodes (manual + selector).
* Order: group order → `order` hint → array index.
* Render by concatenation with markers; parse by splitting markers.

### 1.3 Markers (strict)

```
FX:BEGIN id=<ID> [lang=<LANG>] [file=<FILE>] [checksum=<HEX>] [order=<INT>] [version=<INT>]
FX:END id=<ID>
```

Wrapped in appropriate comment style:

* JS/TS: `/* … */` or `// …`
* Py/Sh: `# …`
* INI: `; …`
* etc.

`checksum` (optional) detects divergence; `version` reserves format evolution.

---

## 2) Rendering

`renderView(viewPath, { lang='js', sep='\n\n', eol='lf', hoistImports=false })`

Steps:

1. Get group items (id/lang/file/order/body).
2. Sort; wrap each body with `wrapSnippet(id, body, lang, meta)`.
3. Join with `sep`.
4. Optional **JS/TS single-line import hoist** (guard-railed).
5. Apply EOL policy (lf/crlf).

---

## 3) Parsing

`toPatches(text)`:

* Stream by lines; only treat a line as metadata if it **starts** with a comment token and contains `FX:(BEGIN|END)`.
* Collect bodies between matching `BEGIN`/`END` (ids must match).
* Emit patches `{ id, value, checksum?, version? }`.

`applyPatches(patches, { onMissing='create', orphanRoot='snippets.orphans' })`:

* Find snippet by **id** via index; update `.val()`.
* If missing and allowed, **create** an orphan snippet with that id.

---

## 4) ID Index & Lifecycle

In-memory map `id → path`:

* Update on **create**, **options change** (id change), **path move**.
* Ensures refactors don’t break identity.

---

## 5) Filesystem Plugin (Phase-1 loop)

`fx-fs-fuse` (later today/next):

* `readFile(path)` → map to a **view node** → `renderView()`.
* `writeFile(path, text)` → `toPatches(text)` → `applyPatches()`.
* `readdir(path)` → list known views/dirs from FX graph.

---

## 6) Nice-to-have (optional in Phase-1)

* `order` hints in markers for in-file reordering.
* Import hoist for JS/TS (single-line only; markers untouched).
* `group.map`/`group.concatWithMarkers` sugar.

---

## 7) Out of Scope (Phase-1)

* AST transforms, symbol dedupe, conflict UI, multi-user sync, history.

---

## 8) Quickstart (end-to-end)

```ts
import { createSnippet } from "/modules/fx-snippets.ts";
import { renderView } from "/modules/fx-view.ts";
import { toPatches, applyPatches } from "/modules/fx-parse.ts";

// define snippets
createSnippet("snippets.repo.header", `import { db } from './db.js'`, { lang:"js", file:"src/repo.js" });
createSnippet("snippets.repo.find",   `export const findUser = id => db.users.find(id)`, { lang:"js", file:"src/repo.js" });

// define file as a group
$$("views.repoFile").group(["snippets.repo.header","snippets.repo.find"])
  .include(`.snippet[file="src/repo.js"][lang="js"]`)
  .options({ reactive:true, mode:"set" });

// render to text (for HTTP/FUSE read)
const text = renderView("views.repoFile", { lang:"js", hoistImports:true });

// parse on write (from editor)
const patches = toPatches(textFromEditor);
applyPatches(patches);
```

---

## 9) Roadmap (Phase-2+)

* Graph Viz (Pixi/Three), drag-reorder, live highlights
* Drivers for langs (optional analyzers/formatters)
* Snapshot/export, OverlayFS sandbox, record/replay
* Encrypted snippets, remote compilation, plugin marketplace

---

---

## 📁 Project Structure (Phase-1)

```
fx/
├─ fx.ts                      # FX core (your existing file)
├─ fx.config.json             # optional: plugin autoload config
├─ modules/
│  ├─ fx-snippets.ts          # IDs, fences, checksum, index + lifecycle hooks
│  ├─ fx-view.ts              # render with markers + EOL policy + import hoist
│  ├─ fx-parse.ts             # parser → patches, apply patches
│  ├─ fx-group-extras.ts      # (optional) group list/map polyfill
│  └─ drivers/
│     └─ js-esm.ts            # (phase-2) analyzer stub for imports (optional)
├─ plugins/
│  ├─ fx-fs-fuse.ts           # (phase-1 wire-up) FS bridge: read/write/readdir using modules/*
│  └─ fx-observatory.ts       # (phase-2) graph viz plugin (Pixi/Three)
├─ server/
│  ├─ http.ts                 # tiny HTTP/WS server: serve /fs/* + HMR (if you want browser preview)
│  └─ dev.ts                  # bootstrap: load fx.ts, register plugins, start services
├─ views/
│  └─ README.md               # doc: define how to declare view Group nodes
├─ snippets/
│  └─ README.md               # doc: snippet conventions & tagging
├─ specs/
│  ├─ FXD-PHASE-1.md          # ← this spec file
│  └─ ROADMAP.md              # (optional) phases 2-5 overview
└─ examples/
   └─ repo-js/
      ├─ seed.ts              # creates example snippets + view node
      └─ demo.ts              # renders, simulates write→parse→apply
```

### File purposes (quick notes)

* `fx.ts` — your core runtime; ensure it calls the **lifecycle hooks** from `fx-snippets.ts` when a snippet’s `options.id` changes or a snippet node moves.
* `modules/fx-snippets.ts` — snippet creation, marker emit helpers, checksum, **id index + hooks**.
* `modules/fx-view.ts` — `renderView` (wrap → concat → eol) + `hoistImportsOnce`.
* `modules/fx-parse.ts` — `toPatches` (strict marker parse) + `applyPatches`.
* `modules/fx-group-extras.ts` — small shims if your Group API doesn’t have `list`/`map`.
* `plugins/fx-fs-fuse.ts` — adapter that maps OS FS calls to `renderView`/`applyPatches`.
* `server/http.ts` — dev-server to serve `/fs/*` (optional, nice for browser HMR).
* `server/dev.ts` — starts FX, loads plugins, seeds examples.

---

## Minimal wiring (dev.ts)

```ts
// server/dev.ts
import "./../fx.ts";
import { renderView } from "../modules/fx-view.ts";
import { toPatches, applyPatches } from "../modules/fx-parse.ts";

// optional: tiny HTTP handler
import { createServer } from "node:http";

createServer(async (req, res) => {
  if (req.url?.startsWith("/fs/")) {
    // map url to a view node id, e.g., "/fs/src/repo.js" -> "views.repoFile"
    const viewId = mapPathToViewId(req.url);
    const text = renderView(viewId, { lang:"js", hoistImports:true });
    res.writeHead(200, { "content-type":"text/javascript; charset=utf-8" });
    res.end(text);
    return;
  }
  res.writeHead(404).end("not found");
}).listen(4400);
```

(Your FUSE/Dokan plugin will call the same `renderView`/`applyPatches` functions.)
```


### `docs\design.md`

```md
# 📄 FX Disk – Phase-1 Design Document

## 0) Vision

FX Disk (**FXD**) is a **RAM-backed virtual filesystem** that maps directly onto FX Nodes. Every snippet of code or data lives in the FX graph. Files and folders in the FS are not stored on disk but are *views* over groups of nodes.

**Core properties:**

* **Language agnostic** (snippets are just strings, wrapped with markers).
* **Reactive** (groups update, views re-render).
* **Round-trip safe** (file → snippets → file with byte preservation).
* **Deterministic IDs** (every snippet stable across moves).
* **FUSE/Dokan ready** (OS can mount FXD as a “real” disk).

---

## 1) Building Blocks

### 1.1 Snippets

* Unit of code/data.
* Stored as FX nodes with:

  * `__type = "snippet"`
  * Options: `{ id, lang, file, order, version }`
* Created with `createSnippet(path, body, opts)`.

### 1.2 Groups

* Ordered, reactive collections of snippets.
* Represent files or higher-level “views”.
* Control membership via `.include()`, `.exclude()`, `.group([...])`.

### 1.3 Views

* A group *plus* a renderer.
* Render = join snippets with **markers** delimiting them.
* Parse = split file back into snippets and patch the graph.

---

## 2) Markers

**Strict grammar (always one line each):**

```
FX:BEGIN id=<ID> [lang=<LANG>] [file=<FILE>] [checksum=<HEX>] [order=<INT>] [version=<INT>]
FX:END id=<ID>
```

* Wrapped in comment style for each language:

  * JS/TS: `/* FX:BEGIN … */`
  * Py/Sh: `# FX:BEGIN …`
  * etc.
* Guarantees round-trip across any editor.
* `checksum` optional: detect divergence.
* `order` optional: sort control in file.
* `version`: reserved, default = 1.

---

## 3) Index & Lifecycle

* `id → path` mapping kept in memory.
* Updated on snippet create, options change, or path move.
* Ensures stable identity even if paths change.

---

## 4) Rendering

* `renderView(viewPath, opts)`:

  * Look up group items.
  * Sort by group order → `order` → index.
  * Wrap each snippet body with markers.
  * Join with separator (`\n\n` default).
  * Normalize EOL (`lf` or `crlf`).
  * Optionally hoist imports (JS/TS only, single-line safe).

---

## 5) Parsing

* `toPatches(text)`:

  * Stream by line.
  * Detect `BEGIN/END` markers (strip fences only when line starts with comment + has `FX:`).
  * Collect body faithfully.
  * Emit patches `{ id, value, checksum, version }`.

* `applyPatches(patches, opts)`:

  * Find snippet by ID via index.
  * Update node value.
  * If missing, create orphan snippet under `snippets.orphans.*`.

---

## 6) Filesystem Integration (MVP)

**Plugin `fx-fs-fuse`:**

* `readFile(path)` → map FS path to view → `renderView()`.
* `writeFile(path, text)` → `toPatches(text)` → `applyPatches()`.
* `readdir(path)` → list groups/files defined in FX.

---

## 7) Phase-1 Scope

* ✅ Snippets w/ IDs, fences, checksums.
* ✅ Groups/views.
* ✅ Render + parse.
* ✅ Apply patches w/ orphan handling.
* ✅ Import hoist (JS/TS).
* ✅ Index lifecycle hooks.

**Out of scope for Phase-1:**

* AST parsing.
* Merge conflict UI.
* Version history.
* Multi-user sync.

---

# 📄 FX Disk – Roadmap (Phase-2+)

## Phase-2: Developer Quality of Life

* **Graph visualizer** (D3/Three.js/pixi.js plugin).
* **File diffing**: highlight checksum divergence.
* **Order control in UI**: drag snippets in graph to reorder.
* **Multi-lang drivers**: attach parsers for Python, Go, etc.
* **Inline view editors**: edit snippet directly in graph view.

## Phase-3: Collaboration & Sandboxing

* **Snapshots/checkpoints**: export/import FX graphs.
* **OverlayFS integration**: mount full dev env on FXD, rollback at will.
* **Sandbox playback**: run code against recorded I/O (APIs, DB).
* **Shared baselines**: give juniors “recorded” runtime without prod access.

## Phase-4: Open Dev Ecosystem

* **Encrypted snippets**: compiler can read, human cannot.
* **Remote compilation**: code compiled off-site, only bytecode/tokens returned.
* **Plugin marketplace**: drivers, parsers, viz add-ons.

## Phase-5: Vision

FX Disk becomes the **default dev environment layer**:

* Filesystems are views over live graphs.
* Every snippet is reactive + inspectable.
* Debugging is sandboxed + replayable.
* Open source projects can be extended without leaking protected source.

---

# 🌟 Vision Statement

FX Disk is not just a dev tool—it’s a **new substrate for programming**:

* **Files become views, not the source of truth.**
* **Code is live and reactive.**
* **Development is sandboxed by default.**
* **Collaboration is safe—even with closed source.**
* **Graphs replace folders as the way to *see* your code.**

Phase-1 gets you there with a minimal, working core: snippets, groups, views, render/parse. Everything else builds on this bedrock.
```
