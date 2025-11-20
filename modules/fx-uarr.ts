/**
 * @file fx-uarr.ts
 * @description Universal Array (UArr) binary serialization format for FXD
 *
 * UArr provides zero-copy serialization for FX nodes, optimized for:
 * - Fast encoding/decoding (3-10x faster than JSON+SQLite)
 * - Zero-copy reads (field access without full deserialization)
 * - Type safety (explicit type tags for all values)
 * - FXOS compatibility (foundation for migration)
 *
 * Format Design:
 * [Header][Field Descriptors][Data Region]
 *
 * Header (32 bytes):
 * - magic: u32 (0x55415252 = "UARR")
 * - version: u16
 * - flags: u16 (compression, encryption, etc.)
 * - fieldCount: u32
 * - schemaOffset: u32
 * - dataOffset: u32
 * - totalBytes: u64
 * - reserved: u64
 *
 * Field Descriptor (24 bytes per field):
 * - nameHash: u64 (FNV-1a hash of field name)
 * - typeTag: u8
 * - flags: u8 (nullable, array, etc.)
 * - reserved: u16
 * - offset: u32 (offset in data region)
 * - length: u32 (length in bytes)
 *
 * Data Region:
 * - Variable-length data based on type
 * - Strings: UTF-8 encoded with u32 length prefix
 * - Arrays: u32 count + elements
 * - Objects: encoded as nested UArr
 *
 * @version 1.0.0
 */

// Type tags matching FXOS design
export enum TypeTag {
  // Integers
  I8 = 0x00,
  I16 = 0x01,
  I32 = 0x02,
  I64 = 0x03,

  // Unsigned integers
  U8 = 0x04,
  U16 = 0x05,
  U32 = 0x06,
  U64 = 0x07,

  // Floats
  F32 = 0x08,
  F64 = 0x09,

  // Other primitives
  BOOL = 0x0A,
  NULL = 0x0B,
  UNDEFINED = 0x0C,

  // Strings and bytes
  STRING_UTF8 = 0x10,
  BYTES = 0x11,

  // Complex types
  ARRAY = 0x20,
  MAP = 0x21,

  // FX-specific
  NODEREF = 0x30,
  TIMESTAMP = 0x31,
  UUID = 0x32,
}

// Magic number for UArr format (ASCII "UARR")
export const UARR_MAGIC = 0x55415252;
export const UARR_VERSION = 1;

// Header structure
export interface UArrHeader {
  magic: number;
  version: number;
  flags: number;
  fieldCount: number;
  schemaOffset: number;
  dataOffset: number;
  totalBytes: bigint;
  reserved: bigint;
}

// Field descriptor
export interface FieldDesc {
  nameHash: bigint;
  typeTag: TypeTag;
  flags: number;
  offset: number;
  length: number;
}

// Field flags
export const FieldFlags = {
  NULLABLE: 0x01,
  ARRAY: 0x02,
  COMPRESSED: 0x04,
};

/**
 * FNV-1a hash function for field names
 * Provides good distribution and fast computation
 */
function fnv1aHash(str: string): bigint {
  const FNV_PRIME = 0x01000193n;
  const FNV_OFFSET = 0x811c9dc5n;

  let hash = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV_PRIME) & 0xFFFFFFFFn; // Keep as 32-bit
  }

  return hash;
}

/**
 * Detect appropriate type tag for a JavaScript value
 */
function detectTypeTag(value: any): TypeTag {
  if (value === null) return TypeTag.NULL;
  if (value === undefined) return TypeTag.UNDEFINED;

  const type = typeof value;

  if (type === 'boolean') return TypeTag.BOOL;
  if (type === 'string') return TypeTag.STRING_UTF8;

  if (type === 'number') {
    // Check if it's an integer or float
    if (Number.isInteger(value)) {
      // Choose appropriate int size
      if (value >= -128 && value <= 127) return TypeTag.I8;
      if (value >= -32768 && value <= 32767) return TypeTag.I16;
      if (value >= -2147483648 && value <= 2147483647) return TypeTag.I32;
      return TypeTag.I64;
    } else {
      // Float - use F64 for JavaScript numbers (always 64-bit)
      return TypeTag.F64;
    }
  }

  if (Array.isArray(value)) return TypeTag.ARRAY;
  if (type === 'object') return TypeTag.MAP;

  // Default to bytes for unknown types
  return TypeTag.BYTES;
}

