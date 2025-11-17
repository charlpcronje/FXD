var FX = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // fxn.ts
  var fxn_exports = {};
  __export(fxn_exports, {
    $$: () => $$,
    $_$$: () => $_$$,
    $get: () => $get,
    $has: () => $has,
    $root: () => $root,
    $set: () => $set,
    $val: () => $val,
    FXCore: () => FXCore,
    default: () => fxn_default,
    fx: () => fx
  });
  var import_meta = {};
  var HAS_DENO = typeof globalThis.Deno !== "undefined";
  var IS_SERVER = HAS_DENO;
  var nowId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  var isHttp = (u) => /^https?:\/\//i.test(u);
  var isRel = (u) => u.startsWith("/") && !u.startsWith("//");
  var toNumIfStr = (v) => typeof v === "string" && v.trim() !== "" && isFinite(v) ? parseFloat(v) : v;
  var safeJson = (v) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  var prop = (o, k, v, enumerable = false) => Object.defineProperty(o, k, { value: v, configurable: true, writable: false, enumerable });
  function isUIThread() {
    return typeof window !== "undefined" && !(typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope);
  }
  async function uiFriendlyWait(i32, idx, expected, timeout = Infinity) {
    const anyAtomics = Atomics;
    if (typeof anyAtomics.waitAsync === "function") {
      const res = anyAtomics.waitAsync(i32, idx, expected, timeout);
      if (res?.async === false) return res.value;
      return await res.value;
    }
    const start = performance.now();
    while (true) {
      if (Atomics.load(i32, idx) !== expected) return "ok";
      if (timeout !== Infinity && performance.now() - start >= timeout) return "timed-out";
      await new Promise(requestAnimationFrame);
    }
  }
  var FXSuspend = class extends Error {
    promise;
    tag = "FX:SUSPEND";
    constructor(p) {
      super("FX:SUSPEND");
      this.promise = p;
    }
  };
  function isSuspend(e) {
    return !!e && typeof e === "object" && e.tag === "FX:SUSPEND";
  }
  function schedule(fn) {
    requestAnimationFrame(() => Promise.resolve().then(fn));
  }
  function invokeWithSuspendReplay(fn, thisArg, args) {
    const run = () => {
      try {
        return fn.apply(thisArg, args);
      } catch (e) {
        if (isSuspend(e)) {
          e.promise.then(() => schedule(run), () => schedule(run));
          return void 0;
        }
        throw e;
      }
    };
    return run();
  }
  globalThis.FXSuspend = FXSuspend;
  var SyncModuleLoader = class {
    worker = null;
    sab = null;
    lock = null;
    len = null;
    buf = null;
    cache = /* @__PURE__ */ new Map();
    TIMEOUT_MS = 15e3;
    constructor() {
      if (typeof SharedArrayBuffer !== "undefined" && typeof globalThis.Deno === "undefined") this.initWorker();
    }
    initWorker() {
      this.sab = new SharedArrayBuffer(2 * 1024 * 1024);
      this.lock = new Int32Array(this.sab, 0, 1);
      this.len = new Int32Array(this.sab, 4, 1);
      this.buf = new Uint8Array(this.sab, 8);
      const code = `
        const te = new TextEncoder();
        self.onmessage = async (e) => {
          const { id, url, sab } = e.data || {};
          const lock = new Int32Array(sab, 0, 1);
          const len  = new Int32Array(sab, 4, 1);
          const buf  = new Uint8Array(sab, 8);
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const txt = await res.text();
            const enc = te.encode(txt);
            if (enc.length > buf.length) { Atomics.store(lock, 0, -id); Atomics.notify(lock, 0, 1); return; }
            buf.set(enc); len[0] = enc.length; Atomics.store(lock, 0, id);
          } catch(_e) { Atomics.store(lock, 0, -id); }
          Atomics.notify(lock, 0, 1);
        };
      `;
      if (typeof globalThis.Deno !== "undefined") {
        const dataUrl = `data:application/javascript,${encodeURIComponent(code)}`;
        this.worker = new Worker(dataUrl, { type: "module" });
      } else {
        this.worker = new Worker(URL.createObjectURL(new Blob([code], { type: "application/javascript" })));
      }
    }
    async fetchIntoCache(url, timeoutMs = this.TIMEOUT_MS) {
      if (!this.worker || !this.sab || !this.lock || !this.len || !this.buf) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`[FX] HTTP ${res.status} for ${url}`);
        const text2 = await res.text();
        this.cache.set(url, text2);
        return text2;
      }
      const id = Math.floor(Math.random() * 1e9);
      Atomics.store(this.lock, 0, 0);
      this.worker.postMessage({ id, url, sab: this.sab });
      if (isUIThread()) {
        const st = await uiFriendlyWait(this.lock, 0, 0, timeoutMs);
        if (st !== "ok") throw new Error("[FX] Module load timeout " + url);
      } else {
        const r = Atomics.wait(this.lock, 0, 0, timeoutMs);
        if (r === "timed-out") throw new Error("[FX] Module load timeout " + url);
      }
      const signal = Atomics.load(this.lock, 0);
      if (signal !== id) throw new Error("[FX] Worker error or buffer too small for " + url);
      const n = this.len[0];
      const text = new TextDecoder().decode(this.buf.subarray(0, n));
      Atomics.store(this.lock, 0, 0);
      this.cache.set(url, text);
      return text;
    }
    async loadAsync(url, timeoutMs = this.TIMEOUT_MS) {
      if (this.cache.has(url)) return this.cache.get(url);
      return await this.fetchIntoCache(url, timeoutMs);
    }
    // UI: never block — start fetch and SUSPEND; Proxy will replay. Worker/Node: safe blocking.
    loadSync(url) {
      if (this.cache.has(url)) return this.cache.get(url);
      if (isUIThread()) {
        const p = this.fetchIntoCache(url).catch(() => {
        });
        throw new globalThis.FXSuspend(p);
      }
      let got = "";
      (async () => {
        got = await this.fetchIntoCache(url);
      })();
      if (this.cache.has(url)) return this.cache.get(url);
      throw new Error("[FX] worker loadSync unexpected fallthrough");
    }
  };
  var PluginManager = class {
    fx;
    loaded = /* @__PURE__ */ new Map();
    prefix = /* @__PURE__ */ new Map();
    constructor(fx2) {
      this.fx = fx2;
    }
    register(name, factoryOrObj, opts) {
      if (this.loaded.has(name)) return this.fx.proxy(opts?.prefix ? `${opts.prefix}.${name}` : `plugins.${name}`);
      const instance = typeof factoryOrObj === "function" ? factoryOrObj(this.fx) : factoryOrObj;
      const mount = opts?.prefix ? `${opts.prefix}.${name}` : `plugins.${name}`;
      const node = this.fx.proxy(mount);
      node.val(instance);
      if (instance && typeof instance === "object") this.fx.graftObject(node.node(), instance);
      this.loaded.set(name, instance);
      if (opts?.global) globalThis[opts.global] = node;
      if (opts?.prefix) this.prefix.set(opts.prefix, node);
      return node;
    }
    getByPrefix(prefix) {
      return this.prefix.get(prefix);
    }
  };
  var FXCore = class {
    root;
    pluginManager;
    moduleLoader;
    // parent map for O(1) ancestry checks
    __parentMap = /* @__PURE__ */ new Map();
    // structure event bus (batched)
    __structureListeners = /* @__PURE__ */ new Set();
    __batchTimer = null;
    __batchedEvents = [];
    constructor() {
      this.root = this.createNode(null);
      this.moduleLoader = new SyncModuleLoader();
      this.pluginManager = new PluginManager(this);
      this.ensureSystemRoots();
      this.installDefaults();
    }
    ensureSystemRoots() {
      const mk = (n) => {
        if (!this.root.__nodes[n]) {
          const c = this.createNode(this.root.__id);
          this.root.__nodes[n] = c;
          this.__parentMap.set(c.__id, this.root);
        }
      };
      ["app", "config", "plugins", "modules", "atomics", "dom", "session", "system", "cache", "code", "views", "fs", "history"].forEach(mk);
    }
    installDefaults() {
      const configNode = this.setPath("config.fx", {}, this.root);
      this.set(configNode, {
        selectors: {
          // attribute resolution order
          attrResolution: ["meta", "type", "raw", "child"],
          // allowed attribute operators
          enabledAttrOps: ["=", "!=", "^=", "$=", "*="],
          // enable :has()
          enableHas: false,
          // .class matches both __type and __proto
          classMatchesType: true
        },
        groups: {
          reactiveDefault: true,
          debounceMs: 20
        },
        performance: {
          enableParentMap: true,
          structureBatchMs: 5
        }
      });
    }
    onStructure(cb) {
      this.__structureListeners.add(cb);
      return () => this.__structureListeners.delete(cb);
    }
    emitStructure(e) {
      const ms = fxCfg("performance.structureBatchMs", 5);
      this.__batchedEvents.push(e);
      if (ms <= 0) return this.__flushStructure();
      if (this.__batchTimer) return;
      this.__batchTimer = setTimeout(() => this.__flushStructure(), ms);
    }
    __flushStructure() {
      const list = this.__batchedEvents.splice(0);
      clearTimeout(this.__batchTimer);
      this.__batchTimer = null;
      for (const ev of list) for (const cb of Array.from(this.__structureListeners)) {
        try {
          cb(ev);
        } catch {
        }
      }
    }
    createNode(parentId) {
      return {
        __id: nowId(),
        __parent_id: parentId,
        __nodes: /* @__PURE__ */ Object.create(null),
        __value: void 0,
        __type: "raw",
        __proto: [],
        __behaviors: /* @__PURE__ */ new Map(),
        __instances: /* @__PURE__ */ new Map(),
        __effects: [],
        __watchers: /* @__PURE__ */ new Set()
      };
    }
    graftObject(host, obj) {
      for (const k of Object.keys(obj)) this.setPath(k, obj[k], host);
    }
    _finishSet(node, old) {
      this.triggerEffects(node, "after.set", "__value", node.__value);
      node.__watchers.forEach((cb) => {
        try {
          cb(node.__value, old);
        } catch (e) {
          console.error(e);
        }
      });
      this.emitStructure({ kind: "mutate", node });
    }
    set(node, value) {
      const old = node.__value;
      this.triggerEffects(node, "before.set", "__value", value);
      if (value && typeof value === "object") {
        const maybe = value.node?.() ?? value;
        if (maybe?.__id && maybe.__nodes) {
          node.__type = "FXNode";
          node.__value = { raw: maybe, FXNode: maybe, stringified: `[FXNode ${maybe.__id}]`, boolean: true };
          return this._finishSet(node, old);
        }
      }
      if (value && typeof value === "object" && value.constructor?.name !== "Object") {
        const cname = value.constructor?.name ?? "Instance";
        node.__type = cname;
        node.__value = { [cname]: value, raw: value, stringified: safeJson(value) };
        node.__instances.set(cname, value);
        return this._finishSet(node, old);
      }
      if (value && typeof value === "object" && value.constructor?.name === "Object") {
        node.__type = "object";
        node.__value = value;
        this.graftObject(node, value);
        return this._finishSet(node, old);
      }
      const bag = { raw: value, parsed: toNumIfStr(value), stringified: String(value), boolean: Boolean(value) };
      node.__type = typeof bag.parsed === "number" && !Number.isNaN(bag.parsed) ? "parsed" : "raw";
      node.__value = bag;
      return this._finishSet(node, old);
    }
    val(node) {
      if (!node) {
        console.error("[FX] val() called with undefined/null node");
        console.trace();
        return void 0;
      }
      const v = node.__value;
      if (v == null) return v;
      if (typeof v === "object" && "raw" in v) {
        const t = node.__type;
        if (t && v[t] !== void 0) return v[t];
        return v.raw;
      }
      return v;
    }
    resolvePath(path, start) {
      const keys = path.split(".").filter(Boolean);
      let cur = start;
      for (const k of keys) {
        if (!cur) return;
        const v = this.val(cur);
        if (v?.__id) cur = v;
        if (!cur?.__nodes[k]) return;
        cur = cur.__nodes[k];
      }
      return cur;
    }
    setPath(path, value, start) {
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
      if (value !== void 0) this.set(cur, value);
      return cur;
    }
    findParentFast(n) {
      if (!fxCfg("performance.enableParentMap", true)) return null;
      return this.__parentMap.get(n.__id) || null;
    }
    triggerEffects(node, event, key, value) {
      const proxy = this.createNodeProxy(node);
      for (const eff of node.__effects) {
        try {
          eff(event, proxy, key, value);
        } catch (e) {
          console.error(e);
        }
      }
    }
    createNodeProxy(node) {
      const self2 = this;
      const isOpts = (x) => x && typeof x === "object" && !Array.isArray(x);
      const isProxy = (v) => v && typeof v === "function" && typeof v.node === "function";
      const isEmpty = (v, opts) => {
        const rules = opts?.emptyAs ?? ["undefined", "null"];
        for (const r of rules) {
          if (r === "undefined" && v === void 0) return true;
          if (r === "null" && v === null) return true;
          if (r === "NaN" && typeof v === "number" && Number.isNaN(v)) return true;
          if (r === "" && v === "") return true;
          if (r === 0 && v === 0) return true;
          if (r === false && v === false) return true;
        }
        return false;
      };
      const cast = (v, opts) => {
        const c = opts?.cast;
        if (!c) return v;
        if (typeof c === "function") return c(v);
        switch (c) {
          case "number":
            return typeof v === "number" ? v : v === "" || v == null ? NaN : Number(v);
          case "string":
            return String(v);
          case "boolean":
            return Boolean(v);
          case "json":
            try {
              return typeof v === "string" ? JSON.parse(v) : v;
            } catch {
              return v;
            }
          default:
            return v;
        }
      };
      const ensureChild = (p, k, create) => {
        let c = p.__nodes[k];
        if (!c && create) c = self2.setPath(k, void 0, p);
        return c;
      };
      const baseFn = (path, value) => {
        let target = self2.resolvePath(path, node);
        if (!target) target = self2.setPath(path, void 0, node);
        const proxy2 = self2.createNodeProxy(target);
        if (value !== void 0) proxy2.val(value);
        return proxy2;
      };
      const builtViews = { str: "stringified", num: "parsed", bool: "boolean", raw: "raw" };
      const proxy = new Proxy(baseFn, {
        apply(_t, _thisArg, args) {
          return baseFn(args[0], args[1]);
        },
        get(_t, key, receiver) {
          if (key === "val") {
            return function(a, b) {
              const setter = !(a && isOpts(a));
              if (setter && arguments.length >= 1) {
                const value = a, opts2 = b && isOpts(b) ? b : void 0;
                if (isProxy(value)) {
                  const prev = node.__linkFrom;
                  if (prev) try {
                    prev.unwatch();
                  } catch {
                  }
                  const fromNode = value.node();
                  const unwatch = value.watch((_nv) => {
                    self2.set(node, self2.val(fromNode));
                  });
                  node.__linkFrom = { unwatch };
                  self2.set(node, self2.val(fromNode));
                  return receiver;
                }
                const toSet = isEmpty(value, opts2) ? opts2?.default : value;
                self2.set(node, cast(toSet, opts2));
                return receiver;
              }
              const opts = a && isOpts(a) ? a : void 0;
              let v = self2.val(node);
              if (isEmpty(v, opts)) v = opts?.default;
              return cast(v, opts);
            };
          }
          if (key === "set") {
            return (value, b, c) => {
              let child;
              let opts;
              if (typeof b === "string") {
                child = b;
                opts = isOpts(c) ? c : void 0;
              } else {
                opts = isOpts(b) ? b : void 0;
              }
              if (opts?.child && !child) child = opts.child;
              if (isProxy(value)) {
                const prev = node.__linkFrom;
                if (prev) try {
                  prev.unwatch();
                } catch {
                }
                const fromNode = value.node();
                const unwatch = value.watch((_nv) => self2.set(node, self2.val(fromNode)));
                node.__linkFrom = { unwatch };
                self2.set(node, self2.val(fromNode));
                return receiver;
              }
              const toSet = isEmpty(value, opts) ? opts?.default : value;
              const cv = cast(toSet, opts);
              if (child) {
                const create = opts?.createIfMissing ?? true;
                const cnode = ensureChild(node, child, create);
                if (cnode) self2.set(cnode, cv);
                return receiver;
              }
              self2.set(node, cv);
              return receiver;
            };
          }
          if (key === "inherit") {
            return (...behaviors) => {
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
            return (a, b, c) => {
              let def = void 0, child, opts;
              if (typeof a === "string" && !isOpts(b)) {
                child = a;
                def = b;
                opts = isOpts(c) ? c : void 0;
              } else {
                def = a;
                if (typeof b === "string") child = b;
                opts = isOpts(b) ? b : isOpts(c) ? c : void 0;
              }
              if (opts && opts.default !== void 0 && def === void 0) def = opts.default;
              if (child) {
                const create = opts?.createIfMissing ?? true;
                const cnode = ensureChild(node, child, create);
                if (!cnode) return void 0;
                return self2.createNodeProxy(cnode);
              }
              let v = self2.val(node);
              if (isEmpty(v, opts)) v = def;
              return cast(v, opts);
            };
          }
          if (key === "node") return () => node;
          if (key === "proxy") return () => self2.createNodeProxy(node);
          if (key === "type") return () => node.__type;
          if (key === "as") {
            return (ctorOrName) => {
              const name = typeof ctorOrName === "string" ? ctorOrName : ctorOrName.name;
              const cached = node.__instances.get(name);
              if (cached) return cached;
              const raw = self2.val(node);
              if (typeof ctorOrName !== "string" && raw instanceof ctorOrName) return raw;
              if (raw && raw.constructor && raw.constructor.name === name) return raw;
              return null;
            };
          }
          if (key === "watch") return (cb) => {
            node.__watchers.add(cb);
            return () => node.__watchers.delete(cb);
          };
          if (key === "nodes") {
            return () => {
              const out = {};
              for (const ck in node.__nodes) out[ck] = self2.createNodeProxy(node.__nodes[ck]);
              return out;
            };
          }
          if (key in builtViews) return () => {
            const v = node.__value;
            if (v && typeof v === "object") return v[builtViews[key]];
            return v;
          };
          if (key === "select") {
            return (selOrType) => {
              const g = new Group(self2, node);
              if (typeof selOrType === "string" && /[#\.\[:]/.test(selOrType)) {
                g.selectCss(selOrType).reactiveMode(true);
              } else if (selOrType) {
                g.byType(...Array.isArray(selOrType) ? selOrType : [selOrType]);
              }
              return wrapGroup(g.initSelection());
            };
          }
          if (key === "group") {
            return (paths) => {
              if (!paths && node.__group) {
                return wrapGroup(node.__group);
              }
              const g = new Group(self2, self2.root);
              if (paths) {
                for (const p of paths) g.addPath(p);
              }
              node.__group = g;
              return wrapGroup(g);
            };
          }
          if (node.__behaviors?.has(key)) {
            const api = node.__behaviors.get(key);
            return new Proxy(api, {
              get(t, k) {
                const m = t[k];
                return typeof m === "function" ? m.bind(receiver) : m;
              }
            });
          }
          const cur = self2.val(node);
          if (cur?.__id) return self2.createNodeProxy(cur)[key];
          if (node.__nodes[key]) return self2.createNodeProxy(node.__nodes[key]);
          return baseFn[key];
        }
      });
      return proxy;
    }
    proxy(path) {
      const root = this.createNodeProxy(this.root);
      return path ? root(path) : root;
    }
  };
  var fx;
  var fxCfg = (path, fallback) => {
    if (!fx || !fx.root) return fallback;
    const sysNode = fx.resolvePath(`system.fx.${path}`, fx.root);
    if (sysNode) {
      const sys = fx.val(sysNode);
      if (sys !== void 0) return sys;
    }
    const cfgNode = fx.resolvePath(`config.fx.${path}`, fx.root);
    if (cfgNode) {
      const cfg = fx.val(cfgNode);
      if (cfg !== void 0) return cfg;
    }
    return fallback;
  };
  function attachNamespaceToNode(fx2, node, ns, opts) {
    const typeName = opts.type;
    if (!node.__nodes) node.__nodes = /* @__PURE__ */ Object.create(null);
    const shape = ns?.default && typeof ns.default === "object" ? { ...ns.default, ...Object.fromEntries(Object.entries(ns).filter(([k]) => k !== "default")) } : ns;
    if (!node.__value || typeof node.__value !== "object" || !("raw" in node.__value)) {
      node.__value = { raw: node.__value, stringified: String(node.__value), boolean: Boolean(node.__value) };
    }
    const bag = node.__value;
    bag[typeName] ??= {};
    if (node.__type == null) node.__type = typeName;
    else if (node.__type !== typeName && !node.__proto.includes(typeName)) node.__proto.push(typeName);
    const attachFnToNode = (k, fn) => {
      const sub = node.__nodes[k] || (node.__nodes[k] = fx2.createNode(node.__id));
      sub.__value = (...a) => fn(...a);
      prop(node, k, (...a) => fn(...a));
    };
    const attachValToNode = (k, v) => {
      const sub = node.__nodes[k] || (node.__nodes[k] = fx2.createNode(node.__id));
      sub.__value = v;
      Object.defineProperty(node, k, { configurable: true, enumerable: false, get: () => v });
    };
    const attachIntoTypeSurface = (k, v) => {
      const surface = bag[typeName];
      if (typeof v === "function") surface[k] = v.bind(surface);
      else surface[k] = v;
    };
    const onConflict = opts.onConflict ?? "warn-and-namespace";
    const allowMixin = (k) => {
      if (node.__nodes[k]) {
        if (onConflict === "overwrite") return true;
        if (onConflict === "warn-and-namespace") {
          console.warn(`[FX] Mixin conflict on '${k}' (type '${typeName}'); preserving existing; available via .val().${typeName}.${k}`);
          return false;
        }
        return false;
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
      get: () => node.__value[typeName]
    });
  }
  var toHeaders = (h) => {
    const out = new Headers();
    for (const k in h) out.set(k, h[k]);
    return out;
  };
  var deserialize = (x) => typeof x === "string" ? (() => {
    try {
      return JSON.parse(x);
    } catch {
      return x;
    }
  })() : x;
  function serverFetch(url, method, headers, body) {
    return fetch(url, {
      method,
      headers,
      body: body == null ? void 0 : typeof body === "string" || body instanceof Blob ? body : JSON.stringify(body)
    });
  }
  function FutureProxy(fx2, promise, opts = {}) {
    const { targetNode, globalName, onResolve } = opts;
    const state = { resolved: false, value: void 0, error: void 0 };
    promise.then((v) => {
      state.resolved = true;
      state.value = v;
      if (targetNode) fx2.set(targetNode, v);
      if (globalName) globalThis[globalName] = v;
      onResolve?.(v);
    }).catch((e) => {
      state.resolved = true;
      state.error = e;
      if (targetNode) fx2.set(targetNode, { error: String(e) });
    });
    const handler = {
      get(_t, prop2) {
        if (prop2 === "then") return (cb) => {
          !state.resolved ? promise.then(cb) : cb(state.value);
        };
        if (prop2 === "await") return () => promise;
        if (!state.resolved) return void 0;
        const v = state.value, out = v?.[prop2];
        return typeof out === "function" ? out.bind(v) : out;
      },
      apply(_t, _this, args) {
        if (!state.resolved) throw new Error("Future not resolved yet");
        if (typeof state.value === "function") return state.value(...args);
        throw new Error("Resolved value is not callable");
      }
    };
    const callable = function(...args) {
      if (!state.resolved) throw new Error("Future not resolved yet");
      if (typeof state.value === "function") return state.value(...args);
      return state.value;
    };
    return new Proxy(callable, handler);
  }
  function httpCall(url, method, args, fx2, node, forcedGlobal) {
    const { headers = {}, body, global } = args || {};
    const g = forcedGlobal || global;
    if (IS_SERVER) {
      const p2 = serverFetch(url, method, headers, body).then(async (r) => {
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) return r.json();
        return r.text();
      }).then(deserialize);
      return FutureProxy(fx2, p2, { targetNode: node, globalName: g });
    }
    const sameOrigin = isRel(url) ? url : `/fx/proxy?url=${encodeURIComponent(url)}`;
    const p = fetch(sameOrigin, {
      method,
      headers: toHeaders(headers),
      body: body == null ? void 0 : typeof body === "string" || body instanceof Blob ? body : JSON.stringify(body)
    }).then(async (r) => {
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) return r.json();
      return r.text();
    }).then(deserialize);
    return FutureProxy(fx2, p, { targetNode: node, globalName: g });
  }
  function buildAtBinding(fx2, baseNode, spec) {
    const isModuleFile = /\.(m?js|tsx?|jsx)$/i.test(spec);
    const isApi = !isModuleFile && (isHttp(spec) || isRel(spec));
    const ctx = { node: baseNode, ns: void 0, opts: {}, loaded: false };
    function options(o) {
      ctx.opts = { ...ctx.opts, ...o };
      if (!ctx.loaded && !isApi) {
        loadModuleSync(spec);
      }
      return api;
    }
    function exportsProxy() {
      const target = ctx.ns?.default ?? ctx.ns;
      const handler = {
        get(_t, prop2) {
          if (prop2 === "options") return options;
          if (!ctx.loaded && !isApi) {
            loadModuleSync(spec);
          }
          try {
            if (isApi && typeof prop2 === "string" && ["get", "post", "put", "patch", "delete", "fetch"].includes(prop2)) {
              const meth = prop2 === "fetch" ? "GET" : prop2.toUpperCase();
              if (ctx.node?.__nodes[prop2]) return fx2.createNodeProxy(ctx.node.__nodes[prop2]);
              return (args) => httpCall(spec, meth, args, fx2, ctx.node, ctx.opts.global);
            }
            const val = (ctx.ns?.default && ctx.ns.default[prop2]) ?? ctx.ns?.[prop2];
            if (typeof val === "function") {
              return new Proxy(val, {
                apply(target2, thisArg, argArray) {
                  return invokeWithSuspendReplay(target2, ctx.ns.default ?? ctx.ns, argArray ?? []);
                }
              });
            }
            return val;
          } catch (e) {
            if (e?.tag === "FX:SUSPEND") {
              const suspend = e;
              return new Proxy(function() {
              }, {
                get() {
                  throw suspend;
                },
                apply() {
                  throw suspend;
                },
                construct() {
                  throw suspend;
                }
              });
            }
            throw e;
          }
        },
        apply(_t, _this, args) {
          const d = ctx.ns?.default;
          if (typeof d === "function") {
            return invokeWithSuspendReplay(d, ctx.ns.default ?? ctx.ns, args ?? []);
          }
          throw new Error("Default export is not callable.");
        }
      };
      const callable = function(...args) {
        const d = ctx.ns?.default;
        if (typeof d === "function") return d(...args);
        throw new Error("Default export is not callable.");
      };
      return new Proxy(callable, handler);
    }
    function loadModuleSync(url) {
      if (ctx.loaded) return;
      const code = fx2.moduleLoader.loadSync(url);
      const module = { exports: {} };
      const exports = module.exports;
      const fn = new Function("module", "exports", "fx", code);
      fn.call(exports, module, exports, fx2);
      if (ctx.opts?.instantiateDefault) {
        const d = module.exports.default;
        const isClass = typeof d === "function" && /^class\s/.test(Function.prototype.toString.call(d));
        if (isClass) {
          const args = typeof ctx.opts.instantiateDefault === "object" ? ctx.opts.instantiateDefault.args ?? [] : [];
          module.exports.default = new d(...args);
        }
      }
      ctx.ns = module.exports;
      let instance = ctx.ns.default ?? ctx.ns;
      if (typeof instance === "function" && ctx.opts?.type === "plugin") {
        instance = instance(fx2, ctx.opts);
      }
      attachNamespaceToNode(fx2, ctx.node, ctx.ns, { type: ctx.opts?.type || "module", ...ctx.opts });
      if (ctx.opts?.global) {
        globalThis[ctx.opts.global] = instance;
      }
      ctx.loaded = true;
    }
    function fetchApi(url) {
      const callable = {};
      callable.fetch = (args) => httpCall(url, "GET", args, fx2, ctx.node, ctx.opts.global);
      callable.get = (args) => ctx.node?.__nodes["get"] ? fx2.createNodeProxy(ctx.node.__nodes["get"]) : httpCall(url, "GET", args, fx2, ctx.node, ctx.opts.global);
      callable.post = (args) => ctx.node?.__nodes["post"] ? fx2.createNodeProxy(ctx.node.__nodes["post"]) : httpCall(url, "POST", args, fx2, ctx.node, ctx.opts.global);
      callable.put = (args) => ctx.node?.__nodes["put"] ? fx2.createNodeProxy(ctx.node.__nodes["put"]) : httpCall(url, "PUT", args, fx2, ctx.node, ctx.opts.global);
      callable.patch = (args) => ctx.node?.__nodes["patch"] ? fx2.createNodeProxy(ctx.node.__nodes["patch"]) : httpCall(url, "PATCH", args, fx2, ctx.node, ctx.opts.global);
      callable.delete = (args) => ctx.node?.__nodes["delete"] ? fx2.createNodeProxy(ctx.node.__nodes["delete"]) : httpCall(url, "DELETE", args, fx2, ctx.node, ctx.opts.global);
      callable.options = options;
      return callable;
    }
    const api = isApi ? fetchApi(spec) : exportsProxy();
    api.options = options;
    return api;
  }
  function patchDollarAtSyntax(fx2) {
    const original = fx2.proxy();
    const baseDollar = (path) => {
      if (path.includes("@")) {
        const parts = path.split("@");
        const nodePath = parts[0];
        const spec = parts.slice(1).join("@");
        const node = nodePath ? fx2.setPath(nodePath, void 0, fx2.root) : fx2.root;
        return buildAtBinding(fx2, node, spec);
      }
      return original(path);
    };
    const dollar = new Proxy(baseDollar, {
      apply(_t, _this, args) {
        return invokeWithSuspendReplay(baseDollar, _this, args);
      },
      get(_t, key, receiver) {
        try {
          const val = Reflect.get(baseDollar, key, receiver);
          if (typeof val === "function") {
            return new Proxy(val, {
              apply(target, thisArg, argArray) {
                return invokeWithSuspendReplay(target, thisArg, argArray ?? []);
              }
            });
          }
          return val;
        } catch (e) {
          if (e?.tag === "FX:SUSPEND") {
            const suspend = e;
            return new Proxy(function() {
            }, {
              get() {
                throw suspend;
              },
              apply() {
                throw suspend;
              },
              construct() {
                throw suspend;
              }
            });
          }
          throw e;
        }
      }
    });
    globalThis.$$ = dollar;
    return dollar;
  }
  function parseSelector(input) {
    const tokens = input.split(",").map((s) => s.trim()).filter(Boolean);
    return tokens.map(parseOne);
  }
  function parseOne(s) {
    const chain = [];
    let i = 0;
    const ws = () => {
      while (/\s/.test(s[i] || "")) i++;
    };
    const readIdent = () => {
      const m = /^[A-Za-z0-9_\-\$]+/.exec(s.slice(i));
      if (!m) return "";
      i += m[0].length;
      return m[0];
    };
    const step = { simple: [] };
    const pushStepIfNeeded = () => {
      if (step.simple.length) {
        chain.push({ simple: [...step.simple] });
        step.simple.length = 0;
      }
    };
    while (i < s.length) {
      ws();
      const c = s[i];
      if (!c) break;
      if (c === ".") {
        i++;
        const name = readIdent();
        step.simple.push({ kind: "class", name });
      } else if (c === "#") {
        i++;
        const id = readIdent();
        step.simple.push({ kind: "id", id });
      } else if (c === "[") {
        i++;
        ws();
        const key = readIdent();
        ws();
        let op = "=";
        if ("=!^$*".includes(s[i] || "")) {
          const allowed = new Set(fxCfg("selectors.enabledAttrOps", ["="]));
          if (s[i] === "=") {
            op = "=";
            i++;
          } else if (s[i] === "!" && s[i + 1] === "=") {
            i += 2;
            op = "!=";
          } else if (s[i] === "^" && s[i + 1] === "=") {
            i += 2;
            op = "^=";
          } else if (s[i] === "$" && s[i + 1] === "=") {
            i += 2;
            op = "$=";
          } else if (s[i] === "*" && s[i + 1] === "=") {
            i += 2;
            op = "*=";
          }
          if (!allowed.has(op)) op = "=";
        }
        ws();
        let value = "";
        if (s[i] === '"' || s[i] === "'") {
          const q = s[i++];
          const start = i;
          while (i < s.length && s[i] !== q) i++;
          value = s.slice(start, i);
          i++;
        } else {
          const m = /^[^\]\s]+/.exec(s.slice(i));
          value = m ? m[0] : "";
          i += value.length;
        }
        ws();
        if (s[i] === "]") i++;
        step.simple.push({ kind: "attr", key, op, value });
      } else if (c === ":") {
        let readBalanced = function() {
          let depth = 1, out = "";
          while (i < s.length && depth > 0) {
            if (s[i] === "(") depth++;
            else if (s[i] === ")") depth--;
            if (depth > 0) out += s[i];
            i++;
          }
          return out.trim();
        };
        i++;
        const id = readIdent();
        ws();
        if (s[i] === "(") {
          i++;
          const inside = readBalanced();
          if (id === "not") {
            const inner = parseOne(inside);
            step.simple.push({ kind: "not", inner });
          } else if (id === "can") {
            const innerAst = parseSelector(inside)[0];
            const firstStep = innerAst?.chain?.find((x) => x.simple);
            const firstSimple = firstStep?.simple?.[0];
            if (firstSimple) step.simple.push({ kind: "can", inner: firstSimple });
          } else if (id === "has") {
            const enabled = fxCfg("selectors.enableHas", false);
            if (enabled) step.simple.push({ kind: "has", inner: parseOne(inside) });
          }
        }
      } else if (c === ">") {
        pushStepIfNeeded();
        chain.push("child");
        i++;
      } else if (/\s/.test(c)) {
        pushStepIfNeeded();
        if (chain.length && chain[chain.length - 1] !== "desc") chain.push("desc");
        ws();
      } else {
        i++;
      }
    }
    pushStepIfNeeded();
    return { chain };
  }
  function matchSimple(fx2, node, s) {
    if (s.kind === "class") {
      const t = node.__type, protos = node.__proto || [];
      const matchType = fxCfg("selectors.classMatchesType", true);
      return matchType && t === s.name || protos.includes(s.name);
    }
    if (s.kind === "id") return node.__id === s.id;
    if (s.kind === "attr") {
      const order = fxCfg("selectors.attrResolution", ["meta", "type", "raw", "child"]);
      const rawBag = fx2.val(node);
      const typeName = node.__type || null;
      const typeSurface = rawBag && typeName && typeof rawBag === "object" ? rawBag[typeName] : void 0;
      const meta = node.__meta;
      let found;
      for (const where of order) {
        if (where === "meta" && meta && typeof meta === "object" && s.key in meta) {
          found = meta[s.key];
          break;
        }
        if (where === "type" && typeSurface && typeof typeSurface === "object" && s.key in typeSurface) {
          found = typeSurface[s.key];
          break;
        }
        if (where === "raw" && rawBag && typeof rawBag === "object" && s.key in rawBag) {
          found = rawBag[s.key];
          break;
        }
        if (where === "child" && node.__nodes[s.key]) {
          found = fx2.val(node.__nodes[s.key]);
          break;
        }
      }
      const val = String(found ?? "");
      const rhs = s.value;
      switch (s.op) {
        case "=":
          return val === rhs;
        case "!=":
          return val !== rhs;
        case "^=":
          return val.startsWith(rhs);
        case "$=":
          return val.endsWith(rhs);
        case "*=":
          return val.includes(rhs);
        default:
          return false;
      }
    }
    if (s.kind === "can") {
      const inner = s.inner;
      const meta = node.__meta;
      const can = meta?.can;
      if (inner.kind === "class") return Array.isArray(can) && can.includes(inner.name);
      return false;
    }
    if (s.kind === "has") {
      if (!fxCfg("selectors.enableHas", false)) return false;
      const inner = s.inner;
      const stack = Object.values(node.__nodes);
      while (stack.length) {
        const c = stack.pop();
        if (matchCompound(fx2, c, inner)) return true;
        for (const k in c.__nodes) stack.push(c.__nodes[k]);
      }
      return false;
    }
    if (s.kind === "not") return !matchCompound(fx2, node, s.inner);
    return false;
  }
  function matchStep(fx2, node, step) {
    return step.simple.every((s) => matchSimple(fx2, node, s));
  }
  function findParent(fx2, n) {
    const m = fx2.findParentFast?.(n);
    if (m !== void 0) return m;
    const stack = [fx2.root];
    while (stack.length) {
      const cur = stack.pop();
      for (const k in cur.__nodes) {
        const c = cur.__nodes[k];
        if (c === n) return cur;
        stack.push(c);
      }
    }
    return null;
  }
  function matchCompound(fx2, node, ast) {
    const parts = ast.chain.filter(Boolean);
    let curNodes = [node];
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part === "desc" || part === "child") continue;
      const step = part;
      curNodes = curNodes.filter((n) => matchStep(fx2, n, step));
      if (!curNodes.length) return false;
      const prev = parts[i - 1];
      if (prev === "child") {
        curNodes = curNodes.map((n) => findParent(fx2, n)).filter(Boolean);
        i--;
        if (!curNodes.length) return false;
      } else if (prev === "desc") {
        const ancestors = /* @__PURE__ */ new Set();
        for (const n of curNodes) {
          let p = findParent(fx2, n);
          while (p) {
            ancestors.add(p);
            p = findParent(fx2, p);
          }
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
  var Group = class {
    fx;
    anchor;
    members = /* @__PURE__ */ new Set();
    // current reconciled members
    perNodeUnwatch = /* @__PURE__ */ new Map();
    mode = "list";
    deepFlag = false;
    listeners = /* @__PURE__ */ new Map();
    filterFn = null;
    typeFilter = null;
    reactive = fxCfg("groups.reactiveDefault", true);
    debounceMs = fxCfg("groups.debounceMs", 20);
    offStructure;
    // CSS composition
    includeSelectors = [];
    excludeSelectors = [];
    // Ordered manual set
    manualOrder = [];
    manualSet = /* @__PURE__ */ new Set();
    constructor(fx2, anchor) {
      this.fx = fx2;
      this.anchor = anchor;
    }
    // type guards
    isPredicate(x) {
      return typeof x === "function" && typeof x.node !== "function";
    }
    // ---------- selection & filters ----------
    byType(...types) {
      this.typeFilter = types.filter(Boolean);
      this.reconcile();
      return this;
    }
    where(fn) {
      this.filterFn = fn;
      this.reconcile();
      return this;
    }
    deep(flag = true) {
      this.deepFlag = flag;
      this.reconcile();
      return this;
    }
    modeSet() {
      this.mode = "set";
      return this;
    }
    modeList() {
      this.mode = "list";
      return this;
    }
    reactiveMode(flag = true) {
      this.reactive = flag;
      if (flag) this.hook();
      else this.unhook();
      return this;
    }
    debounce(ms) {
      this.debounceMs = ms;
      return this;
    }
    selectCss(selector) {
      this.includeSelectors.push(parseSelector(selector));
      this.reconcile();
      return this;
    }
    excludeCss(selector) {
      this.excludeSelectors.push(parseSelector(selector));
      this.reconcile();
      return this;
    }
    removeSelector(selector) {
      const ast = JSON.stringify(parseSelector(selector));
      this.includeSelectors = this.includeSelectors.filter((s) => JSON.stringify(s) !== ast);
      this.excludeSelectors = this.excludeSelectors.filter((s) => JSON.stringify(s) !== ast);
      this.reconcile();
      return this;
    }
    clearSelectors(kind = "all") {
      if (kind === "include" || kind === "all") this.includeSelectors = [];
      if (kind === "exclude" || kind === "all") this.excludeSelectors = [];
      this.reconcile();
      return this;
    }
    // ---------- manual ordered membership ----------
    addPath(path) {
      const n = this.fx.resolvePath(path, this.fx.root);
      if (n) this.add(n);
      return this;
    }
    idOf(n) {
      return n.__id;
    }
    resolveTarget(t) {
      if (!t) return null;
      if (typeof t === "string") return this.fx.resolvePath(t, this.fx.root) || null;
      if (typeof t === "function" && typeof t.node === "function") return t.node();
      const n = t;
      return n?.__id ? n : null;
    }
    add(target) {
      const n = this.resolveTarget(target);
      if (!n) return this;
      const id = this.idOf(n);
      if (!this.manualSet.has(id)) {
        this.manualSet.add(id);
        this.manualOrder.push(id);
        if (!this.members.has(n)) {
          this.members.add(n);
          const un = this.fx.createNodeProxy(n).watch((_nv) => this.emit("change"));
          this.perNodeUnwatch.set(n.__id, un);
        }
        this.emit("change");
      }
      return this;
    }
    prepend(target) {
      const n = this.resolveTarget(target);
      if (!n) return this;
      const id = this.idOf(n);
      if (!this.manualSet.has(id)) {
        this.manualSet.add(id);
        this.manualOrder.unshift(id);
        this.emit("change");
      }
      return this;
    }
    insert(index, target) {
      const n = this.resolveTarget(target);
      if (!n) return this;
      const id = this.idOf(n);
      if (!this.manualSet.has(id)) {
        this.manualSet.add(id);
        const i = Math.max(0, Math.min(index, this.manualOrder.length));
        this.manualOrder.splice(i, 0, id);
        this.emit("change");
      }
      return this;
    }
    addAfter(existing, target, opts) {
      const ex = this.resolveTarget(existing);
      const add = this.resolveTarget(target);
      if (!ex || !add) return this;
      const exId = this.idOf(ex), addId = this.idOf(add);
      let occ = opts?.occurrence ?? 1, pos = -1;
      for (let i = 0; i < this.manualOrder.length; i++) {
        if (this.manualOrder[i] === exId && --occ === 0) {
          pos = i;
          break;
        }
      }
      if (pos === -1) return this.add(add);
      if (!this.manualSet.has(addId)) {
        this.manualSet.add(addId);
        this.manualOrder.splice(pos + 1, 0, addId);
        this.emit("change");
      }
      return this;
    }
    addBefore(existing, target) {
      const ex = this.resolveTarget(existing);
      const add = this.resolveTarget(target);
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
    remove(target) {
      if (this.isPredicate(target)) {
        for (let i = this.manualOrder.length - 1; i >= 0; i--) {
          const id2 = this.manualOrder[i];
          const node = this.findById(id2);
          if (node && target(this.fx.createNodeProxy(node))) {
            this.manualOrder.splice(i, 1);
            this.manualSet.delete(id2);
          }
        }
        this.emit("change");
        return this;
      }
      const n = this.resolveTarget(target);
      if (!n) return this;
      const id = this.idOf(n);
      if (this.manualSet.has(id)) {
        this.manualSet.delete(id);
        const idx = this.manualOrder.indexOf(id);
        if (idx >= 0) this.manualOrder.splice(idx, 1);
        this.emit("change");
      }
      return this;
    }
    clear() {
      this.manualOrder.length = 0;
      this.manualSet.clear();
      this.emit("change");
      return this;
    }
    findById(id) {
      const stack = [this.fx.root];
      while (stack.length) {
        const n = stack.pop();
        if (n.__id === id) return n;
        for (const k in n.__nodes) stack.push(n.__nodes[k]);
      }
      return null;
    }
    // ---------- materialization & reconcile ----------
    collectBySelectors(lists) {
      if (!lists.length) return [];
      const res = [];
      const visit = (n) => {
        for (const k in n.__nodes) {
          const c = n.__nodes[k];
          const ok = lists.some((list) => list.some((comp) => matchCompound(this.fx, c, comp)));
          if (ok) res.push(c);
          visit(c);
        }
      };
      visit(this.anchor);
      return res;
    }
    materialize() {
      const out = [];
      const seen = /* @__PURE__ */ new Set();
      for (const id of this.manualOrder) {
        const n = this.findById(id);
        if (!n) continue;
        out.push(n);
        seen.add(id);
      }
      const inc = this.collectBySelectors(this.includeSelectors);
      for (const n of inc) {
        const id = this.idOf(n);
        if (!seen.has(id)) {
          out.push(n);
          seen.add(id);
        }
      }
      const exc = new Set(this.collectBySelectors(this.excludeSelectors).map((n) => this.idOf(n)));
      const filtered = out.filter((n) => !exc.has(this.idOf(n)));
      return filtered;
    }
    scanFallback() {
      const res = [];
      const visit = (n) => {
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
    scanOnce() {
      const haveCss = this.includeSelectors.length || this.excludeSelectors.length;
      return haveCss ? this.materialize() : this.scanFallback();
    }
    resubscribe() {
      for (const un of this.perNodeUnwatch.values()) try {
        un();
      } catch {
      }
      this.perNodeUnwatch.clear();
      for (const n of this.members) {
        const un = this.fx.createNodeProxy(n).watch((_nv) => this.emit("change"));
        this.perNodeUnwatch.set(n.__id, un);
      }
    }
    reconcile() {
      const next = new Set(this.scanOnce());
      let changed = false;
      for (const n of Array.from(this.members)) {
        if (!next.has(n)) {
          this.members.delete(n);
          changed = true;
          const un = this.perNodeUnwatch.get(n.__id);
          if (un) {
            un();
            this.perNodeUnwatch.delete(n.__id);
          }
        }
      }
      for (const n of next) {
        if (!this.members.has(n)) {
          this.members.add(n);
          changed = true;
          const un = this.fx.createNodeProxy(n).watch((_nv) => this.emit("change"));
          this.perNodeUnwatch.set(n.__id, un);
        }
      }
      if (changed) this.emit("change");
    }
    initSelection() {
      this.reconcile();
      if (this.reactive) this.hook();
      return this;
    }
    isInSubtree(n, root) {
      if (n === root) return true;
      let p = findParent(this.fx, n);
      while (p) {
        if (p === root) return true;
        p = findParent(this.fx, p);
      }
      return false;
    }
    hook() {
      if (this.offStructure) return;
      let pending = false, timer = null;
      const flush = () => {
        pending = false;
        timer = null;
        this.reconcile();
      };
      const schedule2 = () => {
        if (pending) return;
        pending = true;
        if (this.debounceMs <= 0) flush();
        else timer = setTimeout(flush, this.debounceMs);
      };
      this.offStructure = this.fx.onStructure((e) => {
        if (!this.isInSubtree(e.node, this.anchor)) return;
        schedule2();
      });
      this.reconcile();
    }
    unhook() {
      if (this.offStructure) {
        try {
          this.offStructure();
        } catch {
        }
        this.offStructure = void 0;
      }
      for (const un of this.perNodeUnwatch.values()) try {
        un();
      } catch {
      }
      this.perNodeUnwatch.clear();
    }
    // ---------- public read ops ----------
    list() {
      const arr = Array.from(this.members).map((n) => this.fx.createNodeProxy(n));
      return this.mode === "list" ? arr : Array.from(new Set(arr));
    }
    values() {
      return this.list().map((p) => p.val());
    }
    sum() {
      return this.values().reduce((a, b) => Number(a) + Number(b), 0);
    }
    concat(sep = "") {
      return this.values().join(sep);
    }
    cast(kind) {
      const v = this.values();
      if (kind === "number") return v.map(Number);
      if (kind === "boolean") return v.map(Boolean);
      return v.map(String);
    }
    max() {
      return Math.max(...this.cast("number"));
    }
    min() {
      return Math.min(...this.cast("number"));
    }
    average() {
      const a = this.cast("number");
      return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    }
    sort(dir = "asc") {
      const v = [...this.values()].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      return dir === "asc" ? v : v.reverse();
    }
    same(kind = "value") {
      const arr = this.list();
      if (!arr.length) return true;
      if (kind === "type") {
        const t = arr[0].type();
        return arr.every((n) => n.type() === t);
      }
      const v = arr[0].val();
      return arr.every((n) => n.val() === v);
    }
    has(v) {
      return this.values().some((x) => x === v);
    }
    // events
    on(ev, handler) {
      if (!this.listeners.has(ev)) this.listeners.set(ev, /* @__PURE__ */ new Set());
      const wrap = typeof handler === "function" ? handler : (g) => {
        if (ev === "has" && handler?.value !== void 0) {
          if (g.has(handler.value)) handler.callback?.(g);
        } else if (ev === "average") {
          const avg = g.average();
          if (handler.equalTo !== void 0 && avg === handler.equalTo || handler.greaterThan !== void 0 && avg > handler.greaterThan || handler.lessThan !== void 0 && avg < handler.lessThan) {
            handler.callback?.(g, avg);
          }
        } else {
          handler?.callback?.(g);
        }
      };
      this.listeners.get(ev).add(wrap);
      return () => this.off(ev, wrap);
    }
    off(ev, handler) {
      this.listeners.get(ev)?.delete(handler);
    }
    emit(ev) {
      const ls = this.listeners.get(ev);
      if (!ls) return;
      for (const h of Array.from(ls)) try {
        h(this);
      } catch (e) {
        console.error(e);
      }
    }
  };
  function wrapGroup(g) {
    return {
      // membership (paths or proxies)
      add: (t) => {
        g.add(t);
        return wrapGroup(g);
      },
      insert: (i, t) => {
        g.insert(i, t);
        return wrapGroup(g);
      },
      addAfter: (ex, t, o) => {
        g.addAfter(ex, t, o);
        return wrapGroup(g);
      },
      addBefore: (ex, t) => {
        g.addBefore(ex, t);
        return wrapGroup(g);
      },
      prepend: (t) => {
        g.prepend(t);
        return wrapGroup(g);
      },
      remove: (t) => {
        g.remove(t);
        return wrapGroup(g);
      },
      clear: () => {
        g.clear();
        return wrapGroup(g);
      },
      // composition (CSS)
      select: (cssOrType) => {
        if (typeof cssOrType === "string" && /[#\.\[:]/.test(cssOrType)) g.selectCss(cssOrType);
        else if (cssOrType) g.byType(...Array.isArray(cssOrType) ? cssOrType : [cssOrType]);
        return wrapGroup(g.initSelection());
      },
      include: (css) => {
        g.selectCss(css);
        g.initSelection();
        return wrapGroup(g);
      },
      exclude: (css) => {
        g.excludeCss(css);
        return wrapGroup(g);
      },
      removeSelector: (css) => {
        g.removeSelector(css);
        return wrapGroup(g);
      },
      clearSelectors: (kind) => {
        g.clearSelectors(kind);
        return wrapGroup(g);
      },
      // config
      options: (o) => {
        if (o.mode === "set") g.modeSet();
        else if (o.mode === "list") g.modeList();
        return wrapGroup(g);
      },
      deep: (flag = true) => {
        g.deep(flag);
        return wrapGroup(g);
      },
      where: (fn) => {
        g.where(fn);
        return wrapGroup(g);
      },
      reactive: (flag = true) => {
        g.reactiveMode(flag);
        return wrapGroup(g);
      },
      debounce: (ms) => {
        g.debounce(ms);
        return wrapGroup(g);
      },
      name: (_n) => wrapGroup(g),
      // events
      on: (ev, h) => g.on(ev, h),
      off: (ev, h) => g.off(ev, h),
      // access & ops
      list: () => g.list(),
      sum: () => g.sum(),
      concat: (sep) => g.concat(sep),
      cast: (k) => g.cast(k),
      max: () => g.max(),
      min: () => g.min(),
      average: () => g.average(),
      sort: (dir) => g.sort(dir),
      same: (kind) => g.same(kind ?? "value"),
      hasValue: (v) => g.has(v),
      _group: g
    };
  }
  fx = new FXCore();
  var $_$$ = fx.createNodeProxy(fx.root);
  fx.ensureSystemRoots();
  var $$ = $_$$("app");
  var $root = (p) => {
    $$ = $_$$(p);
    globalThis.$$ = $$;
  };
  var $val = (path, value, def) => {
    const r = $$(path).val();
    if (value !== void 0) {
      $$(path).val(value);
      return $$(path);
    }
    return r === void 0 ? def : r;
  };
  var $set = (path, value) => $$(path).set(value);
  var $get = (path) => $$(path).get();
  var $has = (path) => $$(path).val() !== void 0;
  var $app = $_$$("app");
  var $config = $_$$("config");
  var $plugins = $_$$("plugins");
  var $modules = $_$$("modules");
  var $atomics = $_$$("atomics");
  var $dom = $_$$("dom");
  var $session = $_$$("session");
  var $system = $_$$("system");
  var $cache = $_$$("cache");
  Object.assign(globalThis, { fx, $_$$, $$, $root, $val, $set, $get, $has, $app, $config, $plugins, $modules, $atomics, $dom, $session, $system, $cache });
  $$ = patchDollarAtSyntax(fx);
  globalThis.$$ = $$;
  if (IS_SERVER && globalThis.Deno?.serve && (globalThis.Deno.env.get("FX_SERVE") === "true" || import_meta.main)) {
    const PORT = Number(globalThis.Deno.env.get("PORT") || "8787");
    globalThis.Deno.serve({ port: PORT }, async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (path === "/fx/health") return cors(json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() }));
      if (path === "/fx/log") {
        const logFile = "./flow-log.txt";
        if (req.method === "POST") {
          try {
            const body = await req.json();
            const value = body.value || "";
            await globalThis.Deno.writeTextFile(logFile, String(value), { append: true });
            return cors(json({ ok: true, logged: value }));
          } catch (e) {
            return cors(json({ error: String(e?.message || e) }, 500));
          }
        } else if (req.method === "GET") {
          try {
            const content = await globalThis.Deno.readTextFile(logFile);
            return cors(json({ log: content }));
          } catch (e) {
            return cors(json({ log: "" }));
          }
        } else if (req.method === "DELETE") {
          try {
            await globalThis.Deno.writeTextFile(logFile, "");
            return cors(json({ ok: true, cleared: true }));
          } catch (e) {
            return cors(json({ error: String(e?.message || e) }, 500));
          }
        }
      }
      if (path === "/fx/proxy") {
        const target = url.searchParams.get("url");
        if (!target) return cors(json({ error: "Missing url" }, 400));
        try {
          const body = await maybeBody(req);
          const headers = new Headers(req.headers);
          headers.delete("host");
          headers.delete("origin");
          headers.delete("referer");
          const r = await fetch(target, { method: req.method, headers, body: body?.raw });
          const h = new Headers(r.headers);
          h.set("content-type", r.headers.get("content-type") || "application/octet-stream");
          return cors(new Response(await r.arrayBuffer(), { status: r.status, headers: h }));
        } catch (e) {
          return cors(json({ error: String(e?.message || e) }, 500));
        }
      }
      if (path === "/fx/module") {
        try {
          const entry = url.searchParams.get("entry") || "./fx.ts";
          const denoAny = globalThis.Deno;
          const baseUrl = import_meta.url;
          const { files } = await denoAny.emit(new URL(entry, baseUrl), { bundle: "classic" });
          const js = files["deno:///bundle.js"] || files[Object.keys(files)[0]] || "";
          const h = new Headers({ "content-type": "application/javascript; charset=utf-8" });
          return cors(new Response(js, { status: 200, headers: h }));
        } catch (e) {
          return cors(json({ error: "emit-fail", message: String(e?.message || e) }, 500));
        }
      }
      try {
        const base = import_meta.url.replace(/[^\/]+$/, "");
        const rel = path === "/" ? "index.html" : path.replace(/^\//, "");
        if (rel.includes("..")) {
          return cors(json({ error: "Invalid path" }, 400));
        }
        const fileUrl = new URL(rel, base);
        const ext = rel.split(".").pop()?.toLowerCase() || "";
        if (ext === "ts" || ext === "tsx") {
          try {
            const data2 = await globalThis.Deno.readFile(fileUrl);
            return cors(new Response(data2, {
              status: 200,
              headers: new Headers({
                "content-type": "application/javascript; charset=utf-8",
                "x-typescript-types": fileUrl.toString()
              })
            }));
          } catch (e) {
            return cors(json({ error: "file-error", message: String(e?.message || e) }, 500));
          }
        }
        const data = await globalThis.Deno.readFile(fileUrl);
        const type = {
          "html": "text/html; charset=utf-8",
          "htm": "text/html; charset=utf-8",
          "js": "application/javascript; charset=utf-8",
          "jsx": "application/javascript; charset=utf-8",
          "css": "text/css; charset=utf-8",
          "json": "application/json; charset=utf-8",
          "png": "image/png",
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "svg": "image/svg+xml",
          "gif": "image/gif",
          "ico": "image/x-icon",
          "woff": "font/woff",
          "woff2": "font/woff2",
          "ttf": "font/ttf",
          "txt": "text/plain; charset=utf-8"
        }[ext] || "application/octet-stream";
        return cors(new Response(data, { status: 200, headers: new Headers({ "content-type": type }) }));
      } catch (_) {
        return cors(json({ error: "not-found" }, 404));
      }
      return cors(json({
        fx: "online",
        endpoints: { health: "/fx/health", proxy: "/fx/proxy?url=<encoded>", module: "/fx/module?url=<encoded>" }
      }));
    });
    console.log(`[FX] Deno server listening on http://localhost:${globalThis.Deno.env.get("PORT") || 8787}`);
  }
  async function maybeBody(req) {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => void 0);
      return { raw: JSON.stringify(j ?? {}) };
    }
    if (ct.includes("text/")) {
      const t = await req.text();
      return { raw: t };
    }
    if (ct.includes("form")) {
      const form = await req.formData();
      const data = new URLSearchParams();
      for (const [k, v] of form.entries()) data.append(k, String(v));
      return { raw: data.toString() };
    }
    try {
      const b = await req.arrayBuffer();
      return { raw: b };
    } catch {
      return void 0;
    }
  }
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: new Headers({ "content-type": "application/json; charset=utf-8" }) });
  }
  function cors(res) {
    const h = new Headers(res.headers);
    h.set("access-control-allow-origin", "*");
    h.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    h.set("access-control-allow-headers", "Content-Type,Authorization,Accept");
    return new Response(res.body, { status: res.status, headers: h });
  }
  var fxn_default = fx;
  return __toCommonJS(fxn_exports);
})();
