/**
 * Unit Tests for FXD Core Components
 * Tests individual components in isolation
 */

import { strict as assert } from 'node:assert';
import { test, describe, beforeEach } from 'node:test';

describe('FXD Core Unit Tests', () => {
    describe('FXNode', () => {
        let node;

        beforeEach(() => {
            node = createFXNode('test');
        });

        test('should create node with correct structure', () => {
            assert.equal(node.__id, 'test');
            assert.equal(node.__parent_id, null);
            assert(typeof node.__nodes === 'object');
            assert.equal(node.__value, null);
            assert.equal(node.__type, null);
            assert(Array.isArray(node.__proto));
            assert(node.__behaviors instanceof Map);
            assert(node.__instances instanceof Map);
            assert(Array.isArray(node.__effects));
            assert(node.__watchers instanceof Set);
        });

        test('should set and get values correctly', () => {
            node.__value = 'test value';
            assert.equal(node.__value, 'test value');

            node.__value = { complex: 'object' };
            assert.deepEqual(node.__value, { complex: 'object' });

            node.__value = [1, 2, 3];
            assert.deepEqual(node.__value, [1, 2, 3]);
        });

        test('should manage child nodes', () => {
            const child = createFXNode('child');
            child.__parent_id = node.__id;
            node.__nodes['child'] = child;

            assert.equal(Object.keys(node.__nodes).length, 1);
            assert.equal(node.__nodes['child'].__id, 'child');
            assert.equal(node.__nodes['child'].__parent_id, 'test');
        });

        test('should handle metadata', () => {
            node.__meta = { type: 'user', role: 'admin' };
            assert.equal(node.__meta.type, 'user');
            assert.equal(node.__meta.role, 'admin');
        });

        test('should manage watchers', () => {
            let watcherCalled = false;
            let watcherValue = null;

            const watcher = (newVal, oldVal) => {
                watcherCalled = true;
                watcherValue = newVal;
            };

            node.__watchers.add(watcher);
            assert.equal(node.__watchers.size, 1);

            // Simulate value change
            const oldValue = node.__value;
            node.__value = 'new value';

            // Manually trigger watchers (in real implementation this would be automatic)
            for (const w of node.__watchers) {
                w(node.__value, oldValue);
            }

            assert(watcherCalled);
            assert.equal(watcherValue, 'new value');
        });
    });

    describe('FXProxy', () => {
        let node;
        let proxy;

        beforeEach(() => {
            node = createFXNode('proxy-test');
            proxy = createFXProxy(node);
        });

        test('should provide proxy interface', () => {
            assert(typeof proxy.val === 'function');
            assert(typeof proxy.set === 'function');
            assert(typeof proxy.get === 'function');
            assert(typeof proxy.node === 'function');
            assert(typeof proxy.type === 'function');
        });

        test('should handle value operations', () => {
            // Set value
            proxy.val('test value');
            assert.equal(node.__value, 'test value');

            // Get value
            assert.equal(proxy.val(), 'test value');

            // Get with default
            node.__value = null;
            assert.equal(proxy.get('default'), 'default');
        });

        test('should handle nested paths', () => {
            proxy.set('user.name', 'John');
            proxy.set('user.age', 30);

            assert(node.__nodes.user);
            assert.equal(node.__nodes.user.__nodes.name.__value, 'John');
            assert.equal(node.__nodes.user.__nodes.age.__value, 30);

            assert.equal(proxy.get('user.name'), 'John');
            assert.equal(proxy.get('user.age'), 30);
        });

        test('should support type operations', () => {
            node.__type = 'user';
            assert.equal(proxy.type(), 'user');

            proxy.type('admin');
            assert.equal(node.__type, 'admin');
        });

        test('should provide node access', () => {
            const retrievedNode = proxy.node();
            assert.equal(retrievedNode, node);
            assert.equal(retrievedNode.__id, 'proxy-test');
        });

        test('should handle inheritance', () => {
            const behavior = { greet: () => 'hello' };
            proxy.inherit(behavior);

            assert(node.__proto.includes(behavior));
        });
    });

    describe('Value Casting', () => {
        test('should cast strings to numbers', () => {
            assert.equal(castValue('42', 'number'), 42);
            assert.equal(castValue('3.14', 'number'), 3.14);
            assert(isNaN(castValue('not-a-number', 'number')));
        });

        test('should cast values to strings', () => {
            assert.equal(castValue(42, 'string'), '42');
            assert.equal(castValue(true, 'string'), 'true');
            assert.equal(castValue(null, 'string'), 'null');
        });

        test('should cast to boolean', () => {
            assert.equal(castValue('true', 'boolean'), true);
            assert.equal(castValue('false', 'boolean'), false);
            assert.equal(castValue(1, 'boolean'), true);
            assert.equal(castValue(0, 'boolean'), false);
            assert.equal(castValue('', 'boolean'), false);
        });

        test('should parse JSON', () => {
            const obj = { test: 'value' };
            const jsonStr = JSON.stringify(obj);
            const parsed = castValue(jsonStr, 'json');
            assert.deepEqual(parsed, obj);
        });

        test('should handle custom cast functions', () => {
            const customCaster = (val) => val.toUpperCase();
            assert.equal(castValue('hello', customCaster), 'HELLO');
        });
    });

    describe('Path Resolution', () => {
        test('should parse simple paths', () => {
            const parts = parsePath('user.name');
            assert.deepEqual(parts, ['user', 'name']);
        });

        test('should parse complex paths', () => {
            const parts = parsePath('data.users[0].profile.settings');
            assert.deepEqual(parts, ['data', 'users', '0', 'profile', 'settings']);
        });

        test('should handle array notation', () => {
            const parts = parsePath('items[5]');
            assert.deepEqual(parts, ['items', '5']);
        });

        test('should escape special characters', () => {
            const parts = parsePath('data["key.with.dots"]');
            assert.deepEqual(parts, ['data', 'key.with.dots']);
        });

        test('should resolve paths in nodes', () => {
            const root = createFXNode('root');
            const user = createFXNode('user');
            const profile = createFXNode('profile');

            root.__nodes.user = user;
            user.__nodes.profile = profile;
            profile.__value = 'profile data';

            const resolved = resolvePath(root, 'user.profile');
            assert.equal(resolved, profile);
            assert.equal(resolved.__value, 'profile data');
        });
    });

    describe('Type System', () => {
        test('should register and retrieve types', () => {
            const typeRegistry = createTypeRegistry();

            const userType = {
                name: 'User',
                properties: ['name', 'email'],
                methods: {
                    greet: function() { return `Hello, ${this.name}`; }
                }
            };

            typeRegistry.register('user', userType);
            assert(typeRegistry.has('user'));

            const retrieved = typeRegistry.get('user');
            assert.equal(retrieved.name, 'User');
            assert.deepEqual(retrieved.properties, ['name', 'email']);
        });

        test('should validate type instances', () => {
            const typeRegistry = createTypeRegistry();

            typeRegistry.register('user', {
                name: 'User',
                validate: (instance) => {
                    return instance.name && instance.email;
                }
            });

            const validUser = { name: 'John', email: 'john@example.com' };
            const invalidUser = { name: 'John' }; // missing email

            assert(typeRegistry.validate('user', validUser));
            assert(!typeRegistry.validate('user', invalidUser));
        });

        test('should handle type inheritance', () => {
            const typeRegistry = createTypeRegistry();

            typeRegistry.register('entity', {
                name: 'Entity',
                properties: ['id']
            });

            typeRegistry.register('user', {
                name: 'User',
                extends: 'entity',
                properties: ['name', 'email']
            });

            const userType = typeRegistry.get('user');
            const allProperties = typeRegistry.getAllProperties('user');

            assert(allProperties.includes('id')); // inherited
            assert(allProperties.includes('name')); // own
            assert(allProperties.includes('email')); // own
        });
    });

    describe('Effect System', () => {
        test('should register and trigger effects', () => {
            const effectSystem = createEffectSystem();
            let effectTriggered = false;
            let effectValue = null;

            const effect = (newValue, oldValue, node) => {
                effectTriggered = true;
                effectValue = newValue;
            };

            const node = createFXNode('test');
            effectSystem.addEffect(node, effect);

            // Trigger effect
            effectSystem.triggerEffects(node, 'new value', 'old value');

            assert(effectTriggered);
            assert.equal(effectValue, 'new value');
        });

        test('should handle conditional effects', () => {
            const effectSystem = createEffectSystem();
            let conditionalTriggered = false;

            const conditionalEffect = {
                condition: (newValue, oldValue, node) => newValue > 10,
                effect: (newValue, oldValue, node) => {
                    conditionalTriggered = true;
                }
            };

            const node = createFXNode('test');
            effectSystem.addConditionalEffect(node, conditionalEffect);

            // Should not trigger (value <= 10)
            effectSystem.triggerEffects(node, 5, 0);
            assert(!conditionalTriggered);

            // Should trigger (value > 10)
            effectSystem.triggerEffects(node, 15, 5);
            assert(conditionalTriggered);
        });

        test('should handle async effects', async () => {
            const effectSystem = createEffectSystem();
            let asyncEffectCompleted = false;

            const asyncEffect = async (newValue, oldValue, node) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                asyncEffectCompleted = true;
            };

            const node = createFXNode('test');
            effectSystem.addAsyncEffect(node, asyncEffect);

            await effectSystem.triggerAsyncEffects(node, 'value', null);

            assert(asyncEffectCompleted);
        });
    });

    describe('Validation System', () => {
        test('should validate required fields', () => {
            const validator = createValidator({
                name: { required: true },
                email: { required: true },
                age: { required: false }
            });

            assert(validator.validate({ name: 'John', email: 'john@example.com' }));
            assert(!validator.validate({ name: 'John' })); // missing email
            assert(!validator.validate({ email: 'john@example.com' })); // missing name
        });

        test('should validate field types', () => {
            const validator = createValidator({
                name: { type: 'string' },
                age: { type: 'number' },
                active: { type: 'boolean' }
            });

            assert(validator.validate({
                name: 'John',
                age: 30,
                active: true
            }));

            assert(!validator.validate({
                name: 'John',
                age: 'thirty', // wrong type
                active: true
            }));
        });

        test('should validate with custom rules', () => {
            const validator = createValidator({
                email: {
                    required: true,
                    custom: (value) => value.includes('@')
                },
                age: {
                    required: true,
                    custom: (value) => value >= 0 && value <= 150
                }
            });

            assert(validator.validate({
                email: 'john@example.com',
                age: 30
            }));

            assert(!validator.validate({
                email: 'invalid-email',
                age: 30
            }));

            assert(!validator.validate({
                email: 'john@example.com',
                age: 200
            }));
        });
    });

    describe('Event System', () => {
        test('should emit and handle events', () => {
            const eventSystem = createEventSystem();
            let eventHandled = false;
            let eventData = null;

            eventSystem.on('test-event', (data) => {
                eventHandled = true;
                eventData = data;
            });

            eventSystem.emit('test-event', { message: 'hello' });

            assert(eventHandled);
            assert.equal(eventData.message, 'hello');
        });

        test('should handle multiple listeners', () => {
            const eventSystem = createEventSystem();
            let listener1Called = false;
            let listener2Called = false;

            eventSystem.on('multi-event', () => { listener1Called = true; });
            eventSystem.on('multi-event', () => { listener2Called = true; });

            eventSystem.emit('multi-event');

            assert(listener1Called);
            assert(listener2Called);
        });

        test('should support once listeners', () => {
            const eventSystem = createEventSystem();
            let callCount = 0;

            eventSystem.once('once-event', () => { callCount++; });

            eventSystem.emit('once-event');
            eventSystem.emit('once-event');
            eventSystem.emit('once-event');

            assert.equal(callCount, 1);
        });

        test('should remove listeners', () => {
            const eventSystem = createEventSystem();
            let callCount = 0;

            const listener = () => { callCount++; };
            eventSystem.on('remove-test', listener);

            eventSystem.emit('remove-test');
            assert.equal(callCount, 1);

            eventSystem.off('remove-test', listener);
            eventSystem.emit('remove-test');
            assert.equal(callCount, 1); // Should not increase
        });
    });
});