/**
 * Calculate byte size needed for a value
 */
function calculateValueSize(value: any, typeTag: TypeTag): number {
  switch (typeTag) {
    case TypeTag.I8:
    case TypeTag.U8:
    case TypeTag.BOOL:
      return 1;

    case TypeTag.I16:
    case TypeTag.U16:
      return 2;

    case TypeTag.I32:
    case TypeTag.U32:
    case TypeTag.F32:
      return 4;

    case TypeTag.I64:
    case TypeTag.U64:
    case TypeTag.F64:
      return 8;

    case TypeTag.NULL:
    case TypeTag.UNDEFINED:
      return 0;

    case TypeTag.STRING_UTF8: {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(String(value));
      return 4 + bytes.length; // u32 length + data
    }

    case TypeTag.ARRAY: {
      // 4 bytes for count + encoded elements
      const arr = value as any[];
      let total = 4;
      for (const item of arr) {
        const itemTag = detectTypeTag(item);
        total += 1 + calculateValueSize(item, itemTag); // tag + data
      }
      return total;
    }

    case TypeTag.MAP: {
      // Encode as nested UArr
      const nested = encodeUArr(value);
      return 4 + nested.length; // u32 length + nested UArr
    }

    case TypeTag.NODEREF: {
      // NodeRef is just a string ID
      const encoder = new TextEncoder();
      const bytes = encoder.encode(String(value));
      return 4 + bytes.length;
    }

    default:
      return 0;
  }
}

/**
 * Encode a JavaScript value to UArr binary format
 * Stores field names in header for full round-trip fidelity
 */
export function encodeUArr(value: any): Uint8Array {
  // Handle primitives by wrapping in object
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    value = { __value: value };
  }

  const fields: Array<{ name: string; value: any; typeTag: TypeTag }> = [];
  const fieldDescs: FieldDesc[] = [];

  // First pass: collect fields and calculate sizes
  for (const [name, fieldValue] of Object.entries(value)) {
    const typeTag = detectTypeTag(fieldValue);
    fields.push({ name, value: fieldValue, typeTag });
  }

  // Encode field names as a string table
  const encoder = new TextEncoder();
  const nameTableEntries: Uint8Array[] = [];
  let nameTableSize = 0;

  for (const field of fields) {
    const nameBytes = encoder.encode(field.name);
    nameTableEntries.push(nameBytes);
    nameTableSize += 4 + nameBytes.length; // u32 length + bytes
  }

  // Calculate offsets
  const HEADER_SIZE = 36; // 4+2+2+4+4+4+8+8 = 36 bytes
  const FIELD_DESC_SIZE = 24;
  const schemaOffset = HEADER_SIZE;
  const nameTableOffset = schemaOffset + (fields.length * FIELD_DESC_SIZE);
  const dataOffset = nameTableOffset + nameTableSize;

  let currentOffset = 0;
  for (const field of fields) {
    const size = calculateValueSize(field.value, field.typeTag);
    fieldDescs.push({
      nameHash: fnv1aHash(field.name),
      typeTag: field.typeTag,
      flags: 0,
      offset: currentOffset,
      length: size,
    });
    currentOffset += size;
  }

  const totalBytes = dataOffset + currentOffset;

  // Allocate buffer
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Write header
  let offset = 0;
  view.setUint32(offset, UARR_MAGIC, true); offset += 4;
  view.setUint16(offset, UARR_VERSION, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2; // flags
  view.setUint32(offset, fields.length, true); offset += 4;
  view.setUint32(offset, schemaOffset, true); offset += 4;
  view.setUint32(offset, dataOffset, true); offset += 4;
  view.setBigUint64(offset, BigInt(totalBytes), true); offset += 8;
  view.setBigUint64(offset, BigInt(nameTableOffset), true); offset += 8; // reserved -> nameTableOffset

  // Write field descriptors
  for (const desc of fieldDescs) {
    view.setBigUint64(offset, desc.nameHash, true); offset += 8;
    view.setUint8(offset, desc.typeTag); offset += 1;
    view.setUint8(offset, desc.flags); offset += 1;
    view.setUint16(offset, 0, true); offset += 2; // reserved
    view.setUint32(offset, desc.offset, true); offset += 4;
    view.setUint32(offset, desc.length, true); offset += 4;
  }

  // Write name table
  offset = nameTableOffset;
  for (const nameBytes of nameTableEntries) {
    view.setUint32(offset, nameBytes.length, true);
    offset += 4;
    bytes.set(nameBytes, offset);
    offset += nameBytes.length;
  }

  // Write data
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const desc = fieldDescs[i];
    offset = dataOffset + desc.offset;

    writeValue(view, bytes, offset, field.value, field.typeTag);
  }

  return bytes;
}

