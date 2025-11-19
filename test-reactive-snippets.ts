// Test Reactive Snippets
import { $$, $_$$ } from "./fxn.ts";
import { createReactiveSnippet, getSnippetParams, getSnippetResult } from "./modules/fx-reactive-snippets.ts";

globalThis.$$ = $$;
globalThis.$_$$ = $_$$;

console.log("=== Reactive Snippets Demo ===\n");

// Example 1: Simple add function
console.log("1. Simple add function with reactive params:");

// Create reactive snippet
createReactiveSnippet("calc.add", function add(a, b) {
  console.log(`  [add executing] a=${a}, b=${b}`);
  return a + b;
}, {
  id: "add-fn",
  params: {
    a: "inputs.num1",
    b: "inputs.num2"
  },
  output: "outputs.sum",
  reactive: true,  // Auto-execute when inputs change
  debounce: 50     // Wait 50ms to coalesce changes
});

console.log("   Created reactive snippet 'calc.add'");

// Set input values
console.log("\n   Setting inputs.num1 = 10...");
$$("inputs.num1").val(10);

await new Promise(resolve => setTimeout(resolve, 100));

console.log("   Setting inputs.num2 = 5...");
$$("inputs.num2").val(5);

await new Promise(resolve => setTimeout(resolve, 100));

console.log(`   Result: outputs.sum = ${$$("outputs.sum").val()}`);
console.log(`   Params captured: ${JSON.stringify(getSnippetParams("calc.add"))}`);

// Example 2: Multiply with transform
console.log("\n2. Multiply function with parameter transform:");

createReactiveSnippet("calc.multiply", function multiply(x, y) {
  console.log(`  [multiply executing] x=${x}, y=${y}`);
  return x * y;
}, {
  id: "mul-fn",
  params: {
    x: {
      external: "inputs.stringNum",
      transform: (val: string) => Number(val)  // Convert string to number!
    },
    y: "inputs.multiplier"
  },
  output: "outputs.product",
  reactive: true
});

console.log("\n   Setting inputs.stringNum = '20' (as string)...");
$$("inputs.stringNum").val("20");

await new Promise(resolve => setTimeout(resolve, 100));

console.log("   Setting inputs.multiplier = 3...");
$$("inputs.multiplier").val(3);

await new Promise(resolve => setTimeout(resolve, 100));

console.log(`   Result: outputs.product = ${$$("outputs.product").val()}`);
console.log(`   Note: String '20' was transformed to number 20!`);

// Example 3: Chained snippets (composition!)
console.log("\n3. Chained calculation (formula using add and multiply):");

createReactiveSnippet("calc.formula", function formula(n) {
  console.log(`  [formula executing] n=${n}`);
  // This will need add and multiply results as inputs!
  const addResult = this.addValue;
  const mulResult = this.mulValue;
  console.log(`    addResult=${addResult}, mulResult=${mulResult}`);
  return addResult + mulResult;
}, {
  id: "formula-fn",
  params: {
    n: "data.input",
    addValue: "outputs.sum",       // Depends on calc.add!
    mulValue: "outputs.product"    // Depends on calc.multiply!
  },
  output: "data.finalResult",
  reactive: true,
  debounce: 100
});

console.log("\n   Waiting for add and multiply to complete...");
await new Promise(resolve => setTimeout(resolve, 200));

console.log(`   Final result: data.finalResult = ${$$("data.finalResult").val()}`);
console.log(`   Calculation: sum(${$$("inputs.num1").val()},${$$("inputs.num2").val()}) + product(${$$("inputs.stringNum").val()},${$$("inputs.multiplier").val()})`);
console.log(`   = ${$$("outputs.sum").val()} + ${$$("outputs.product").val()} = ${$$("data.finalResult").val()}`);

// Example 4: toString prototype
console.log("\n4. Code reconstruction via toString:");
const addNode = $$("calc.add").node();
console.log("   calc.add.toString():");
console.log("   " + addNode.toString?.().split('\n').join('\n   '));

// Example 5: Manual execution
console.log("\n5. Manual execution (non-reactive snippet):");

createReactiveSnippet("calc.divide", function divide(a, b) {
  if (b === 0) return NaN;
  return a / b;
}, {
  id: "div-fn",
  params: {
    a: "inputs.dividend",
    b: "inputs.divisor"
  },
  output: "outputs.quotient",
  reactive: false  // Manual execution only!
});

$$("inputs.dividend").val(100);
$$("inputs.divisor").val(4);

await new Promise(resolve => setTimeout(resolve, 50));

console.log(`   Before execute: outputs.quotient = ${$$("outputs.quotient").val()}`);

// Manually execute
const executeFn = $$("calc.divide.execute").val();
if (typeof executeFn === 'function') {
  const result = executeFn();
  console.log(`   After execute: outputs.quotient = ${$$("outputs.quotient").val()}`);
}

console.log("\n✅ All reactive snippet tests complete!");
console.log("\nCleanup...");

// Clean up debug files
try { Deno.removeSync("test-atomics-debug.ts"); } catch {}
try { Deno.removeSync("test-atomics-basic.ts"); } catch {}
