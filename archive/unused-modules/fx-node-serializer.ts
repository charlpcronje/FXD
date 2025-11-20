/**
 * @file fx-node-serializer.ts
 * @description Node persistence serialization with hierarchy preservation
 * Handles serialization/deserialization of FX nodes to/from SQLite
 */

import { FXNode, FXCore } from "../fx.ts";
import {
  SQLiteDatabase,
  SQLiteStatement,
  SerializedNode,
  PersistenceUtils
} from "./fx-persistence.ts";

/**
 * Serialization options
 */
export interface SerializationOptions {
  includeChildren?: boolean;
  maxDepth?: number;
  excludeTypes?: string[];
  includeMeta?: boolean;
  compressValues?: boolean;
}

/**
 * Circular reference detection and handling
 */
interface SerializationContext {
  visited: Set<string>;
  pathStack: string[];
  depth: number;
  maxDepth: number;
}

/**
 * Node reconstruction context for deserialization
 */
interface DeserializationContext {
  nodeMap: Map<string, FXNode>;
  pendingChildren: Array<{
    parentId: string;
    childKey: string;
    childNode: FXNode;
  }>;
  fx: FXCore;
}

/**
 * FX Node Serializer
 * Handles conversion between FXNode objects and database records
 */
export class FXNodeSerializer {
  constructor(private fx: FXCore) {}

  /**
   * Serialize a single node without children
   */
  serializeNode(node: FXNode, options: SerializationOptions = {}): SerializedNode {
    const context: SerializationContext = {
      visited: new Set(),
      pathStack: [],
      depth: 0,
      maxDepth: options.maxDepth || Number.MAX_SAFE_INTEGER
    };

    return this.serializeNodeInternal(node, null, null, context, options);
  }

  /**
   * Serialize a node and its entire subtree
   */
  serializeNodeTree(rootNode: FXNode, options: SerializationOptions = {}): SerializedNode {
    const fullOptions = {
      includeChildren: true,
      maxDepth: 100, // Reasonable default to prevent infinite recursion
      includeMeta: true,
      ...options
    };

    const context: SerializationContext = {
      visited: new Set(),
      pathStack: [],
      depth: 0,
      maxDepth: fullOptions.maxDepth
    };

    return this.serializeNodeInternal(rootNode, null, null, context, fullOptions);
  }

  /**
   * Deserialize a node from database record
   */
  deserializeNode(serialized: SerializedNode): FXNode {
    const context: DeserializationContext = {
      nodeMap: new Map(),
      pendingChildren: [],
      fx: this.fx
    };

    const node = this.deserializeNodeInternal(serialized, context);

    // Process all pending child relationships
    this.processPendingChildren(context);

    return node;
  }

  /**
   * Deserialize an entire node tree from database records
   */
  deserializeNodeTree(serializedNodes: SerializedNode[]): FXNode | null {
    const context: DeserializationContext = {
      nodeMap: new Map(),
      pendingChildren: [],
      fx: this.fx
    };

    // First pass: create all nodes
    for (const serialized of serializedNodes) {
      this.deserializeNodeInternal(serialized, context);
    }

    // Second pass: establish parent-child relationships
    this.processPendingChildren(context);

    // Find and return root node (node with no parent)
    for (const node of context.nodeMap.values()) {
      if (!node.__parent_id) {
        return node;
      }
    }

    return null;
  }

  /**
   * Convert FXNode to database record format
   */
  nodeToDbRecord(node: FXNode, parentId?: string, keyName?: string): any {
    const checksum = PersistenceUtils.checksumNode(node);

    return {
      id: node.__id,
      parent_id: parentId || node.__parent_id,
      key_name: keyName || null,
      node_type: node.__type || "raw",
      value_json: PersistenceUtils.safeStringify(this.serializeNodeValue(node)),
      prototypes_json: PersistenceUtils.safeStringify(node.__proto || []),
      meta_json: PersistenceUtils.safeStringify((node as any).__meta || null),
      checksum: checksum,
      is_dirty: 0
    };
  }

