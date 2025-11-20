import { encodeUArr, decodeUArr } from "./modules/fx-uarr.ts";

const str = "hello";
const encoded = encodeUArr(str);

const view = new DataView(encoded.buffer, encoded.byteOffset);

console.log("Buffer length:", encoded.length);
console.log("Data offset from header:", view.getUint32(16, true));

// Read field descriptor
const fieldDescOffset = 32; // schema offset
console.log("\nField descriptor at", fieldDescOffset);
const nameHash = view.getBigUint64(fieldDescOffset, true);
const typeTag = view.getUint8(fieldDescOffset + 8);
const flags = view.getUint8(fieldDescOffset + 9);
const fieldDataOffset = view.getUint32(fieldDescOffset + 12, true);
const length = view.getUint32(fieldDescOffset + 16, true);

console.log("  Type tag:", typeTag, "(should be 16 for STRING_UTF8)");
console.log("  Field data offset:", fieldDataOffset);
console.log("  Length:", length);

const dataOffset = view.getUint32(16, true);
const actualReadOffset = dataOffset + fieldDataOffset;
console.log("\nWill try to read at:", actualReadOffset, "(dataOffset", dataOffset, "+ fieldDataOffset", fieldDataOffset, ")");
console.log("Buffer has", encoded.length, "bytes");
console.log("Can read?", actualReadOffset < encoded.length);

if (actualReadOffset + 4 <= encoded.length) {
  const strLength = view.getUint32(actualReadOffset, true);
  console.log("String length prefix:", strLength);
  
  if (actualReadOffset + 4 + strLength <= encoded.length) {
    const decoder = new TextDecoder();
    const strBytes = encoded.slice(actualReadOffset + 4, actualReadOffset + 4 + strLength);
    console.log("String value:", decoder.decode(strBytes));
  } else {
    console.log("ERROR: Not enough bytes for string data");
  }
} else {
  console.log("ERROR: Cannot even read length prefix at offset", actualReadOffset);
}
