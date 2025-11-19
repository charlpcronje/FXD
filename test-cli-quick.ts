// Quick test of CLI save/load
import { $$, $_$$ } from "./fxn.ts";
import { createSnippet } from "./modules/fx-snippets.ts";

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

// Create some test data
$$("app.name").val("Test CLI Project");
createSnippet("code.test", "function test() { return 42; }", {
  id: "test-fn",
  lang: "js"
});

console.log("Created test data");
console.log(`  App name: ${$$("app.name").val()}`);
console.log(`  Snippet: ${$$("code.test").val()}`);
