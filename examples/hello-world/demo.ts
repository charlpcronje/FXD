/**
 * Example: Hello World
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.2
 *
 * This is the simplest introduction to FXD. It demonstrates:
 * - Creating and accessing nodes
 * - Setting and getting values
 * - Basic proxy navigation
 */

import { $$, $_$$, fx } from "../../fxn.ts";

// Setup globals
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== FXD Hello World ===\n");

// Step 1: Create a simple node with a value
console.log("Step 1: Creating a node with a value");
$$("greeting").val("Hello, FXD!");
console.log(`  $$("greeting").val() => "${$$("greeting").val()}"`);

// Step 2: Create nested nodes
console.log("\nStep 2: Creating nested nodes");
$$("user.name").val("Alice");
$$("user.age").val(30);
console.log(`  $$("user.name").val() => "${$$("user.name").val()}"`);
console.log(`  $$("user.age").val() => ${$$("user.age").val()}`);

// Step 3: Working with objects
console.log("\nStep 3: Setting an entire object");
$$("config").val({
    theme: "dark",
    language: "en",
    notifications: true
});
console.log(`  $$("config.theme").val() => "${$$("config.theme").val()}"`);
console.log(`  $$("config.language").val() => "${$$("config.language").val()}"`);
console.log(`  $$("config.notifications").val() => ${$$("config.notifications").val()}`);

// Step 4: Type conversions
console.log("\nStep 4: Type conversions");
$$("numbers.pi").val("3.14159");
console.log(`  $$("numbers.pi").str() => "${$$("numbers.pi").str()}" (string)`);
console.log(`  $$("numbers.pi").num() => ${$$("numbers.pi").num()} (number)`);
console.log(`  $$("numbers.pi").bool() => ${$$("numbers.pi").bool()} (boolean)`);

// Step 5: Default values
console.log("\nStep 5: Using default values");
const missing = $$("nonexistent").get("default value");
console.log(`  $$("nonexistent").get("default value") => "${missing}"`);

// Step 6: Watching for changes
console.log("\nStep 6: Watching for changes");
let changeCount = 0;
const unwatch = $$("counter").watch((newVal, oldVal) => {
    changeCount++;
    console.log(`  Change #${changeCount}: ${oldVal} → ${newVal}`);
});

$$("counter").val(1);
$$("counter").val(2);
$$("counter").val(3);

// Clean up watcher
unwatch();

console.log("\n=== Demo Complete! ===");
console.log("\nKey takeaways:");
console.log("• Use $$('path') to access/create nodes");
console.log("• Use .val() to get/set values");
console.log("• Use .str(), .num(), .bool() for type conversions");
console.log("• Use .watch() to observe changes");
console.log("• Use .get(default) for safe access with fallbacks");
