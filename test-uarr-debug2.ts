import { encodeUArr, decodeUArr } from "./modules/fx-uarr.ts";

// Test string
const str = "hello";
console.log("Encoding:", str);

const encoded = encodeUArr(str);
console.log("Encoded buffer length:", encoded.length);

const view = new DataView(encoded.buffer, encoded.byteOffset);
console.log("\nHeader:");
console.log("  Field count:", view.getUint32(8, true));
console.log("  Data offset:", view.getUint32(16, true));
console.log("  Name table offset:", Number(view.getBigUint64(28, true)));

try {
  const decoded = decodeUArr(encoded);
  console.log("\nDecoded:", decoded);
  console.log("Match:", decoded === str);
} catch (e: any) {
  console.error("\nDecode error:", e.message);
  const fieldCount = view.getUint32(8, true);
  const nameTableOffset = Number(view.getBigUint64(28, true));
  console.log("\nAttempting to read field name manually:");
  console.log("  Name table at:", nameTableOffset);
  const nameLength = view.getUint32(nameTableOffset, true);
  console.log("  Name length:", nameLength);
  const decoder = new TextDecoder();
  const nameBytes = encoded.slice(nameTableOffset + 4, nameTableOffset + 4 + nameLength);
  console.log("  Name:", decoder.decode(nameBytes));
}