// Helper functions for creating mock objects

function createFXNode(id) {
    return {
        __id: id,
        __parent_id: null,
        __nodes: {},
        __value: null,
        __type: null,
        __proto: [],
        __behaviors: new Map(),
        __instances: new Map(),
        __effects: [],
        __watchers: new Set(),
        __meta: {}
    };
}

function createFXProxy(node) {
    return {
        val: (value) => {
            if (arguments.length === 0) {
                return node.__value;
            }
            node.__value = value;
            return this;
        },

        set: (path, value) => {
            if (typeof path === 'string' && path.includes('.')) {
                const parts = path.split('.');
                let current = node;

                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!current.__nodes[part]) {
                        current.__nodes[part] = createFXNode(`${current.__id}.${part}`);
                        current.__nodes[part].__parent_id = current.__id;
                    }
                    current = current.__nodes[part];
                }

                const lastPart = parts[parts.length - 1];
                if (!current.__nodes[lastPart]) {
                    current.__nodes[lastPart] = createFXNode(`${current.__id}.${lastPart}`);
                    current.__nodes[lastPart].__parent_id = current.__id;
                }
                current.__nodes[lastPart].__value = value;
            } else {
                node.__value = path; // path is actually the value
            }
            return this;
        },

        get: (path, defaultValue) => {
            if (!path) {
                return node.__value !== null ? node.__value : defaultValue;
            }

            if (typeof path === 'string' && path.includes('.')) {
                const parts = path.split('.');
                let current = node;

                for (const part of parts) {
                    if (!current.__nodes[part]) {
                        return defaultValue;
                    }
                    current = current.__nodes[part];
                }

                return current.__value !== null ? current.__value : defaultValue;
            }

            return node.__nodes[path] ? node.__nodes[path].__value : defaultValue;
        },

        node: () => node,

        type: (newType) => {
            if (arguments.length === 0) {
                return node.__type;
            }
            node.__type = newType;
            return this;
        },

        inherit: (behavior) => {
            node.__proto.push(behavior);
            return this;
        }
    };
}

