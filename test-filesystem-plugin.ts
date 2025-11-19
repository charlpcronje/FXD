// Test fx-filesystem plugin
import { $$, $_$$ } from "./fxn.ts";
import { loadFilesystemPlugin } from "./plugins/fx-filesystem.ts";

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== FX Filesystem Plugin Test ===\n");

// Load plugin
console.log("1. Loading filesystem plugin...");
const fs = await loadFilesystemPlugin({
  baseDir: "./test-ramdisk",
  verbose: true,
  syncInterval: 0  // Immediate sync
});

console.log(`   Stats: ${JSON.stringify(fs.stats(), null, 2)}`);

// Create some test nodes
console.log("\n2. Creating test nodes...");
$$("app.name").val("FXD Test App");
$$("app.version").val("1.0.0");
$$("data.count").val(42);

console.log("   Nodes created");

// Wait for sync
await new Promise(resolve => setTimeout(resolve, 200));

// Check filesystem
console.log("\n3. Checking filesystem...");
try {
  const appNameValue = await Deno.readTextFile("./test-ramdisk/app/name/value.fxval");
  console.log(`   app.name on disk: "${appNameValue}"`);

  const appNameMeta = await Deno.readTextFile("./test-ramdisk/app/name/.fxmeta");
  console.log(`   app.name metadata: ${appNameMeta.substring(0, 100)}...`);

  const dataCount = await Deno.readTextFile("./test-ramdisk/data/count/value.fxval");
  console.log(`   data.count on disk: "${dataCount}"`);
} catch (error) {
  console.error("   Error reading files:", error.message);
}

// Test external change (simulate another app changing the file)
console.log("\n4. Simulating external change...");
try {
  await Deno.writeTextFile("./test-ramdisk/data/count/value.fxval", "100");
  console.log("   Wrote '100' to data/count/value.fxval");

  // Wait for watch to detect and sync
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log(`   data.count in FX: ${$$("data.count").val()}`);
  console.log(`   Expected: 100 (synced from filesystem)`);
} catch (error) {
  console.error("   Error:", error.message);
}

// Cleanup
console.log("\n5. Cleanup...");
fs.destroy();

try {
  await Deno.remove("./test-ramdisk", { recursive: true });
  console.log("   Removed test-ramdisk");
} catch {}

console.log("\n✅ Filesystem plugin test complete!");
