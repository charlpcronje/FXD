# 🧾 FX Cheat Sheet

## 0) Vocabulary

* **Node**: everything. Addressed by path: `$$("app.user")`.
* **Proxy**: callable + object API for a node.
* **Type**: semantic tag for a node (`__type`); can also hold class instances.
* **Group**: reactive collection of nodes (manual and/or selector-driven).
* **@** (leading): **sync** load of a module (default export + named exports) without `await`.

---

## 1) Paths & Values

```ts
const n = $$("app.user.name");

// set / get
n.val("Charl");
n.get();                 // "Charl"

// chain create
$$("app.user.meta.title").val("Engineer");

// path call form
$$("app.user")("meta.title").val("Engineer");
```

---

## 2) Types, Instances & Type-Safe Unwrap

```ts
class User { 
  constructor(public name:strin ){} 
  greet(){return `Hi ${this.name}`;} 
}

$$("app.currentUser").val(new User("Charl"));

const u = $$("app.currentUser").as(User); // User | null
if (u) u.greet(); // "Hi Charl"
```

Force/label a type (for selectors & grouping):

```ts
$$("app.currentUser").setType("user");
```

---

## 3) Reactive Binding (Node ↔ Node)

```ts
// follow reactively
$$("a").val($$("b"));
// snapshot (non-reactive)
$$("a").val($$("b").val());

// watchers
const un = $$("count").watch((newV, oldV)=>{ /* ... */ });
un(); // unwatch
```

---

## 4) Sync Module Loading (`@`)

**Leading `@` means: “load a module synchronously now.”**

```ts
// default export
const MathLib = $$("@./lib/math.ts");     // default export proxied
MathLib.add(1,2);

// named exports
$$("@./lib/math.ts").sum(1,2);

// attach module to a node (and give it a type)
$$("app.calc@./lib/math.ts").options({ type: "math" });
$$("app.calc").sum(1,2);
```

Attach multiple modules into one node (like multi-inherit):

```ts
$$("app.user@./models/User.ts").options({ type: "user" });
$$("app.user@./models/Audit.ts");       // grafts exports under same node
$$("app.user").auditTrail();            // from Audit.ts
```

---

## 5) APIs via `@/…`

```ts
// GET (default)
const res = $$("@/api/user/42").fetch();
const data = res.json();

// Shortcuts
$$("@/api/users").post({ body: { name: "Neo" } });
$$("app.lastCall@/api/users").get().options({ global: "$last" });
// $last now holds the response node/proxy
```

Cross-origin: if URL starts with `http(s)://` it’s proxied server-side (CORS-safe).

---

## 6) CSS-Style Selectors

```ts
// Examples
// .user           → node __type = "user" (or has matching proto)
// [active=true]   → node.value.active === true
// #<uuid>         → node.__id === uuid
// .parent > .child, .parent .desc
// :not(.bot)
// :can(.user)     → candidate/potential (capability hint)
// .user, .admin   → union
```

Query:

```ts
const found = $$("app").select(".user[active=true]");
```

---

## 7) Groups (Manual + Selector + Reactive)

Create a **mixed** group:

```ts
const g = $$("groups.activeUsers").group([
  "app.users.charl",
  "app.users.trinity"
])
.include(".user[active=true]")      // selector
.exclude(".banned")                 // selector
.options({ mode: "set", reactive: true, debounceMs: 20 });

// operations
g.sum(); g.max(); g.min(); g.average();
g.concat(", ");
g.cast("number");
g.sort("desc");
g.same("role");
g.has("peter");       // value/ID depending on mode

// events
g.on("change", list => console.log("changed:", list));
g.on("average", { greaterThan: 50 }, payload => { /* ... */ });
```

Mutating membership:

```ts
g.add("app.users.neo");
g.insert(2, "app.users.morpheus");
g.addAfter("app.users.neo", "app.users.smith", { occurrence: 2 });
g.addBefore("app.users.neo", "app.users.cypher");
g.prepend("app.users.oracle");
g.remove("app.users.smith");
g.remove(n => n.get()?.type === "ghost");
g.clear();
```

---

## 8) Declarative Autoload (Optional)

If you use a manifest or config autoload:

```jsonc
// fx.config.json
{
  "plugins": {
    "dom": { "path": "/plugins/fx-dom.ts", "global": "$dom", "prefix": "plugins" },
    "scout": { "path": "/plugins/fx-scout.ts", "global": "$scout" }
  }
}
```

Then first access to `$dom` on the client triggers sync load via worker/SAB, and on server via fs.

---

## 9) Plugin Creation (Two Flavors)