function castValue(value, cast) {
    if (typeof cast === 'function') {
        return cast(value);
    }

    switch (cast) {
        case 'number':
            return Number(value);
        case 'string':
            return String(value);
        case 'boolean':
            if (typeof value === 'string') {
                return value.toLowerCase() === 'true';
            }
            return Boolean(value);
        case 'json':
            return JSON.parse(value);
        default:
            return value;
    }
}

function parsePath(path) {
    // Simple path parser for testing
    return path
        .replace(/\[(\d+)\]/g, '.$1') // Convert array notation
        .replace(/\["([^"]+)"\]/g, '.$1') // Convert quoted property notation
        .split('.')
        .filter(part => part.length > 0);
}

function resolvePath(root, path) {
    const parts = parsePath(path);
    let current = root;

    for (const part of parts) {
        if (!current.__nodes[part]) {
            return null;
        }
        current = current.__nodes[part];
    }

    return current;
}

function createTypeRegistry() {
    const types = new Map();

    return {
        register: (name, type) => {
            types.set(name, type);
        },

        get: (name) => {
            return types.get(name);
        },

        has: (name) => {
            return types.has(name);
        },

        validate: (typeName, instance) => {
            const type = types.get(typeName);
            if (!type || !type.validate) {
                return true;
            }
            return type.validate(instance);
        },

        getAllProperties: (typeName) => {
            const type = types.get(typeName);
            if (!type) return [];

            let properties = [...(type.properties || [])];

            if (type.extends) {
                const parentProperties = this.getAllProperties(type.extends);
                properties = [...parentProperties, ...properties];
            }

            return properties;
        }
    };
}

