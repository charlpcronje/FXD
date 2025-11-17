/**
 * Example: Selector Demo
 * @agent: agent-examples
 * @timestamp: 2025-10-02
 * @task: TRACK-D-EXAMPLES.md#D.4
 *
 * This example demonstrates CSS-like selectors for querying nodes:
 * - ID selectors (#id)
 * - Class selectors (.class)
 * - Attribute selectors [key=value]
 * - Combining selectors
 * - Using select() to create groups
 */

import { $$, $_$$, fx } from "../../fxn.ts";

// Setup
globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== Selector Demo ===\n");

// Step 1: Set up test data with different types and metadata
console.log("Step 1: Creating test nodes with metadata");

// Create some user nodes
$$("users.alice").val({ name: "Alice", age: 30 });
$$("users.alice").node().__type = "user";
($$("users.alice").node() as any).__meta = { role: "admin", active: "true" };

$$("users.bob").val({ name: "Bob", age: 25 });
$$("users.bob").node().__type = "user";
($$("users.bob").node() as any).__meta = { role: "user", active: "true" };

$$("users.charlie").val({ name: "Charlie", age: 35 });
$$("users.charlie").node().__type = "user";
($$("users.charlie").node() as any).__meta = { role: "user", active: "false" };

// Create some product nodes
$$("products.laptop").val({ name: "Laptop", price: 999 });
$$("products.laptop").node().__type = "product";
($$("products.laptop").node() as any).__meta = { category: "electronics", stock: "50" };

$$("products.mouse").val({ name: "Mouse", price: 25 });
$$("products.mouse").node().__type = "product";
($$("products.mouse").node() as any).__meta = { category: "electronics", stock: "100" };

$$("products.desk").val({ name: "Desk", price: 299 });
$$("products.desk").node().__type = "product";
($$("products.desk").node() as any).__meta = { category: "furniture", stock: "10" };

console.log("  Created 3 users and 3 products");

// Step 2: Select by type (class selector)
console.log("\nStep 2: Selecting by type (.user)");
const users = $_$$("").select(".user");  // Search from root
const userList = users.list();
console.log(`  Found ${userList.length} users:`);
userList.forEach(u => {
    const val = u.val();
    console.log(`    - ${val?.name || 'unknown'} (age: ${val?.age})`);
});

// Step 3: Select by attribute
console.log("\nStep 3: Selecting by attribute ([active=true])");
const activeUsers = $_$$("").select('[active=true]');
const activeList = activeUsers.list();
console.log(`  Found ${activeList.length} active users:`);
activeList.forEach(u => {
    const val = u.val();
    console.log(`    - ${val?.name || 'unknown'}`);
});

// Step 4: Select products by category
console.log("\nStep 4: Selecting products by category ([category=electronics])");
const electronics = $_$$("").select('[category=electronics]');
const electronicsList = electronics.list();
console.log(`  Found ${electronicsList.length} electronics:`);
electronicsList.forEach(p => {
    const val = p.val();
    console.log(`    - ${val?.name}: $${val?.price}`);
});

// Step 5: Combine type and attribute selectors
console.log("\nStep 5: Combining selectors (.user[role=admin])");
const admins = $_$$("").select('.user[role=admin]');
const adminList = admins.list();
console.log(`  Found ${adminList.length} admin users:`);
adminList.forEach(u => {
    const val = u.val();
    console.log(`    - ${val?.name || 'unknown'}`);
});

// Step 6: Select by ID (though less common in group selections)
console.log("\nStep 6: Direct node access and metadata inspection");
const alice = $$("users.alice");
const aliceNode = alice.node();
const aliceMeta = (aliceNode as any).__meta;
console.log(`  Node: users.alice`);
console.log(`    Type: ${aliceNode.__type}`);
console.log(`    Meta: ${JSON.stringify(aliceMeta)}`);
console.log(`    Value: ${JSON.stringify(alice.val())}`);

// Step 7: Attribute operators
console.log("\nStep 7: Attribute operators (^=, $=, *=)");

// Create some tagged nodes
$$("items.item1").val("data");
($$("items.item1").node() as any).__meta = { tag: "prefix-test" };

$$("items.item2").val("data");
($$("items.item2").node() as any).__meta = { tag: "test-suffix" };

$$("items.item3").val("data");
($$("items.item3").node() as any).__meta = { tag: "contains-test-word" };

// Starts with (^=)
console.log("  Selecting [tag^=prefix] (starts with 'prefix'):");
const prefixItems = $_$$("").select('[tag^=prefix]');
console.log(`    Found ${prefixItems.list().length} items`);

// Ends with ($=)
console.log("  Selecting [tag$=suffix] (ends with 'suffix'):");
const suffixItems = $_$$("").select('[tag$=suffix]');
console.log(`    Found ${suffixItems.list().length} items`);

// Contains (*=)
console.log("  Selecting [tag*=test] (contains 'test'):");
const containsItems = $_$$("").select('[tag*=test]');
console.log(`    Found ${containsItems.list().length} items`);

// Step 8: Using groups for calculations
console.log("\nStep 8: Using groups for calculations");
const allProducts = $$("products").select(".product");
const prices = allProducts.list().map(p => p.val()?.price || 0);
const totalValue = allProducts.sum();
console.log(`  Total value of all products: $${prices.reduce((a, b) => a + b, 0)}`);
console.log(`  Number of products: ${allProducts.list().length}`);

// Step 9: Not selector
console.log("\nStep 9: Using :not() selector");
const nonAdmins = $_$$("").select('.user:not([role=admin])');
const nonAdminList = nonAdmins.list();
console.log(`  Found ${nonAdminList.length} non-admin users:`);
nonAdminList.forEach(u => {
    const val = u.val();
    console.log(`    - ${val?.name || 'unknown'}`);
});

console.log("\n=== Demo Complete! ===");
console.log("\nKey takeaways:");
console.log("• Use .select(selector) to query nodes");
console.log("• .class matches __type and __proto");
console.log("• [attr=value] queries node metadata");
console.log("• Operators: = (exact), ^= (starts), $= (ends), *= (contains)");
console.log("• Combine selectors for powerful queries");
console.log("• Use groups for aggregation (sum, count, etc.)");
console.log("• :not() excludes matching nodes");