### A) **Classic factory** (recommended)

```ts
// /plugins/fx-logger.ts
import type { FX } from "../fx";

export interface LoggerAPI {
  log: (msg: string, meta?: any) => void;
  level: (name: "debug"|"info"|"warn"|"error") => void;
}

export default function(fx: FX, options?: { prefix?: string }): LoggerAPI {
  let current: "debug"|"info"|"warn"|"error" = "info";

  const api: LoggerAPI = {
    log(msg, meta) {
      if (current === "debug") console.debug("[FX]", msg, meta ?? "");
      else if (current === "info") console.info("[FX]", msg, meta ?? "");
      else if (current === "warn") console.warn("[FX]", msg, meta ?? "");
      else console.error("[FX]", msg, meta ?? "");
    },
    level(name) { current = name; }
  };

  // Mount under plugins.logger and expose globals if desired
  const node = $$("plugins.logger").val(api).setType("logger");
  if (options?.prefix) $$(`${options.prefix}.logger`).val(node);

  return api;
}
```

**Load it**

```ts
// lazy via config → global $logger
$logger.log("hello");
$logger.level("debug");
```

### B) **Ultra-minimal object plugin**

```ts
// /plugins/fx-ticks.ts
export default {
  now() { return Date.now(); },
  since(ts:number){ return Date.now() - ts; }
};

// use
$$("plugins.ticks@/plugins/fx-ticks.ts");
$$("plugins.ticks").since($$("plugins.ticks").now());
```

> Tip: A plugin can also **extend FX** by calling `$$` to add behaviors/protos, register effects, or define globals.

---

## 10) DOM (Simple, Idiomatic Helper)

With the current FX, you can keep DOM helpers tiny and reactive:

```ts
// /plugins/fx-dom-lite.ts
import type { FX } from "../fx";
export interface DomLite { $(sel: string): HTMLElement[]; bind(sel:string, path:string): void; }

export default function(fx: FX): DomLite {
  const q = (s:string)=> Array.from(document.querySelectorAll<HTMLElement>(s));

  function bind(sel: string, path: string) {
    const els = q(sel);
    const node = $$(path);
    // FX -> DOM
    const push = ()=> els.forEach(el => { if ("value" in el) (el as any).value = node.get(); else el.textContent = String(node.get() ?? ""); });
    push();
    node.watch(()=>push());
    // DOM -> FX
    els.forEach(el=>{
      if ("value" in el) el.addEventListener("input", ()=> node.set((el as any).value));
    });
  }

  return { $: q, bind };
}
```

Usage:

```ts
$$("plugins.dom@/plugins/fx-dom-lite.ts");
$$("plugins.dom").bind("#username", "app.user.name");
```

This leverages FX’s reactivity natively—no custom mutation plumbing needed.

---

## 11) Quick Recipes

**Make a node mirror another node reactively**

```ts
$$("mirror").val($$("source"));
```

**Multi-module node (like multi-class)**

```ts
$$("svc@./math.ts").options({ type: "calc" });
$$("svc@./stats.ts");           // adds named exports too
$$("svc").mean([1,2,3]);
$$("svc").sum(1,2,3);
```

**Fetch and store globally**

```ts
$$("@/api/stats").get().options({ global: "$stats" });
// $stats.val() → response body (or proxied response node depending on your adapter)
```

**Selector group for files (FXD view)**

```ts
const file = $$("views.main").group([])
  .include(".snippet[lang='ts']")
  .exclude(".deprecated")
  .sort("asc", "name");
```

---

## 12) Guardrails & Gotchas

* `.val($$("b"))` → **reactive**; `.val($$("b").val())` → **snapshot**.
* Leading `@` returns **module default directly**; use `.ns` if your core exposes it (or just re-import the path again) for named exports.
* Groups are **live** by default; set `.options({ reactive:false })` for snapshot.
* `.as(Class)` unwraps only **true instances**.

## 13) DOM
```ts
// Load once
$$("plugins.dom@/plugins/fx-dom-dollar.ts");

// jQuery-like selection
$("#title")?.text($$("app.headerText"));         // reactive text (FX → DOM)
$("#title")?.css("width", $$("theme.headerWidth")); // reactive width

// Inputs (FX ↔ DOM)
const nameInput = $("#name");
nameInput?.val($$("profile.name"));               // FX → DOM, reactive
nameInput?.on("input", () => $$("profile.name").set((nameInput as any).val())); // DOM → FX

// Lazy subtree: nothing mounts until you touch it
const body = $("body");                           // no mass binding
body?.find(".card.title")?.text($$("ui.card.title")); // mounts only those elements you touch
```