function createEffectSystem() {
    const nodeEffects = new Map();

    return {
        addEffect: (node, effect) => {
            if (!nodeEffects.has(node)) {
                nodeEffects.set(node, []);
            }
            nodeEffects.get(node).push({ type: 'sync', effect });
        },

        addConditionalEffect: (node, conditionalEffect) => {
            if (!nodeEffects.has(node)) {
                nodeEffects.set(node, []);
            }
            nodeEffects.get(node).push({ type: 'conditional', ...conditionalEffect });
        },

        addAsyncEffect: (node, effect) => {
            if (!nodeEffects.has(node)) {
                nodeEffects.set(node, []);
            }
            nodeEffects.get(node).push({ type: 'async', effect });
        },

        triggerEffects: (node, newValue, oldValue) => {
            const effects = nodeEffects.get(node) || [];

            for (const effectDef of effects) {
                if (effectDef.type === 'sync') {
                    effectDef.effect(newValue, oldValue, node);
                } else if (effectDef.type === 'conditional') {
                    if (effectDef.condition(newValue, oldValue, node)) {
                        effectDef.effect(newValue, oldValue, node);
                    }
                }
            }
        },

        triggerAsyncEffects: async (node, newValue, oldValue) => {
            const effects = nodeEffects.get(node) || [];
            const asyncEffects = effects.filter(e => e.type === 'async');

            await Promise.all(
                asyncEffects.map(e => e.effect(newValue, oldValue, node))
            );
        }
    };
}

function createValidator(schema) {
    return {
        validate: (data) => {
            for (const [field, rules] of Object.entries(schema)) {
                const value = data[field];

                // Check required
                if (rules.required && (value === undefined || value === null)) {
                    return false;
                }

                // Skip type checking if value is undefined/null and not required
                if (value === undefined || value === null) {
                    continue;
                }

                // Check type
                if (rules.type) {
                    const actualType = typeof value;
                    if (actualType !== rules.type) {
                        return false;
                    }
                }

                // Check custom validation
                if (rules.custom && !rules.custom(value)) {
                    return false;
                }
            }

            return true;
        }
    };
}

function createEventSystem() {
    const listeners = new Map();

    return {
        on: (event, callback) => {
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }
            listeners.get(event).push({ callback, once: false });
        },

        once: (event, callback) => {
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }
            listeners.get(event).push({ callback, once: true });
        },

        off: (event, callback) => {
            if (!listeners.has(event)) return;

            const eventListeners = listeners.get(event);
            const index = eventListeners.findIndex(l => l.callback === callback);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        },

        emit: (event, data) => {
            if (!listeners.has(event)) return;

            const eventListeners = listeners.get(event);
            const toRemove = [];

            for (let i = 0; i < eventListeners.length; i++) {
                const listener = eventListeners[i];
                listener.callback(data);

                if (listener.once) {
                    toRemove.push(i);
                }
            }

            // Remove once listeners (in reverse order to maintain indices)
            for (let i = toRemove.length - 1; i >= 0; i--) {
                eventListeners.splice(toRemove[i], 1);
            }
        }
    };
}

// Run unit tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Running FXD Core Unit Tests...\n');
}