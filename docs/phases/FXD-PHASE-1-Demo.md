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