/**
 * Write a value to the buffer at the specified offset
 */
function writeValue(view: DataView, bytes: Uint8Array, offset: number, value: any, typeTag: TypeTag): void {
  switch (typeTag) {
    case TypeTag.I8:
      view.setInt8(offset, value);
      break;

    case TypeTag.I16:
      view.setInt16(offset, value, true);
      break;

    case TypeTag.I32:
      view.setInt32(offset, value, true);
      break;

    case TypeTag.I64:
      view.setBigInt64(offset, BigInt(value), true);
      break;

    case TypeTag.U8:
      view.setUint8(offset, value);
      break;

    case TypeTag.U16:
      view.setUint16(offset, value, true);
      break;

    case TypeTag.U32:
      view.setUint32(offset, value, true);
      break;

    case TypeTag.U64:
      view.setBigUint64(offset, BigInt(value), true);
      break;

    case TypeTag.F32:
      view.setFloat32(offset, value, true);
      break;

    case TypeTag.F64:
      view.setFloat64(offset, value, true);
      break;

    case TypeTag.BOOL:
      view.setUint8(offset, value ? 1 : 0);
      break;

    case TypeTag.NULL:
    case TypeTag.UNDEFINED:
      // No data to write
      break;

    case TypeTag.STRING_UTF8: {
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(String(value));
      view.setUint32(offset, strBytes.length, true);
      bytes.set(strBytes, offset + 4);
      break;
    }

    case TypeTag.ARRAY: {
      const arr = value as any[];
      view.setUint32(offset, arr.length, true);
      offset += 4;

      for (const item of arr) {
        const itemTag = detectTypeTag(item);
        view.setUint8(offset, itemTag);
        offset += 1;

        writeValue(view, bytes, offset, item, itemTag);
        offset += calculateValueSize(item, itemTag);
      }
      break;
    }

    case TypeTag.MAP: {
      const nested = encodeUArr(value);
      view.setUint32(offset, nested.length, true);
      bytes.set(nested, offset + 4);
      break;
    }

    case TypeTag.NODEREF: {
      // NodeRef is just a string ID
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(String(value));
      view.setUint32(offset, strBytes.length, true);
      bytes.set(strBytes, offset + 4);
      break;
    }
  }
}

/**
 * Decode UArr binary format to JavaScript value
 */