  /**
   * Convert database record to FXNode
   */
  dbRecordToNode(record: any): FXNode {
    const node = this.fx.createNode(record.parent_id);

    // Restore basic properties
    node.__id = record.id;
    node.__parent_id = record.parent_id;
    node.__type = record.node_type || "raw";
    node.__proto = PersistenceUtils.safeParse(record.prototypes_json) || [];

    // Restore metadata
    const meta = PersistenceUtils.safeParse(record.meta_json);
    if (meta) {
      (node as any).__meta = meta;
    }

    // Restore value
    const valueData = PersistenceUtils.safeParse(record.value_json);
    if (valueData !== null) {
      this.restoreNodeValue(node, valueData);
    }

    return node;
  }

  /**
   * Check if a node has been modified since last save
   */
  isNodeModified(node: FXNode, lastChecksum?: string): boolean {
    return PersistenceUtils.isNodeDirty(node, lastChecksum);
  }

  /**
   * Get all descendant nodes in breadth-first order
   */
  getDescendantNodes(rootNode: FXNode, maxDepth = 100): FXNode[] {
    const result: FXNode[] = [];
    const queue: Array<{ node: FXNode; depth: number }> = [{ node: rootNode, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (visited.has(node.__id) || depth > maxDepth) {
        continue;
      }

      visited.add(node.__id);
      result.push(node);

      // Add children to queue
      if (depth < maxDepth) {
        for (const childNode of Object.values(node.__nodes)) {
          if (!visited.has(childNode.__id)) {
            queue.push({ node: childNode, depth: depth + 1 });
          }
        }
      }
    }

    return result;
  }

  // Private implementation methods

  private serializeNodeInternal(
    node: FXNode,
    parentId: string | null,
    keyName: string | null,
    context: SerializationContext,
    options: SerializationOptions
  ): SerializedNode {
    // Check for circular references
    if (context.visited.has(node.__id)) {
      throw new Error(`Circular reference detected: ${context.pathStack.join('.')} -> ${node.__id}`);
    }

    // Check depth limit
    if (context.depth > context.maxDepth) {
      throw new Error(`Maximum serialization depth (${context.maxDepth}) exceeded`);
    }

    context.visited.add(node.__id);
    context.pathStack.push(node.__id);
    context.depth++;

    try {
      // Create base serialized node
      const serialized: SerializedNode = {
        id: node.__id,
        parent_id: parentId,
        key_name: keyName,
        node_type: node.__type || "raw",
        value: this.serializeNodeValue(node),
        prototypes: [...(node.__proto || [])],
        meta: options.includeMeta ? (node as any).__meta || null : null
      };

      // Include children if requested and within depth limit
      if (options.includeChildren && context.depth < context.maxDepth) {
        serialized.children = {};

        for (const [key, childNode] of Object.entries(node.__nodes)) {
          // Skip excluded types
          if (options.excludeTypes?.includes(childNode.__type || "")) {
            continue;
          }

          serialized.children[key] = this.serializeNodeInternal(
            childNode,
            node.__id,
            key,
            context,
            options
          );
        }
      }

      return serialized;
    } finally {
      context.pathStack.pop();
      context.depth--;
      context.visited.delete(node.__id);
    }
  }

  private deserializeNodeInternal(
    serialized: SerializedNode,
    context: DeserializationContext
  ): FXNode {
    // Check if node already exists
    let node = context.nodeMap.get(serialized.id);
    if (node) {
      return node;
    }

    // Create new node
    node = context.fx.createNode(serialized.parent_id);
    node.__id = serialized.id;
    node.__parent_id = serialized.parent_id;
    node.__type = serialized.node_type || "raw";
    node.__proto = [...(serialized.prototypes || [])];

    // Restore metadata
    if (serialized.meta) {
      (node as any).__meta = { ...serialized.meta };
    }

    // Restore value
    this.restoreNodeValue(node, serialized.value);

    // Store in context
    context.nodeMap.set(serialized.id, node);

    // Handle children
    if (serialized.children) {
      for (const [key, childSerialized] of Object.entries(serialized.children)) {
        const childNode = this.deserializeNodeInternal(childSerialized, context);

        // Schedule parent-child relationship setup
        context.pendingChildren.push({
          parentId: serialized.id,
          childKey: key,
          childNode: childNode
        });
      }
    }

    return node;
  }

  private processPendingChildren(context: DeserializationContext): void {
    for (const { parentId, childKey, childNode } of context.pendingChildren) {
      const parentNode = context.nodeMap.get(parentId);
      if (parentNode) {
        parentNode.__nodes[childKey] = childNode;
        childNode.__parent_id = parentId;
      }
    }
  }

  private serializeNodeValue(node: FXNode): any {
    const value = node.__value;

    // Handle undefined/null values
    if (value === undefined || value === null) {
      return value;
    }

    // Handle FXNode references
    if (value && typeof value === "object" && value.__id && value.__nodes) {
      return {
        __type: "FXNodeReference",
        __id: value.__id
      };
    }

    // Handle complex objects with type information
    if (typeof value === "object" && value.constructor?.name !== "Object") {
      return {
        __type: "TypedObject",
        __constructor: value.constructor.name,
        __data: this.trySerializeObject(value)
      };
    }

    // Handle view bags (the structured value objects FX creates)
    if (value && typeof value === "object" && "raw" in value) {
      return {
        __type: "ViewBag",
        __data: { ...value }
      };
    }

    // Handle plain objects and primitives
    return this.trySerializeObject(value);
  }

  private restoreNodeValue(node: FXNode, serializedValue: any): void {
    if (serializedValue === undefined || serializedValue === null) {
      this.fx.set(node, serializedValue);
      return;
    }

    // Handle special serialized types
    if (serializedValue && typeof serializedValue === "object" && serializedValue.__type) {
      switch (serializedValue.__type) {
        case "FXNodeReference":
          // Handle FXNode references - these will be resolved after all nodes are loaded
          node.__value = { __pendingNodeRef: serializedValue.__id };
          return;

        case "TypedObject":
          // Handle complex typed objects
          try {
            const data = serializedValue.__data;
            // For now, just store the data - full type reconstruction requires more context
            this.fx.set(node, data);
          } catch (error) {
            console.warn(`[FXNodeSerializer] Failed to restore typed object:`, error);
            this.fx.set(node, serializedValue.__data);
          }
          return;

        case "ViewBag":
          // Restore FX view bag structure
          node.__value = { ...serializedValue.__data };
          return;
      }
    }

    // Handle regular values
    this.fx.set(node, serializedValue);
  }

  private trySerializeObject(obj: any): any {
    try {
      // Check for circular references in the object itself
      JSON.stringify(obj);
      return obj;
    } catch (error) {
      // Handle circular references by converting to a safe representation
      try {
        return this.createSafeObjectCopy(obj);
      } catch (safeError) {
        console.warn(`[FXNodeSerializer] Failed to serialize object:`, safeError);
        return {
          __type: "SerializationError",
          __error: String(safeError),
          __typeof: typeof obj,
          __string: String(obj)
        };
      }
    }
  }

  private createSafeObjectCopy(obj: any, visited = new WeakSet()): any {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (visited.has(obj)) {
      return { __type: "CircularReference" };
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => this.createSafeObjectCopy(item, visited));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        result[key] = this.createSafeObjectCopy(value, visited);
      } catch (error) {
        result[key] = { __type: "SerializationError", __error: String(error) };
      }
    }

    return result;
  }
}

/**
 * Factory function to create node serializer
 */
export function createNodeSerializer(fx: FXCore): FXNodeSerializer {
  return new FXNodeSerializer(fx);
}

/**
 * Utility functions for batch node operations
 */
export class NodeBatchSerializer {
  constructor(private serializer: FXNodeSerializer) {}

  /**
   * Serialize multiple nodes efficiently
   */
  serializeNodes(nodes: FXNode[], options: SerializationOptions = {}): SerializedNode[] {
    return nodes.map(node => this.serializer.serializeNode(node, options));
  }

  /**
   * Deserialize multiple nodes efficiently
   */
  deserializeNodes(serializedNodes: SerializedNode[]): FXNode[] {
    return serializedNodes.map(serialized => this.serializer.deserializeNode(serialized));
  }

  /**
   * Generate database records for multiple nodes
   */
  nodesToDbRecords(nodes: FXNode[]): any[] {
    return nodes.map(node => this.serializer.nodeToDbRecord(node));
  }

  /**
   * Create nodes from multiple database records
   */
  dbRecordsToNodes(records: any[]): FXNode[] {
    return records.map(record => this.serializer.dbRecordToNode(record));
  }
}

export { FXNodeSerializer, NodeBatchSerializer };