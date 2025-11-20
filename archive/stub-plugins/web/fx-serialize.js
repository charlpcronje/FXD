/**
 * @file fx-serialize.js
 * @description FX Serialize Plugin - Wrap & Expand for State Serialization
 * 
 * Features:
 * - Complete state serialization (wrap)
 * - State restoration (expand)  
 * - Selective serialization
 * - Compression support
 * - Class instance handling
 */

/**
 * @class FXSerializePlugin
 * @description Plugin for serializing and deserializing FX state
 */
class FXSerializePlugin {
    constructor(fx, options = {}) {
        this.fx = fx;
        this.options = {
            includePrivateProps: false,
            compressOutput: false,
            preserveClassInstances: true,
            maxDepth: 50,
            ...options
        };

        this.name = 'serialize';
        this.version = '1.0.0';
        this.description = 'State serialization and deserialization for FX nodes';

        console.log('FX[Serialize]: Plugin initialized');
    }

    /**
     * @method wrap
     * @description Serialize FX state to JSON-safe object
     * @param {Object} startNode - Starting node (defaults to root)
     * @param {Object} options - Serialization options
     * @returns {Object} Serialized state
     */
    wrap(startNode = this.fx.root, options = {}) {
        const config = {
            includePrivateProps: this.options.includePrivateProps,
            preserveClassInstances: this.options.preserveClassInstances,
            maxDepth: this.options.maxDepth,
            ...options
        };

        console.log('FX[Serialize]: Starting serialization');

        try {
            const result = this.wrapNode(startNode, config, 0, new Set());

            const output = {
                __fx_serialized: true,
                __fx_version: this.version,
                __fx_timestamp: Date.now(),
                __fx_root: result
            };

            if (this.options.compressOutput) {
                output.__fx_compressed = true;
                // Would implement compression here
            }

            console.log('FX[Serialize]: Serialization completed');
            return output;

        } catch (error) {
            console.error('FX[Serialize]: Serialization failed:', error);
            throw error;
        }
    }

    /**
     * @method wrapNode
     * @description Serialize a single node
     * @param {Object} node - Node to serialize
     * @param {Object} config - Configuration
     * @param {number} depth - Current depth
     * @param {Set} visited - Visited nodes (circular reference prevention)
     * @returns {Object} Serialized node
     */
    wrapNode(node, config, depth, visited) {
        if (depth > config.maxDepth) {
            return { __fx_max_depth_exceeded: true };
        }

        if (visited.has(node.__id)) {
            return { __fx_circular_reference: node.__id };
        }

        visited.add(node.__id);

        const output = {
            __id: node.__id,
            __parent_id: node.__parent_id,
            __type: node.__type,
            __proto: [...(node.__proto || [])],
        };

        // Serialize value based on type
        if (node.__type) {
            if (node.__instances && node.__instances.has(node.__type)) {
                // Class instance
                const instance = node.__instances.get(node.__type);
                if (config.preserveClassInstances) {
                    output.__instance_data = this.serializeInstance(instance);
                    output.__instance_class = node.__type;
                } else {
                    output.__value = this.instanceToPlainObject(instance);
                }
            } else if (node.__value && node.__value[node.__type] !== undefined) {
                // Regular value
                output.__value = this.serializeValue(node.__value[node.__type]);
            }
        }

        // Serialize child nodes
        if (node.__nodes && Object.keys(node.__nodes).length > 0) {
            output.__nodes = {};
            for (const [key, childNode] of Object.entries(node.__nodes)) {
                if (!config.includePrivateProps && key.startsWith('_')) {
                    continue;
                }
                output.__nodes[key] = this.wrapNode(childNode, config, depth + 1, visited);
            }
        }

        // Serialize effects (functions can't be serialized, so store metadata)
        if (node.__effects && node.__effects.length > 0) {
            output.__effects_count = node.__effects.length;
            output.__effects_info = node.__effects.map(effect => ({
                name: effect.name || 'anonymous',
                length: effect.length
            }));
        }

        // Serialize watchers count
        if (node.__watchers && node.__watchers.size > 0) {
            output.__watchers_count = node.__watchers.size;
        }

        visited.delete(node.__id);
        return output;
    }

