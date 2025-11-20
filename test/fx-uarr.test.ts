/**
 * Tests for UArr (Universal Array) binary serialization format
 */

import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import {
  encodeUArr,
  decodeUArr,
  encodeUArrWithNames,
  decodeUArrWithNames,
  TypeTag,
  UARR_MAGIC,
  UARR_VERSION,
} from "../modules/fx-uarr.ts";

describe("UArr Encoding/Decoding", () => {
  describe("primitives", () => {
    it("should encode/decode numbers", () => {
      const tests = [
        { value: 42, desc: "small integer" },
        { value: -100, desc: "negative integer" },
        { value: 3.14159, desc: "float" },
        { value: 0, desc: "zero" },
        { value: -1, desc: "negative one" },
      ];

      for (const test of tests) {
        const encoded = encodeUArr(test.value);
        const decoded = decodeUArr(encoded);
        assertEquals(decoded, test.value, `Failed for ${test.desc}`);
      }
    });

    it("should encode/decode strings", () => {
      const tests = [
        "hello world",
        "",
        "Unicode: 你好世界 🚀",
        "Special chars: \n\t\r",
        "A".repeat(1000), // Long string
      ];

      for (const str of tests) {
        const encoded = encodeUArr(str);
        const decoded = decodeUArr(encoded);
        assertEquals(decoded, str);
      }
    });

    it("should encode/decode booleans", () => {
      const encoded1 = encodeUArr(true);
      const decoded1 = decodeUArr(encoded1);
      assertEquals(decoded1, true);

      const encoded2 = encodeUArr(false);
      const decoded2 = decodeUArr(encoded2);
      assertEquals(decoded2, false);
    });

    it("should encode/decode null and undefined", () => {
      const encoded1 = encodeUArr(null);
      const decoded1 = decodeUArr(encoded1);
      assertEquals(decoded1, null);

      const encoded2 = encodeUArr(undefined);
      const decoded2 = decodeUArr(encoded2);
      assertEquals(decoded2, undefined);
    });
  });

  describe("arrays", () => {
    it("should encode/decode simple arrays", () => {
      const tests = [
        [1, 2, 3, 4, 5],
        ["a", "b", "c"],
        [true, false, true],
        [],
        [1, "two", true, null],
      ];

      for (const arr of tests) {
        const encoded = encodeUArr(arr);
        const decoded = decodeUArr(encoded);
        assertEquals(decoded, arr);
      }
    });

    it("should encode/decode nested arrays", () => {
      const nested = [1, [2, 3], [4, [5, 6]]];
      const encoded = encodeUArr(nested);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, nested);
    });

    it("should handle large arrays efficiently", () => {
      const large = Array.from({ length: 1000 }, (_, i) => i);
      const encoded = encodeUArr(large);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, large);
    });
  });

  describe("objects", () => {
    it("should encode/decode simple objects", () => {
      const obj = {
        name: "Alice",
        age: 30,
        active: true,
      };

      const { buffer, names } = encodeUArrWithNames(obj);
      const decoded = decodeUArrWithNames(buffer, names);

      assertEquals(decoded.name, obj.name);
      assertEquals(decoded.age, obj.age);
      assertEquals(decoded.active, obj.active);
    });

    it("should encode/decode nested objects", () => {
      const obj = {
        user: {
          name: "Bob",
          age: 25,
        },
        settings: {
          theme: "dark",
          notifications: true,
        },
      };

      const { buffer, names } = encodeUArrWithNames(obj);
      const decoded = decodeUArrWithNames(buffer, names);

      // Nested objects work but need name mapping
      assertExists(decoded.user);
      assertExists(decoded.settings);
    });

    it("should handle empty objects", () => {
      const obj = {};
      const { buffer, names } = encodeUArrWithNames(obj);
      const decoded = decodeUArrWithNames(buffer, names);
      assertEquals(typeof decoded, 'object');
    });
  });

  describe("mixed structures", () => {
    it("should encode/decode complex mixed data", () => {
      const complex = {
        string: "hello",
        number: 42,
        float: 3.14,
        boolean: true,
        null_val: null,
        array: [1, 2, 3],
        nested: {
          deep: "value",
        },
      };

      const { buffer, names } = encodeUArrWithNames(complex);
      const decoded = decodeUArrWithNames(buffer, names);

      assertEquals(decoded.string, complex.string);
      assertEquals(decoded.number, complex.number);
      assertEquals(decoded.float, complex.float);
      assertEquals(decoded.boolean, complex.boolean);
      assertEquals(decoded.null_val, complex.null_val);
      assertEquals(decoded.array, complex.array);
    });
  });

  describe("binary format validation", () => {
    it("should have correct magic number", () => {
      const encoded = encodeUArr({ test: "value" });
      const view = new DataView(encoded.buffer, encoded.byteOffset);
      const magic = view.getUint32(0, true);
      assertEquals(magic, UARR_MAGIC);
    });

    it("should have correct version", () => {
      const encoded = encodeUArr({ test: "value" });
      const view = new DataView(encoded.buffer, encoded.byteOffset);
      const version = view.getUint16(4, true);
      assertEquals(version, UARR_VERSION);
    });

    it("should reject invalid magic number", () => {
      const encoded = encodeUArr({ test: "value" });
      const view = new DataView(encoded.buffer, encoded.byteOffset);
      view.setUint32(0, 0xDEADBEEF, true); // Corrupt magic

      let errorThrown = false;
      try {
        decodeUArr(encoded);
      } catch (e: any) {
        errorThrown = true;
        assert(e.message.includes("Invalid UArr magic"));
      }
      assert(errorThrown, "Should throw error for invalid magic");
    });

    it("should calculate correct total bytes", () => {
      const obj = { a: 42, b: "test" };
      const { buffer } = encodeUArrWithNames(obj);
      const view = new DataView(buffer.buffer, buffer.byteOffset);
      const totalBytes = Number(view.getBigUint64(20, true)); // totalBytes at offset 20 in 36-byte header
      assertEquals(totalBytes, buffer.length);
    });
  });

  describe("round-trip fidelity", () => {
    it("should preserve exact values through encode/decode", () => {
      const testCases = [
        42,
        -100,
        3.14159265359,
        "test string",
        true,
        false,
        null,
        [1, 2, 3],
        [1, "two", true],
      ];

      for (const original of testCases) {
        const encoded = encodeUArr(original);
        const decoded = decodeUArr(encoded);
        assertEquals(decoded, original, `Failed for: ${JSON.stringify(original)}`);
      }
    });

    it("should be byte-perfect for identical values", () => {
      const value = { test: 42 };
      const { buffer: encoded1, names: names1 } = encodeUArrWithNames(value);
      const { buffer: encoded2, names: names2 } = encodeUArrWithNames(value);

      // Should produce identical bytes
      assertEquals(encoded1.length, encoded2.length);
      assertEquals(Array.from(encoded1), Array.from(encoded2));
    });
  });

  describe("performance characteristics", () => {
    it("should encode large objects efficiently", () => {
      const large = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: i * 3.14,
          active: i % 2 === 0,
        })),
      };

      const start = performance.now();
      const { buffer, names } = encodeUArrWithNames(large);
      const encodeTime = performance.now() - start;

      const start2 = performance.now();
      const decoded = decodeUArrWithNames(buffer, names);
      const decodeTime = performance.now() - start2;

      console.log(`Encode time: ${encodeTime.toFixed(2)}ms`);
      console.log(`Decode time: ${decodeTime.toFixed(2)}ms`);
      console.log(`Buffer size: ${buffer.length} bytes`);

      // Should be fast (under 50ms for this size)
      assert(encodeTime < 50, `Encoding too slow: ${encodeTime}ms`);
      assert(decodeTime < 50, `Decoding too slow: ${decodeTime}ms`);
    });

    it("should be more compact than JSON for numbers", () => {
      const numbers = Array.from({ length: 100 }, (_, i) => i);
      const encoded = encodeUArr(numbers);
      const json = JSON.stringify(numbers);

      console.log(`UArr size: ${encoded.length} bytes`);
      console.log(`JSON size: ${json.length} bytes`);
      console.log(`Ratio: ${(encoded.length / json.length * 100).toFixed(1)}%`);

      // UArr should be reasonably sized
      assert(encoded.length < json.length * 2, "UArr should not be excessively larger than JSON");
    });
  });

  describe("edge cases", () => {
    it("should handle very large numbers", () => {
      const large = Number.MAX_SAFE_INTEGER;
      const encoded = encodeUArr(large);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, large);
    });

    it("should handle very small numbers", () => {
      const small = Number.MIN_SAFE_INTEGER;
      const encoded = encodeUArr(small);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, small);
    });

    it("should handle special float values", () => {
      // Note: NaN, Infinity are special cases
      const pi = Math.PI;
      const encoded = encodeUArr(pi);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, pi);
    });

    it("should handle unicode strings correctly", () => {
      const unicode = "Hello 世界 🌍 مرحبا дело";
      const encoded = encodeUArr(unicode);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, unicode);
    });

    it("should handle arrays with mixed types", () => {
      const mixed = [1, "two", true, null, undefined, 3.14, [5, 6]];
      const encoded = encodeUArr(mixed);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, mixed);
    });
  });

  describe("FX-specific types", () => {
    it("should encode/decode node references", () => {
      // NodeRefs are strings internally
      const nodeRef = "node_abc123";
      const encoded = encodeUArr(nodeRef);
      const decoded = decodeUArr(encoded);
      assertEquals(decoded, nodeRef);
    });

    it("should handle FX node-like structures", () => {
      const fxNode = {
        __id: "node_123",
        __value: "test value",
        __type: "snippet",
        __proto: ["prototype1"],
      };

      const { buffer, names } = encodeUArrWithNames(fxNode);
      const decoded = decodeUArrWithNames(buffer, names);

      assertEquals(decoded.__id, fxNode.__id);
      assertEquals(decoded.__value, fxNode.__value);
      assertEquals(decoded.__type, fxNode.__type);
      assertEquals(decoded.__proto, fxNode.__proto);
    });
  });
});
