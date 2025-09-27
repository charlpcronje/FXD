Sure thing! Here’s the lowdown on how **Web Workers are used in Deno 2**, based on the official documentation and insights from the wider community — no fluff, just what matters.

---

## Web Workers in Deno 2 — What They Are and How to Use Them

### 1. **Dedicated (Module-Type) Workers Only**

Deno supports only **dedicated workers**, not SharedWorkers or ServiceWorkers. You create and use them via the standard Web Worker API using the `new Worker(url, { type: "module" })` syntax.([Deno][1], [Stack Overflow][2])

#### Example:

**worker.ts**

```ts
self.onmessage = async (e) => {
  const { filename } = e.data;
  const text = await Deno.readTextFile(filename);
  console.log(text);
  self.close();
};
```

**main.ts**

```ts
const worker = new Worker(
  new URL("./worker.ts", import.meta.url).href,
  { type: "module" },
);
worker.postMessage({ filename: "./log.txt" });
```

By default, workers inherit the permissions of the parent thread.([Deno][1]) To restrict permissions, you can provide overrides:

```ts
const worker2 = new Worker(
  new URL("./worker.ts", import.meta.url).href,
  {
    type: "module",
    deno: {
      permissions: {
        read: [
          new URL("./file_1.txt", import.meta.url),
          new URL("./file_2.txt", import.meta.url),
        ],
      },
    },
  },
);
```

This will cause permission errors if the worker tries to access files not permitted.([Deno][1])

---

### 2. **API & Communication Fundamentals**

Workers in Deno mirror the standard Web Worker API:

* **Creating Workers:**

  ```ts
  const worker = new Worker(new URL("./worker.ts", import.meta.url).href, {
    type: "module",
  });
  ```

* **Main Thread → Worker:**

  ```ts
  worker.postMessage({ command: "start", data: [...] });
  ```

* **Worker → Main Thread:**

  ```ts
  self.postMessage(result);
  ```

* **Listening for Responses & Errors:**

  ```ts
  worker.onmessage = (e) => { console.log("Result:", e.data); worker.terminate(); };
  worker.onerror = (e) => { console.error("Error:", e.message); };
  ```

([Deno][3])

This model works in both directions: parent and worker can send messages to each other.([Medium][4], [Deno][3])

---

### 3. **Runtime Behavior & Threading Model**

Deno operates in a single main JavaScript thread, but when you spawn Web Workers, each runs in its **own V8 instance**, with its **own event loop** and separate **Tokio runtime**.([Choubey][5])

This isolation ensures that heavy computational tasks don’t block the main thread, making your application more responsive and performant.

---

### 4. **Limitations & Gotchas**

* **No SharedWorkers or ServiceWorkers** — only dedicated workers are supported.([Stack Overflow][2])
* Inside a worker, you can’t use browser globals like `window`; use `self` or `globalThis` instead.([Stack Overflow][6])

---

### 5. **When & Why to Use Workers**

Use Web Workers in Deno for:

* CPU-intensive work (e.g., data crunching, encryption)
* Parallel processing without blocking the main thread
* Managing workloads concurrently in granular isolation([Deno][3], [Choubey][5], [Medium][4])

Just keep in mind that spawning a worker has overhead — it's ideal for tasks that benefit from parallelization.

---

## Summary Table

| Feature                       | Details                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| **Type of Workers Supported** | Only dedicated (module-type) workers                                |
| **API Used**                  | `new Worker(url, { type: "module", deno: { permissions… }})`        |
| **Messaging**                 | `postMessage`, `onmessage`, `onerror`, `terminate()`                |
| **Permissions Handling**      | Inherited by default, or explicitly scoped via `deno.permissions`   |
| **Runtime Architecture**      | Separate V8 and Tokio runtime per worker, isolated from main thread |
| **Limitations**               | No SharedWorker; no `window` in worker context                      |

---

If you’d like, we can dive into advanced topics next—like managing a pool of workers, orchestrating tasks across workers efficiently, or exploring how to handle errors gracefully across isolated threads. Just say the word, and let's build something wild together.

Happy to help with code snippets, real-world patterns, or quirky edge cases—whatever fits your current mode.

[1]: https://docs.deno.com/examples/web_workers/?utm_source=chatgpt.com "Web workers"
[2]: https://stackoverflow.com/questions/67163326/deno-web-worker-api-sharedworker?utm_source=chatgpt.com "Deno Web Worker API - SharedWorker"
[3]: https://docs.deno.com/api/web/~/Worker?utm_source=chatgpt.com "Worker - Workers - Web documentation"
[4]: https://medium.com/deno-the-complete-reference/communicate-with-workers-in-deno-5ca5381e5979?utm_source=chatgpt.com "Communicate with workers in Deno | Tech Tonic"
[5]: https://choubey.gitbook.io/internals-of-deno/threading-model/default-threads?utm_source=chatgpt.com "3.2 Default threading model - The Internals of Deno - GitBook"
[6]: https://stackoverflow.com/questions/62231656/deno-web-workers-cannot-find-name-window?utm_source=chatgpt.com "Deno web workers - Cannot find name \"window\""
