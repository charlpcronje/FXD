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
