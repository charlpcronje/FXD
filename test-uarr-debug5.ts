import { encodeUArr } from "./modules/fx-uarr.ts";

const str = "hello";
const encoded = encodeUArr(str);

console.log("Full buffer (hex):");
for (let i = 0; i < encoded.length; i += 16) {
  const chunk = Array.from(encoded.slice(i, Math.min(i + 16, encoded.length)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  const offset = String(i).padStart(3, ' ');
  console.log(offset + ": " + chunk);
}

// Parse header
const view = new DataView(encoded.buffer, encoded.byteOffset);
console.log("\n=== HEADER (32 bytes) ===");
console.log("  0-3:   Magic = 0x" + view.getUint32(0, true).toString(16));
console.log("  4-5:   Version = " + view.getUint16(4, true));
console.log("  6-7:   Flags = " + view.getUint16(6, true));
console.log("  8-11:  Field count = " + view.getUint32(8, true));
console.log(" 12-15:  Schema offset = " + view.getUint32(12, true));
console.log(" 16-19:  Data offset = " + view.getUint32(16, true));
console.log(" 20-27:  Total bytes = " + view.getBigUint64(20, true));
console.log(" 28-35:  Name table offset = " + view.getBigUint64(28, true));

console.log("\n=== FIELD DESCRIPTOR (24 bytes starting at 32) ===");
let off = 32;
console.log(off + "-" + (off+7) + ":   Name hash = 0x" + view.getBigUint64(off, true).toString(16)); off += 8;
console.log(off + ":     Type tag = " + view.getUint8(off)); off += 1;
console.log(off + ":     Flags = " + view.getUint8(off)); off += 1;
console.log(off + "-" + (off+1) + ":   Reserved = " + view.getUint16(off, true)); off += 2;
console.log(off + "-" + (off+3) + ":   Offset = " + view.getUint32(off, true)); off += 4;
console.log(off + "-" + (off+3) + ":   Length = " + view.getUint32(off, true)); off += 4;

console.log("\n=== NAME TABLE (starting at 56) ===");
const nameTableOff = 56;
const nameLen = view.getUint32(nameTableOff, true);
console.log(nameTableOff + "-" + (nameTableOff+3) + ": Name length = " + nameLen);
const decoder = new TextDecoder();
const nameBytes = encoded.slice(nameTableOff + 4, nameTableOff + 4 + nameLen);
console.log((nameTableOff+4) + "-" + (nameTableOff+3+nameLen) + ': Name = "' + decoder.decode(nameBytes) + '"');

console.log("\n=== DATA (starting at 67) ===");
const dataOff = 67;
if (dataOff < encoded.length) {
  const strLen = view.getUint32(dataOff, true);
  console.log(dataOff + "-" + (dataOff+3) + ": String length = " + strLen);
  const strBytes = encoded.slice(dataOff + 4, Math.min(dataOff + 4 + strLen, encoded.length));
  console.log((dataOff+4) + "-" + (dataOff+3+strLen) + ': String = "' + decoder.decode(strBytes) + '"');
}
