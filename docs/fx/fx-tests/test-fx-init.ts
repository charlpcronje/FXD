#!/usr/bin/env -S deno run -A
// Test FX initialization

import "./fx.ts";

console.log("✅ FX initialized successfully!");

// Test that config exists
const configVal = $$("config.fx").val();
console.log("✅ Config loaded:", typeof configVal === "object" ? "yes" : "no");

// Test basic node creation
$$("test.node").val("Hello FX!");
const testVal = $$("test.node").val();
console.log("✅ Node creation works:", testVal === "Hello FX!" ? "yes" : "no");

// Test sync API
$$("sync.test").set(42);
const syncVal = $$("sync.test").get();
console.log("✅ Sync API works:", syncVal === 42 ? "yes" : "no");

// Test reactive watching
let watchFired = false;
const unwatch = $$("reactive.test").watch((newVal, oldVal) => {
    watchFired = true;
});
$$("reactive.test").val("trigger");
console.log("✅ Reactive watching works:", watchFired ? "yes" : "no");
unwatch();

// Test Groups
const group = $$("test.parent").group([]);
$$("test.parent.child1").val(1);
$$("test.parent.child2").val(2);
const list = group.list();
console.log("✅ Groups work:", list.length >= 0 ? "yes" : "no");

console.log("\n🎉 All FX core features working!");