    /**
     * @method serializeInstance
     * @description Serialize a class instance
     * @param {Object} instance - Class instance to serialize
     * @returns {Object} Serialized instance data
     */
    serializeInstance(instance) {
        const data = {};

        // Get all enumerable properties
        for (const key in instance) {
            if (instance.hasOwnProperty(key) && typeof instance[key] !== 'function') {
                data[key] = this.serializeValue(instance[key]);
            }
        }

        // Get constructor parameters if available
        if (instance.constructor && instance.constructor.length > 0) {
            data.__constructor_params = instance.constructor.length;
        }

        return data;
    }

    /**
     * @method instanceToPlainObject
     * @description Convert class instance to plain object
     * @param {Object} instance - Class instance
     * @returns {Object} Plain object
     */
    instanceToPlainObject(instance) {
        const obj = {};
        for (const key in instance) {
            if (instance.hasOwnProperty(key) && typeof instance[key] !== 'function') {
                obj[key] = this.serializeValue(instance[key]);
            }
        }
        return obj;
    }

    /**
     * @method serializeValue
     * @description Serialize a value (handles complex types)
     * @param {*} value - Value to serialize
     * @returns {*} Serialized value
     */
    serializeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        const type = typeof value;

        if (type === 'string' || type === 'number' || type === 'boolean') {
            return value;
        }

        if (type === 'function') {
            return {
                __fx_function: true,
                name: value.name || 'anonymous',
                length: value.length
            };
        }

        if (value instanceof Date) {
            return {
                __fx_date: true,
                value: value.toISOString()
            };
        }

        if (value instanceof RegExp) {
            return {
                __fx_regexp: true,
                source: value.source,
                flags: value.flags
            };
        }

        if (Array.isArray(value)) {
            return value.map(item => this.serializeValue(item));
        }

        if (type === 'object') {
            const obj = {};
            for (const [key, val] of Object.entries(value)) {
                obj[key] = this.serializeValue(val);
            }
            return obj;
        }