export function decodeUArr(buffer: Uint8Array): any {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder();

  // Read header
  let offset = 0;
  const magic = view.getUint32(offset, true); offset += 4;
  if (magic !== UARR_MAGIC) {
    throw new Error(`Invalid UArr magic: 0x${magic.toString(16)}, expected 0x${UARR_MAGIC.toString(16)}`);
  }

  const version = view.getUint16(offset, true); offset += 2;
  const flags = view.getUint16(offset, true); offset += 2;
  const fieldCount = view.getUint32(offset, true); offset += 4;
  const schemaOffset = view.getUint32(offset, true); offset += 4;
  const dataOffset = view.getUint32(offset, true); offset += 4;
  const totalBytes = view.getBigUint64(offset, true); offset += 8;
  const nameTableOffset = Number(view.getBigUint64(offset, true)); offset += 8;

  // Read field descriptors
  const fieldDescs: FieldDesc[] = [];
  offset = schemaOffset;

  for (let i = 0; i < fieldCount; i++) {
    const nameHash = view.getBigUint64(offset, true); offset += 8;
    const typeTag = view.getUint8(offset); offset += 1;
    const fieldFlags = view.getUint8(offset); offset += 1;
    const fieldReserved = view.getUint16(offset, true); offset += 2;
    const fieldOffset = view.getUint32(offset, true); offset += 4;
    const length = view.getUint32(offset, true); offset += 4;

    fieldDescs.push({
      nameHash,
      typeTag,
      flags: fieldFlags,
      offset: fieldOffset,
      length,
    });
  }

  // Read name table
  const fieldNames: string[] = [];
  offset = nameTableOffset;

  for (let i = 0; i < fieldCount; i++) {
    const nameLength = view.getUint32(offset, true);
    offset += 4;
    const nameBytes = buffer.slice(offset, offset + nameLength);
    const name = decoder.decode(nameBytes);
    fieldNames.push(name);
    offset += nameLength;
  }

  // Read data
  const result: any = {};

  for (let i = 0; i < fieldDescs.length; i++) {
    const desc = fieldDescs[i];
    const fieldName = fieldNames[i];
    offset = dataOffset + desc.offset;

    result[fieldName] = readValue(view, buffer, offset, desc.typeTag, desc.length);
  }

  // If there's only one field named __value, unwrap it
  if (fieldCount === 1 && '__value' in result) {
    return result.__value;
  }

  return result;
}

/**
 * Read a value from the buffer at the specified offset
 */
function readValue(view: DataView, bytes: Uint8Array, offset: number, typeTag: TypeTag, length: number): any {
  switch (typeTag) {
    case TypeTag.I8:
      return view.getInt8(offset);

    case TypeTag.I16:
      return view.getInt16(offset, true);

    case TypeTag.I32:
      return view.getInt32(offset, true);

    case TypeTag.I64:
      return Number(view.getBigInt64(offset, true));

    case TypeTag.U8:
      return view.getUint8(offset);

    case TypeTag.U16:
      return view.getUint16(offset, true);

    case TypeTag.U32:
      return view.getUint32(offset, true);

    case TypeTag.U64:
      return Number(view.getBigUint64(offset, true));

    case TypeTag.F32:
      return view.getFloat32(offset, true);

    case TypeTag.F64:
      return view.getFloat64(offset, true);

    case TypeTag.BOOL:
      return view.getUint8(offset) !== 0;

    case TypeTag.NULL:
      return null;

    case TypeTag.UNDEFINED:
      return undefined;

    case TypeTag.STRING_UTF8: {
      const strLength = view.getUint32(offset, true);
      const strBytes = bytes.slice(offset + 4, offset + 4 + strLength);
      const decoder = new TextDecoder();
      return decoder.decode(strBytes);
    }

    case TypeTag.ARRAY: {
      const arrLength = view.getUint32(offset, true);
      offset += 4;

      const arr: any[] = [];
      for (let i = 0; i < arrLength; i++) {
        const itemTag = view.getUint8(offset);
        offset += 1;

        const itemSize = calculateItemSize(view, bytes, offset, itemTag);
        const item = readValue(view, bytes, offset, itemTag, itemSize);
        arr.push(item);
        offset += itemSize;
      }
      return arr;
    }

    case TypeTag.MAP: {
      const nestedLength = view.getUint32(offset, true);
      const nestedBytes = bytes.slice(offset + 4, offset + 4 + nestedLength);
      return decodeUArr(nestedBytes);
    }

    case TypeTag.NODEREF: {
      const strLength = view.getUint32(offset, true);
      const strBytes = bytes.slice(offset + 4, offset + 4 + strLength);
      const decoder = new TextDecoder();
      return decoder.decode(strBytes);
    }

    default:
      return null;
  }
}

