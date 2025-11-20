// Test the wrapping logic
const value = "hello";

console.log("Original value:", value);
console.log("typeof:", typeof value);
console.log("Is object?", typeof value === 'object');
console.log("Is null?", value === null);
console.log("Is array?", Array.isArray(value));

let wrapped = value;
if (typeof wrapped !== 'object' || wrapped === null || Array.isArray(wrapped)) {
  console.log("\nWill wrap as { __value: value }");
  wrapped = { __value: value };
}

console.log("Wrapped:", wrapped);
console.log("Fields:", Object.entries(wrapped));

for (const [name, fieldValue] of Object.entries(wrapped)) {
  console.log(`\nField "${name}":`, fieldValue);
  console.log("  typeof:", typeof fieldValue);
  
  // Detect type tag
  if (fieldValue === null) console.log("  -> NULL");
  else if (fieldValue === undefined) console.log("  -> UNDEFINED");
  else if (typeof fieldValue === 'boolean') console.log("  -> BOOL");
  else if (typeof fieldValue === 'string') console.log("  -> STRING_UTF8 (16)");
  else if (typeof fieldValue === 'number') {
    if (Number.isInteger(fieldValue)) {
      if (fieldValue >= -128 && fieldValue <= 127) console.log("  -> I8 (0)");
      else console.log("  -> I16/I32/I64");
    } else {
      console.log("  -> F64 (9)");
    }
  }
  else if (Array.isArray(fieldValue)) console.log("  -> ARRAY");
  else if (typeof fieldValue === 'object') console.log("  -> MAP");
}
