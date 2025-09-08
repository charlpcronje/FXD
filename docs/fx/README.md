# 📖 FX Onboarding Document

## 🌌 1. What FX Is

FX (short for **Function eXtension / Framework eXtensible**) is a **unified runtime + data model** where:

* **Everything is a Node.**
  A node (`FXNode`) is the universal container. It can hold a value, children, metadata, prototypes, and behaviors.

* **The Node Graph Is Reactive.**
  Nodes are connected in a tree/graph (`$_$$` root). Any change (set, val, type change, proto attach) emits effects and updates watchers.

* **Access Is Proxy-Based.**
  You interact via `FXNodeProxy` (`$$("path.to.node")`). This proxy is both:

  * A function → resolves subpaths.
  * An object → has methods like `.val()`, `.set()`, `.get()`, `.watch()`, `.as(Class)`.

* **The API Is Always Sync.**
  FX is designed to feel like synchronous code, even when using workers, SharedArrayBuffer, or server-proxy fetches. No `await` in normal workflows.

---

## 🧩 2. Node Anatomy

Every node has:

```ts
interface FXNode {
  __id: string;                     // unique UUID
  __parent_id: string | null;
  __nodes: { [key: string]: FXNode }; // children
  __value: unknown;                  // stored value (view-bag if primitive, instance bag if class, etc.)
  __type: string | null;             // type string (manual or auto)
  __proto: string[];                 // attached prototypes
  __behaviors: Map<string, any>;     // inherited behavior objects
  __instances: Map<string, any>;     // true class instances
  __effects: Function[];             // event/effect hooks
  __watchers: Set<Function>;         // reactive watchers
}
```

---

## 🪄 3. Core API

### Path Access

```ts
const node = $$("app.user.profile"); // traverse / create if missing
```

### Values

```ts
node.val(42);       // set
node.val();         // get (raw view-bag or primitive)
node.get();         // get simplified value
node.set("hello");  // explicit setter
```

### Type-safe unwrap

```ts
class User { ... }
$$("app.currentUser").val(new User("Charl","Cronje"));
const u = $$("app.currentUser").as(User); // raw instance, typed
```

### Behaviors / Prototypes

```ts
$$("user").inherit(myBehavior); // attach proto methods
```

### Reactivity

```ts
$$("counter").watch((newVal, oldVal) => console.log(newVal));
$$("counter").val(1);  // triggers watcher
```

---

## 📦 4. Modules & Plugins

### Sync Module Loader

* **Leading `@`** loads a module synchronously:

  ```ts
  const User = $$("@./User.ts");      // default export
  const instance = User.new("Charl"); // sugar for new User()
  ```
* Named exports are attached as properties:

  ```ts
  $$("@./math.ts").sum(1,2);
  ```

### Path + Module Binding

```ts
$$("app.user@./User.ts").options({ type: "user" });
// now app.user behaves like a User instance + named exports
```

### Plugins vs Modules

* **Modules**: regular TS/JS modules, attached to a node.
* **Plugins**: modules that can **extend FX itself** (add globals, behaviors, effects). Managed by the PluginManager.

---

## 🔍 5. Selectors

FX supports **CSS-style selectors** for querying nodes:

| Selector           | Meaning                                       |
| ------------------ | --------------------------------------------- |
| `.user`            | node with `__type === "user"` or proto `user` |
| `[active=true]`    | node with property `active = true`            |
| `#1234`            | node with `__id = "1234"`                     |
| `:not(.bot)`       | node not matching `.bot`                      |
| `.parent > .child` | direct child                                  |
| `.parent .child`   | descendant                                    |

---

## 👥 6. Groups

A **Group** is a reactive collection of nodes.

### Manual Groups

```ts
const g = $$("myGroup").group(["path.one","path.two"]);
g.add("path.three").remove("path.one");
```

### CSS-Driven Groups

```ts
const activeUsers = $$("users").group([]).include(".user[active=true]");
```

### Mixed

```ts
const view = $$("views.index")
  .group([])
  .include(".function[exported=true]")
  .exclude(".deprecated")
  .add("manual.node");
```

### Group Operations

```ts
g.sum(); g.concat(" "); g.max(); g.min();
g.same("value"); g.sort("desc");
```

### Group Reactivity

```ts
g.on("change", list => console.log("Group changed:", list));
```

---

## 🔄 7. Reactivity & Binding

All reactivity is **implicit**:

```ts
$$("a").val($$("b"));   // a follows b reactively
$$("c").val($$("b").val()); // a snapshot, not reactive
```

When `b` changes, `a` updates automatically if you passed the node proxy itself.

---

## ⚙️ 8. Config & System

FX has runtime-tunable knobs:

```ts
$_$$("config.fx").set({
  selectors: { enableHas: true, attrResolution: ["type","child"] },
  groups: { reactiveDefault: true, debounceMs: 20 },
  performance: { enableParentMap: true }
});

$_$$("system.fx").set({
  performance: { structureBatchMs: 2 } // hot overrides
});
```

---

## 🧠 9. Philosophy

* **Node = Any Type.** A node can be a primitive, object, class, function, or nested FX tree.
* **Everything Reactive.** Values, groups, selectors, and even module bindings update live.
* **Sync API Surface.** Even with workers, SAB, or server proxying, devs never touch `await`.
* **Composable Views.** Groups + selectors = files, indexes, exports, etc.
* **Separation of Core vs Platform.** `fx.ts` is portable. FXD (desktop/FS layer) builds on top.

---

## 🚨 10. Gotchas

* `.val($$("b"))` gives reactivity, `.val($$("b").val())` does not.
* Groups are live by default; use `.reactive(false)` for snapshot mode.
* `.as(Class)` unwraps true instances; proxies are not instances.
* Leading `@` returns **default export directly**. Use `.ns` if you need the whole namespace.

---