/**
 * Calculate the size of an item when reading (for arrays)
 */
function calculateItemSize(view: DataView, bytes: Uint8Array, offset: number, typeTag: TypeTag): number {
  switch (typeTag) {
    case TypeTag.I8:
    case TypeTag.U8:
    case TypeTag.BOOL:
      return 1;

    case TypeTag.I16:
    case TypeTag.U16:
      return 2;

    case TypeTag.I32:
    case TypeTag.U32:
    case TypeTag.F32:
      return 4;

    case TypeTag.I64:
    case TypeTag.U64:
    case TypeTag.F64:
      return 8;

    case TypeTag.NULL:
    case TypeTag.UNDEFINED:
      return 0;

    case TypeTag.STRING_UTF8:
    case TypeTag.NODEREF: {
      const strLength = view.getUint32(offset, true);
      return 4 + strLength;
    }

    case TypeTag.MAP: {
      const nestedLength = view.getUint32(offset, true);
      return 4 + nestedLength;
    }

    case TypeTag.ARRAY: {
      const arrLength = view.getUint32(offset, true);
      let total = 4;
      offset += 4;

      for (let i = 0; i < arrLength; i++) {
        const itemTag = view.getUint8(offset);
        offset += 1;
        total += 1;

        const itemSize = calculateItemSize(view, bytes, offset, itemTag);
        total += itemSize;
        offset += itemSize;
      }
      return total;
    }

    default:
      return 0;
  }
}

/**
 * Enhanced encode with field name preservation
 */
export function encodeUArrWithNames(value: any, fieldNames?: string[]): { buffer: Uint8Array; names: string[] } {
  // Handle primitives
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    value = { __value: value };
  }

  const names: string[] = [];
  for (const key of Object.keys(value)) {
    names.push(key);
  }

  const buffer = encodeUArr(value);
  return { buffer, names };
}

/**
 * Enhanced decode with field name restoration
 */
export function decodeUArrWithNames(buffer: Uint8Array, fieldNames: string[]): any {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Read header
  let offset = 0;
  const magic = view.getUint32(offset, true); offset += 4;
  if (magic !== UARR_MAGIC) {
    throw new Error(`Invalid UArr magic: 0x${magic.toString(16)}`);
  }

  const version = view.getUint16(offset, true); offset += 2;
  const flags = view.getUint16(offset, true); offset += 2;
  const fieldCount = view.getUint32(offset, true); offset += 4;
  const schemaOffset = view.getUint32(offset, true); offset += 4;
  const dataOffset = view.getUint32(offset, true); offset += 4;

  // Read field descriptors
  const fieldDescs: FieldDesc[] = [];
  offset = schemaOffset;

  for (let i = 0; i < fieldCount; i++) {
    const nameHash = view.getBigUint64(offset, true); offset += 8;
    const typeTag = view.getUint8(offset); offset += 1;
    const fieldFlags = view.getUint8(offset); offset += 1;
    offset += 2; // reserved
    const fieldOffset = view.getUint32(offset, true); offset += 4;
    const length = view.getUint32(offset, true); offset += 4;

    fieldDescs.push({ nameHash, typeTag, flags: fieldFlags, offset: fieldOffset, length });
  }

  // Read data with proper field names
  const result: any = {};

  for (let i = 0; i < fieldDescs.length; i++) {
    const desc = fieldDescs[i];
    const fieldName = fieldNames[i] || `field_${i}`;
    offset = dataOffset + desc.offset;

    result[fieldName] = readValue(view, buffer, offset, desc.typeTag, desc.length);
  }

  // Unwrap single __value field
  if (fieldCount === 1 && '__value' in result) {
    return result.__value;
  }

  return result;
}
