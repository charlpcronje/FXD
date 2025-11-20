(globalThis as any).DEBUG_UARR = true;

import { encodeUArr, decodeUArr } from "./modules/fx-uarr.ts";

const str = "hello";
console.log("=== ENCODING ===");
const encoded = encodeUArr(str);

console.log("\n=== DECODING ===");
try {
  const decoded = decodeUArr(encoded);
  console.log("Success!", decoded);
} catch (e: any) {
  console.error("Failed:", e.message);
}
