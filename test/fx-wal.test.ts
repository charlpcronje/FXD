/**
 * Tests for WAL (Write-Ahead Log) system
 */

import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std/assert/mod.ts";
import { beforeEach, afterEach, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import {
  WAL,
  RecordType,
  type WALRecord,
} from "../modules/fx-wal.ts";

const TEST_WAL_PATH = "./test-data/test.fxwal";

describe("WAL (Write-Ahead Log)", {
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  beforeEach(async () => {
    // Remove test WAL if it exists
    try {
      await Deno.remove(TEST_WAL_PATH);
    } catch {
      // Doesn't exist, that's fine
    }

    // Ensure test-data directory exists
    try {
      await Deno.mkdir("./test-data", { recursive: true });
    } catch {
      // Already exists
    }
  });

  afterEach(async () => {
    // Cleanup
    try {
      await Deno.remove(TEST_WAL_PATH);
    } catch {
      // Already deleted or locked
    }
  });

  describe("file creation and opening", () => {
    it("should create a new WAL file", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const stat = await Deno.stat(TEST_WAL_PATH);
      assertExists(stat);
      assertEquals(stat.isFile, true);

      wal.close();
    });

    it("should open an existing WAL file", async () => {
      // Create first
      const wal1 = new WAL(TEST_WAL_PATH);
      await wal1.open();
      wal1.close();

      // Open again
      const wal2 = new WAL(TEST_WAL_PATH);
      await wal2.open();
      wal2.close();
    });

    it("should validate magic number", async () => {
      // Create invalid file
      await Deno.writeTextFile(TEST_WAL_PATH, "NOT A WAL FILE");

      const wal = new WAL(TEST_WAL_PATH);

      let errorThrown = false;
      try {
        await wal.open();
      } catch (e: any) {
        errorThrown = true;
        assert(e.message.includes("Invalid WAL file"));
      }

      assert(errorThrown, "Should reject invalid WAL file");
      wal.close();
    });
  });

  describe("record writing", () => {
    it("should append a record", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const seq = await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test.node1",
        data: { value: "hello" },
      });

      assertEquals(seq, 1n);

      const stats = await wal.stats();
      assertEquals(stats.recordCount, 1);
      assertEquals(stats.newestSeq, 1n);

      wal.close();
    });

    it("should append multiple records with sequential IDs", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const seq1 = await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "node1",
        data: { value: 1 },
      });

      const seq2 = await wal.append({
        type: RecordType.NODE_PATCH,
        nodeId: "node1",
        data: { value: 2 },
      });

      const seq3 = await wal.append({
        type: RecordType.SIGNAL,
        nodeId: "node2",
        data: { event: "changed" },
      });

      assertEquals(seq1, 1n);
      assertEquals(seq2, 2n);
      assertEquals(seq3, 3n);

      const stats = await wal.stats();
      assertEquals(stats.recordCount, 3);

      wal.close();
    });

    it("should handle different record types", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const types = [
        RecordType.NODE_CREATE,
        RecordType.NODE_PATCH,
        RecordType.LINK_ADD,
        RecordType.LINK_DEL,
        RecordType.SIGNAL,
        RecordType.CHECKPOINT,
      ];

      for (const type of types) {
        await wal.append({
          type,
          nodeId: `node_${type}`,
          data: { type: `type_${type}` },
        });
      }

      const stats = await wal.stats();
      assertEquals(stats.recordCount, types.length);

      wal.close();
    });
  });

  describe("record reading", () => {
    it("should read back written records", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Write
      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test1",
        data: { value: "data1" },
      });

      await wal.append({
        type: RecordType.NODE_PATCH,
        nodeId: "test2",
        data: { value: "data2" },
      });

      // Read
      const records = await wal.readAll();

      assertEquals(records.length, 2);
      assertEquals(records[0].nodeId, "test1");
      assertEquals(records[0].data.value, "data1");
      assertEquals(records[0].type, RecordType.NODE_CREATE);

      assertEquals(records[1].nodeId, "test2");
      assertEquals(records[1].data.value, "data2");
      assertEquals(records[1].type, RecordType.NODE_PATCH);

      wal.close();
    });

    it("should read from a specific cursor", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Write 5 records
      for (let i = 1; i <= 5; i++) {
        await wal.append({
          type: RecordType.NODE_CREATE,
          nodeId: `node${i}`,
          data: { index: i },
        });
      }

      // Read from seq 3 onwards
      const records: WALRecord[] = [];
      for await (const record of wal.readFrom(3n)) {
        records.push(record);
      }

      assertEquals(records.length, 3); // Should get records 3, 4, 5
      assertEquals(records[0].data.index, 3);
      assertEquals(records[1].data.index, 4);
      assertEquals(records[2].data.index, 5);

      wal.close();
    });

    it("should preserve all data types correctly", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const testData = {
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

      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "complex",
        data: testData,
      });

      const records = await wal.readAll();
      assertEquals(records.length, 1);

      const data = records[0].data;
      assertEquals(data.string, testData.string);
      assertEquals(data.number, testData.number);
      assertEquals(data.float, testData.float);
      assertEquals(data.boolean, testData.boolean);
      assertEquals(data.null_val, testData.null_val);
      assertEquals(data.array, testData.array);

      wal.close();
    });
  });

  describe("checksum validation", () => {
    it("should calculate checksums for records", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test",
        data: { value: "test" },
      });

      const records = await wal.readAll();
      assertEquals(records.length, 1);
      assertExists(records[0].checksum);
      assert(typeof records[0].checksum === 'number');

      wal.close();
    });

    it("should detect corrupted records", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Write a record
      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test",
        data: { value: "original" },
      });

      wal.close();

      // Corrupt the file (flip some bytes in the middle)
      const fileData = await Deno.readFile(TEST_WAL_PATH);
      fileData[100] ^= 0xFF; // Flip bits
      await Deno.writeFile(TEST_WAL_PATH, fileData);

      // Try to read - should warn about checksum mismatch
      const wal2 = new WAL(TEST_WAL_PATH);
      await wal2.open();

      const records = await wal2.readAll();
      // Corrupted record should be skipped
      assertEquals(records.length, 0);

      wal2.close();
    });
  });

  describe("crash recovery", () => {
    it("should recover sequence number after reopen", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Write some records
      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "node1",
        data: { value: 1 },
      });

      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "node2",
        data: { value: 2 },
      });

      wal.close();

      // Reopen and append more
      const wal2 = new WAL(TEST_WAL_PATH);
      await wal2.open();

      const seq3 = await wal2.append({
        type: RecordType.NODE_CREATE,
        nodeId: "node3",
        data: { value: 3 },
      });

      // Should continue from seq 3
      assertEquals(seq3, 3n);

      const records = await wal2.readAll();
      assertEquals(records.length, 3);

      wal2.close();
    });

    it("should replay operations after crash", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Simulate operations
      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "user.name",
        data: { value: "Alice" },
      });

      await wal.append({
        type: RecordType.NODE_PATCH,
        nodeId: "user.name",
        data: { value: "Bob" },
      });

      await wal.append({
        type: RecordType.LINK_ADD,
        nodeId: "user.friends",
        data: { target: "user.alice" },
      });

      wal.close();

      // "Crash" and recovery
      const wal2 = new WAL(TEST_WAL_PATH);
      await wal2.open();

      // Replay all operations
      const operations: Array<{ type: RecordType; nodeId: string }> = [];
      for await (const record of wal2.readFrom(0n)) {
        operations.push({
          type: record.type,
          nodeId: record.nodeId,
        });
      }

      assertEquals(operations.length, 3);
      assertEquals(operations[0].type, RecordType.NODE_CREATE);
      assertEquals(operations[1].type, RecordType.NODE_PATCH);
      assertEquals(operations[2].type, RecordType.LINK_ADD);

      wal2.close();
    });
  });

  describe("performance", () => {
    it("should handle large numbers of records efficiently", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      const start = performance.now();

      // Write 1000 records
      for (let i = 0; i < 1000; i++) {
        await wal.append({
          type: RecordType.NODE_CREATE,
          nodeId: `node_${i}`,
          data: { index: i, value: `value_${i}` },
        });
      }

      const writeTime = performance.now() - start;

      console.log(`Write time for 1000 records: ${writeTime.toFixed(2)}ms`);
      console.log(`Avg per record: ${(writeTime / 1000).toFixed(3)}ms`);

      // Should be reasonably fast (under 5ms per record)
      assert(writeTime / 1000 < 5, `Writing too slow: ${writeTime / 1000}ms per record`);

      const stats = await wal.stats();
      assertEquals(stats.recordCount, 1000);

      wal.close();
    });

    it("should read large logs efficiently", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Write 1000 records
      for (let i = 0; i < 1000; i++) {
        await wal.append({
          type: RecordType.NODE_CREATE,
          nodeId: `node_${i}`,
          data: { index: i },
        });
      }

      const start = performance.now();

      // Read all
      const records = await wal.readAll();

      const readTime = performance.now() - start;

      console.log(`Read time for 1000 records: ${readTime.toFixed(2)}ms`);
      console.log(`Avg per record: ${(readTime / 1000).toFixed(3)}ms`);

      assertEquals(records.length, 1000);

      // Should be fast (under 2ms per record)
      assert(readTime / 1000 < 2, `Reading too slow: ${readTime / 1000}ms per record`);

      wal.close();
    });
  });

  describe("stats", () => {
    it("should report correct statistics", async () => {
      const wal = new WAL(TEST_WAL_PATH);
      await wal.open();

      // Initially empty
      let stats = await wal.stats();
      assertEquals(stats.recordCount, 0);
      assertEquals(stats.newestSeq, 0n);

      // Write some records
      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test1",
        data: { value: 1 },
      });

      await wal.append({
        type: RecordType.NODE_CREATE,
        nodeId: "test2",
        data: { value: 2 },
      });

      stats = await wal.stats();
      assertEquals(stats.recordCount, 2);
      assertEquals(stats.oldestSeq, 1n);
      assertEquals(stats.newestSeq, 2n);
      assert(stats.byteSize > 0);

      wal.close();
    });
  });
});
