import { encodeUArr, decodeUArr } from "./modules/fx-uarr.ts";

// Test simple number
const num = 42;
console.log("Encoding:", num);

const encoded = encodeUArr(num);
console.log("Encoded buffer length:", encoded.length);
console.log("First 64 bytes:", Array.from(encoded.slice(0, Math.min(64, encoded.length))).map(b => b.toString(16).padStart(2, '0')).join(' '));

const view = new DataView(encoded.buffer, encoded.byteOffset);
console.log("\nHeader:");
console.log("  Magic:", view.getUint32(0, true).toString(16));
console.log("  Version:", view.getUint16(4, true));
console.log("  Flags:", view.getUint16(6, true));
console.log("  Field count:", view.getUint32(8, true));
console.log("  Schema offset:", view.getUint32(12, true));
console.log("  Data offset:", view.getUint32(16, true));
console.log("  Total bytes:", Number(view.getBigUint64(20, true)));
console.log("  Name table offset:", Number(view.getBigUint64(28, true)));

try {
  const decoded = decodeUArr(encoded);
  console.log("\nDecoded:", decoded);
  console.log("Match:", decoded === num);
} catch (e: any) {
  console.error("\nDecode error:", e.message);
}
