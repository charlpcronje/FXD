/**
 * Example: Reactive Groups
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.5
 *
 * This example demonstrates reactive groups:
 * - Creating groups that automatically update
 * - Manual group membership (add, remove, insert)
 * - CSS-based group composition (include/exclude)
 * - Group events and listeners
 * - Group operations (sum, average, etc.)
 */

import { $$, $_$$, fx } from "../../fxn.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== Reactive Groups Demo ===\n");

// Step 1: Create a manual group with ordered members
console.log("Step 1: Creating a manual group");
const team = $$("teams.core").group();
team.add($$("users.alice"));
team.add($$("users.bob"));
team.add($$("users.charlie"));

$$("users.alice").val(100);
$$("users.bob").val(200);
$$("users.charlie").val(300);

console.log(`  Team members: ${team.list().length}`);
console.log(`  Team sum: ${team.sum()}`);

// Step 2: Add members with ordering
console.log("\nStep 2: Adding members with ordering");
$$("users.dave").val(150);
team.addAfter($$("users.alice"), $$("users.dave"));

console.log(`  After adding Dave after Alice:`);
team.list().forEach((member, idx) => {
    console.log(`    ${idx}: value=${member.val()}`);
});

// Step 3: Remove a member
console.log("\nStep 3: Removing a member");
team.remove($$("users.bob"));
console.log(`  After removing Bob:`);
console.log(`  Team members: ${team.list().length}`);
console.log(`  Team sum: ${team.sum()}`);

// Step 4: CSS-based group composition
console.log("\nStep 4: CSS-based group composition");

// Set up some nodes with types
$$("products.laptop").val(999);
$$("products.laptop").node().__type = "product";
($$("products.laptop").node() as any).__meta = { category: "electronics" };

$$("products.mouse").val(25);
$$("products.mouse").node().__type = "product";
($$("products.mouse").node() as any).__meta = { category: "electronics" };

$$("products.desk").val(299);
$$("products.desk").node().__type = "product";
($$("products.desk").node() as any).__meta = { category: "furniture" };

// Create a group using selectors
const electronics = $$("groups.electronics").group();
electronics.include('.product[category=electronics]');

console.log(`  Electronics group:`);
console.log(`    Members: ${electronics.list().length}`);
console.log(`    Total value: $${electronics.sum()}`);

// Step 5: Combining manual and selector-based groups
console.log("\nStep 5: Combining manual and selector-based groups");
const featured = $$("groups.featured").group();
featured.add($$("products.laptop"));  // Manual addition
featured.include('.product[category=furniture]');  // Plus all furniture

console.log(`  Featured products:`);
console.log(`    Members: ${featured.list().length}`);
console.log(`    Total value: $${featured.sum()}`);

// Step 6: Exclude pattern
console.log("\nStep 6: Using exclude to filter out items");
const allProducts = $$("groups.allProducts").group();
allProducts.include('.product');  // All products
allProducts.exclude('[category=furniture]');  // Except furniture

console.log(`  All products except furniture:`);
console.log(`    Members: ${allProducts.list().length}`);
console.log(`    Total value: $${allProducts.sum()}`);

// Step 7: Group operations
console.log("\nStep 7: Group operations");
const scores = $$("groups.scores").group();
$$("scores.test1").val(85);
$$("scores.test2").val(92);
$$("scores.test3").val(78);
scores.add($$("scores.test1"));
scores.add($$("scores.test2"));
scores.add($$("scores.test3"));

console.log(`  Test scores group:`);
console.log(`    Count: ${scores.list().length}`);
console.log(`    Sum: ${scores.sum()}`);
console.log(`    Average: ${scores.average()}`);
console.log(`    Max: ${scores.max()}`);
console.log(`    Min: ${scores.min()}`);
console.log(`    Sorted (asc): [${scores.sort("asc").join(", ")}]`);

// Step 8: Group events and reactivity
console.log("\nStep 8: Group events and reactivity");
const watchedGroup = $$("groups.watched").group();
$$("watched.a").val(10);
$$("watched.b").val(20);
watchedGroup.add($$("watched.a"));
watchedGroup.add($$("watched.b"));

let changeCount = 0;
watchedGroup.on("change", () => {
    changeCount++;
    console.log(`  Change event #${changeCount}: sum=${watchedGroup.sum()}, avg=${watchedGroup.average()}`);
});

console.log("  Modifying values (should trigger change events):");
$$("watched.a").val(15);
$$("watched.b").val(25);

// Give events time to fire
await new Promise(resolve => setTimeout(resolve, 100));

// Step 9: Conditional event handlers
console.log("\nStep 9: Conditional event handlers");
const temperatures = $$("groups.temperatures").group();
$$("temp.sensor1").val(20);
$$("temp.sensor2").val(22);
$$("temp.sensor3").val(21);
temperatures.add($$("temp.sensor1"));
temperatures.add($$("temp.sensor2"));
temperatures.add($$("temp.sensor3"));

temperatures.on("average", {
    greaterThan: 21,
    callback: (g: any, avg: number) => {
        console.log(`  ⚠️  Average temperature (${avg}°C) exceeded threshold!`);
    }
});

console.log("  Current average:", temperatures.average());

// Step 10: Clearing and rebuilding groups
console.log("\nStep 10: Clearing and rebuilding groups");
const dynamic = $$("groups.dynamic").group();
$$("items.x").val(1);
$$("items.y").val(2);
$$("items.z").val(3);
dynamic.add($$("items.x"));
dynamic.add($$("items.y"));
console.log(`  Initial size: ${dynamic.list().length}`);

dynamic.clear();
console.log(`  After clear: ${dynamic.list().length}`);

dynamic.add($$("items.z"));
console.log(`  After rebuild: ${dynamic.list().length}`);

console.log("\n=== Demo Complete! ===");
console.log("\nKey takeaways:");
console.log("• Use .group() to create reactive collections");
console.log("• Manual members: add(), remove(), insert(), addAfter()");
console.log("• CSS composition: include(), exclude()");
console.log("• Combine manual + CSS-based membership");
console.log("• Group operations: sum(), average(), max(), min(), sort()");
console.log("• Events: on('change'), conditional triggers");
console.log("• Reactive: groups update when members change");
