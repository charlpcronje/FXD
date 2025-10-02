#!/usr/bin/env -S deno run --allow-all
/**
 * Quick FXD Demo - Working with FX Nodes
 */

import { $, $$ } from "./fx.ts";

console.log("🚀 FXD Quick Demo - Creating FX Nodes\n");

// Basic node creation and values
console.log("1️⃣ Creating basic nodes:");
$$("user").val({ name: "Alice", age: 30, role: "developer" });
console.log("   User:", $$("user").val());

$$("config").set({ port: 4000, host: "localhost", debug: true });
console.log("   Config:", $$("config").get());

// Nested nodes
console.log("\n2️⃣ Creating nested structure:");
$$("app.database.host").val("localhost");
$$("app.database.port").val(5432);
$$("app.database.name").val("myapp");
console.log("   Database config:", $$("app.database").val());

// Working with arrays
console.log("\n3️⃣ Working with collections:");
$$("users").val([
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" }
]);
console.log("   Users:", $$("users").val());

// Node paths
console.log("\n4️⃣ Node paths and hierarchy:");
console.log("   app.database path:", $$("app.database").node?.__path);
console.log("   app.database.port value:", $$("app.database.port").val());

// Using $val helper
console.log("\n5️⃣ Using helper functions:");
import { $val, $set, $get, $has } from "./fx.ts";
$set("theme", "dark");
console.log("   Theme:", $get("theme"));
console.log("   Has theme?", $has("theme"));
console.log("   Has missing?", $has("missing.value"));

console.log("\n✅ Demo Complete!");
console.log("\n💡 To start the server with visualization:");
console.log("   FX_SERVE=true deno run --allow-all server/fxd-demo-simple.ts --port 4401");
console.log("   Then open: http://localhost:4401");
console.log("\n💡 Or try the simple server:");
console.log("   deno run --allow-all server/dev.ts");