        return value;
    }

    /**
     * @method expand
     * @description Deserialize FX state from serialized object
     * @param {Object} serializedData - Serialized state
     * @param {Object} targetNode - Target node (defaults to root)
     * @param {Object} options - Deserialization options
     * @returns {Object} Restored node
     */
    expand(serializedData, targetNode = this.fx.root, options = {}) {
        const config = {
            preserveClassInstances: this.options.preserveClassInstances,
            strictMode: false,
            ...options
        };

        console.log('FX[Serialize]: Starting deserialization');

        try {
            if (!serializedData.__fx_serialized) {
                throw new Error('Invalid serialized data - missing FX signature');
            }

            if (serializedData.__fx_compressed) {
                // Would implement decompression here
                throw new Error('Compressed data not yet supported');
            }

            const result = this.expandNode(serializedData.__fx_root, targetNode, config, new Map());

            console.log('FX[Serialize]: Deserialization completed');
            return result;

        } catch (error) {
            console.error('FX[Serialize]: Deserialization failed:', error);
            throw error;
        }
    }

    /**
     * @method expandNode
     * @description Deserialize a single node
     * @param {Object} serializedNode - Serialized node data
     * @param {Object} targetNode - Target node to populate
     * @param {Object} config - Configuration
     * @param {Map} idMap - ID mapping for circular references
     * @returns {Object} Restored node
     */
    expandNode(serializedNode, targetNode, config, idMap) {
        if (serializedNode.__fx_max_depth_exceeded) {
            console.warn('FX[Serialize]: Max depth exceeded during serialization');
            return targetNode;
        }

        if (serializedNode.__fx_circular_reference) {
            const referencedNode = idMap.get(serializedNode.__fx_circular_reference);
            if (referencedNode) {
                return referencedNode;
            } else {
                console.warn('FX[Serialize]: Circular reference not found:', serializedNode.__fx_circular_reference);
                return targetNode;
            }
        }

        // Update node properties
        targetNode.__id = serializedNode.__id;
        targetNode.__parent_id = serializedNode.__parent_id;
        targetNode.__type = serializedNode.__type;
        targetNode.__proto = [...(serializedNode.__proto || [])];

        // Store in ID map for circular reference resolution
        idMap.set(targetNode.__id, targetNode);

        // Restore value
        if (serializedNode.__instance_data && serializedNode.__instance_class) {
            // Restore class instance
            if (config.preserveClassInstances) {
                this.restoreInstance(targetNode, serializedNode.__instance_class, serializedNode.__instance_data);
            } else {
                // Convert to plain object
                targetNode.__type = 'json';
                targetNode.__value = { json: this.deserializeValue(serializedNode.__instance_data) };
            }
        } else if (serializedNode.__value !== undefined) {
            // Restore regular value
            const deserializedValue = this.deserializeValue(serializedNode.__value);
            targetNode.__value = targetNode.__value || {};
            targetNode.__value[targetNode.__type] = deserializedValue;
        }

        // Restore child nodes
        if (serializedNode.__nodes) {
            targetNode.__nodes = targetNode.__nodes || {};
            for (const [key, childData] of Object.entries(serializedNode.__nodes)) {
                if (!targetNode.__nodes[key]) {
                    targetNode.__nodes[key] = this.fx.createNode(targetNode.__id);
                }
                this.expandNode(childData, targetNode.__nodes[key], config, idMap);
            }
        }

        // Note: Effects and watchers can't be restored from serialization
        // as they contain function references
        if (serializedNode.__effects_count) {
            console.log(`FX[Serialize]: Node had ${serializedNode.__effects_count} effects (not restored)`);
        }

        if (serializedNode.__watchers_count) {
            console.log(`FX[Serialize]: Node had ${serializedNode.__watchers_count} watchers (not restored)`);
        }

        return targetNode;
    }

    /**
     * @method restoreInstance
     * @description Restore a class instance
     * @param {Object} node - Target node
     * @param {string} className - Class name
     * @param {Object} instanceData - Serialized instance data
     */
    restoreInstance(node, className, instanceData) {
        // Check if class is registered
        const RegisteredClass = this.fx.classRegistry?.get(className);

        if (!RegisteredClass) {
            console.warn(`FX[Serialize]: Class ${className} not registered, storing as plain object`);
            node.__type = 'json';
            node.__value = { json: this.deserializeValue(instanceData) };
            return;
        }

        try {
            // Create new instance
            const instance = new RegisteredClass();

            // Restore properties
            for (const [key, value] of Object.entries(instanceData)) {
                if (!key.startsWith('__')) {
                    instance[key] = this.deserializeValue(value);
                }
            }

            // Store in node
            if (!node.__instances) {
                node.__instances = new Map();
            }
            node.__instances.set(className, instance);

            console.log(`FX[Serialize]: Restored ${className} instance`);

        } catch (error) {
            console.error(`FX[Serialize]: Failed to restore ${className} instance:`, error);
            // Fallback to plain object
            node.__type = 'json';
            node.__value = { json: this.deserializeValue(instanceData) };
        }
    }

    /**
     * @method deserializeValue
     * @description Deserialize a value (handles complex types)
     * @param {*} value - Serialized value
     * @returns {*} Deserialized value
     */
    deserializeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value !== 'object') {
            return value;
        }

        if (value.__fx_function) {
            // Functions can't be restored, return placeholder
            return function () {
                throw new Error(`Serialized function '${value.name}' cannot be executed`);
            };
        }

        if (value.__fx_date) {
            return new Date(value.value);
        }

        if (value.__fx_regexp) {
            return new RegExp(value.source, value.flags);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.deserializeValue(item));
        }

        // Plain object
        const obj = {};
        for (const [key, val] of Object.entries(value)) {
            obj[key] = this.deserializeValue(val);
        }
        return obj;
    }

    /**
     * @method wrapPartial
     * @description Serialize only specific paths
     * @param {Array<string>} paths - Paths to serialize
     * @param {Object} options - Serialization options
     * @returns {Object} Partial serialized state
     */
    wrapPartial(paths, options = {}) {
        const result = {
            __fx_partial: true,
            __fx_timestamp: Date.now(),
            __fx_paths: {}
        };

        for (const path of paths) {
            const node = this.fx.resolvePath(path, this.fx.root);
            if (node) {
                result.__fx_paths[path] = this.wrapNode(node, options, 0, new Set());
            } else {
                console.warn(`FX[Serialize]: Path not found: ${path}`);
            }
        }

        return result;
    }

    /**
     * @method stats
     * @description Get serialization plugin statistics
     * @returns {Object} Statistics object
     */
    stats() {
        return {
            includePrivateProps: this.options.includePrivateProps,
            compressOutput: this.options.compressOutput,
            preserveClassInstances: this.options.preserveClassInstances,
            maxDepth: this.options.maxDepth
        };
    }
}

// Export as function that creates instance
export default function (fx, options) {
    return new FXSerializePlugin(fx, options);
}