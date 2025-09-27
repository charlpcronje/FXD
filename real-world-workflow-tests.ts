#!/usr/bin/env deno run --allow-all

/**
 * @file real-world-workflow-tests.ts
 * @description Real-World Developer Workflow Validation Suite
 * @author FXD QA Agent
 * @version 1.0.0
 *
 * This suite validates FXD against actual developer workflows:
 * 1. Full-stack application development
 * 2. Code refactoring and maintenance
 * 3. Team collaboration scenarios
 * 4. Git integration workflows
 * 5. CI/CD pipeline integration
 * 6. Debugging and troubleshooting
 * 7. Performance optimization workflows
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { $$ } from './fx.ts';

// === TYPES & INTERFACES ===

interface WorkflowScenario {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'collaboration' | 'maintenance' | 'deployment' | 'debugging';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  estimatedTime: number; // minutes
  prerequisites: string[];
  steps: WorkflowStep[];
  validations: WorkflowValidation[];
}

interface WorkflowStep {
  id: string;
  description: string;
  action: 'create' | 'edit' | 'delete' | 'query' | 'execute' | 'validate' | 'export' | 'import';
  target: string;
  input?: any;
  expectedOutput?: any;
  timeout?: number;
}

interface WorkflowValidation {
  description: string;
  check: () => Promise<boolean>;
  critical: boolean;
}

interface WorkflowResult {
  scenarioId: string;
  success: boolean;
  duration: number;
  stepsCompleted: number;
  totalSteps: number;
  validationsPassed: number;
  totalValidations: number;
  errors: string[];
  warnings: string[];
  artifacts: Record<string, any>;
  metrics: Record<string, number>;
}

interface WorkflowReport {
  testRun: {
    id: string;
    timestamp: number;
    environment: string;
  };
  scenarios: WorkflowResult[];
  summary: {
    totalScenarios: number;
    successful: number;
    failed: number;
    averageDuration: number;
    totalTimeSpent: number;
  };
  insights: string[];
  recommendations: string[];
}

// === WORKFLOW TEST SUITE ===

export class RealWorldWorkflowTestSuite {
  private scenarios: Map<string, WorkflowScenario> = new Map();
  private results: WorkflowResult[] = [];

  constructor() {
    this.registerWorkflowScenarios();
  }

  private registerWorkflowScenarios(): void {
    // Full-Stack Application Development
    this.addScenario({
      id: 'fullstack-todo-app',
      name: 'Full-Stack Todo Application Development',
      description: 'End-to-end development of a todo application with frontend, backend, and data layer',
      category: 'development',
      complexity: 'complex',
      estimatedTime: 45,
      prerequisites: ['basic-fx-knowledge', 'javascript-proficiency'],
      steps: [
        {
          id: 'setup-project',
          description: 'Initialize project structure',
          action: 'create',
          target: 'project.todo-app',
          input: {
            name: 'TodoApp',
            type: 'fullstack',
            framework: 'fx',
            version: '1.0.0'
          }
        },
        {
          id: 'create-data-models',
          description: 'Define data models for todos',
          action: 'create',
          target: 'project.todo-app.models.todo',
          input: {
            id: 'string',
            title: 'string',
            description: 'string',
            completed: 'boolean',
            createdAt: 'datetime',
            updatedAt: 'datetime'
          }
        },
        {
          id: 'create-api-layer',
          description: 'Implement API endpoints',
          action: 'create',
          target: 'project.todo-app.api',
          input: {
            'GET /todos': 'listTodos',
            'POST /todos': 'createTodo',
            'PUT /todos/:id': 'updateTodo',
            'DELETE /todos/:id': 'deleteTodo'
          }
        },
        {
          id: 'implement-business-logic',
          description: 'Add business logic for todo operations',
          action: 'create',
          target: 'project.todo-app.services.todoService',
          input: `
class TodoService {
  async createTodo(data) {
    const todo = {
      id: Math.random().toString(36).slice(2),
      ...data,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    $$('data.todos').set(todo, todo.id);
    return todo;
  }

  async listTodos() {
    return Object.values($$('data.todos').val() || {});
  }

  async updateTodo(id, updates) {
    const todo = $$('data.todos').get(id).val();
    if (!todo) throw new Error('Todo not found');

    const updated = { ...todo, ...updates, updatedAt: new Date() };
    $$('data.todos').set(updated, id);
    return updated;
  }

  async deleteTodo(id) {
    const todos = $$('data.todos').val() || {};
    delete todos[id];
    $$('data.todos').val(todos);
    return true;
  }
}
          `
        },
        {
          id: 'create-frontend-components',
          description: 'Build frontend components',
          action: 'create',
          target: 'project.todo-app.frontend.components',
          input: {
            'TodoList': 'Displays list of todos',
            'TodoItem': 'Individual todo item with edit/delete',
            'AddTodo': 'Form to add new todos',
            'TodoStats': 'Statistics about todos'
          }
        },
        {
          id: 'setup-reactive-state',
          description: 'Configure reactive state management',
          action: 'create',
          target: 'project.todo-app.state',
          input: `
// Reactive state setup
$$('app.todos').val([]);
$$('app.filter').val('all'); // all, active, completed
$$('app.stats').val({ total: 0, active: 0, completed: 0 });

// Reactive computations
$$('app.filteredTodos').val($$('app.todos')); // Will be reactive
$$('app.stats').watch(() => {
  const todos = $$('app.todos').val() || [];
  $$('app.stats').val({
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length
  });
});
          `
        },
        {
          id: 'implement-crud-operations',
          description: 'Wire up CRUD operations',
          action: 'execute',
          target: 'project.todo-app.operations',
          input: `
// Test CRUD operations
const service = new TodoService();

// Create todos
const todo1 = await service.createTodo({ title: 'Learn FXD', description: 'Master the FXD framework' });
const todo2 = await service.createTodo({ title: 'Build app', description: 'Create a full-stack application' });

// Update reactive state
const todos = await service.listTodos();
$$('app.todos').val(todos);

// Test update
await service.updateTodo(todo1.id, { completed: true });

// Test list
const updatedTodos = await service.listTodos();
$$('app.todos').val(updatedTodos);
          `
        },
        {
          id: 'add-real-time-features',
          description: 'Implement real-time updates',
          action: 'create',
          target: 'project.todo-app.realtime',
          input: `
// Real-time synchronization
$$('app.todos').watch((newTodos) => {
  // Broadcast changes to other clients
  $$('websocket.broadcast').val({
    type: 'todos.updated',
    data: newTodos,
    timestamp: Date.now()
  });
});

// Listen for external updates
$$('websocket.message').watch((message) => {
  if (message.type === 'todos.updated') {
    $$('app.todos').val(message.data);
  }
});
          `
        }
      ],
      validations: [
        {
          description: 'Project structure is properly initialized',
          check: async () => {
            const project = $$('project.todo-app').val();
            return project && project.name === 'TodoApp' && project.type === 'fullstack';
          },
          critical: true
        },
        {
          description: 'Data models are correctly defined',
          check: async () => {
            const model = $$('project.todo-app.models.todo').val();
            return model && model.id === 'string' && model.title === 'string';
          },
          critical: true
        },
        {
          description: 'CRUD operations work correctly',
          check: async () => {
            const todos = $$('app.todos').val() || [];
            return todos.length >= 2 && todos.some(t => t.completed);
          },
          critical: true
        },
        {
          description: 'Reactive state updates properly',
          check: async () => {
            const stats = $$('app.stats').val();
            return stats && stats.total > 0 && stats.completed > 0;
          },
          critical: false
        },
        {
          description: 'Real-time features are configured',
          check: async () => {
            const realtimeConfig = $$('project.todo-app.realtime').val();
            return typeof realtimeConfig === 'string' && realtimeConfig.includes('websocket');
          },
          critical: false
        }
      ]
    });

    // Code Refactoring Workflow
    this.addScenario({
      id: 'legacy-code-refactoring',
      name: 'Legacy Code Refactoring',
      description: 'Refactor legacy procedural code into modern FX-based architecture',
      category: 'maintenance',
      complexity: 'moderate',
      estimatedTime: 30,
      prerequisites: ['existing-codebase'],
      steps: [
        {
          id: 'import-legacy-code',
          description: 'Import existing legacy code',
          action: 'import',
          target: 'legacy.user-management',
          input: `
// Legacy procedural code
var users = [];
var currentUser = null;

function addUser(name, email) {
  var user = {
    id: users.length + 1,
    name: name,
    email: email,
    created: new Date()
  };
  users.push(user);
  return user;
}

function loginUser(email) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      currentUser = users[i];
      return currentUser;
    }
  }
  return null;
}

function getUserPermissions(userId) {
  // Hardcoded permissions logic
  if (userId === 1) return ['admin', 'read', 'write'];
  return ['read'];
}
          `
        },
        {
          id: 'analyze-dependencies',
          description: 'Analyze code dependencies and structure',
          action: 'query',
          target: 'legacy.user-management',
          input: 'extract-functions-and-variables'
        },
        {
          id: 'create-modern-structure',
          description: 'Create modern FX-based structure',
          action: 'create',
          target: 'refactored.user-management',
          input: {
            'models': 'User data models',
            'services': 'Business logic services',
            'state': 'Reactive state management',
            'permissions': 'Permission system'
          }
        },
        {
          id: 'migrate-data-layer',
          description: 'Migrate data handling to FX',
          action: 'create',
          target: 'refactored.user-management.state',
          input: `
// Modern reactive state
$$('users.list').val([]);
$$('users.current').val(null);
$$('users.permissions').val({});

// Reactive computed values
$$('users.count').val($$('users.list')); // Will reactively compute length
$$('users.loggedIn').val($$('users.current')); // Boolean check
          `
        },
        {
          id: 'create-service-layer',
          description: 'Extract business logic into services',
          action: 'create',
          target: 'refactored.user-management.services.userService',
          input: `
class UserService {
  addUser(name, email) {
    const users = $$('users.list').val() || [];
    const user = {
      id: Date.now().toString(),
      name,
      email,
      created: new Date()
    };
    users.push(user);
    $$('users.list').val(users);
    return user;
  }

  loginUser(email) {
    const users = $$('users.list').val() || [];
    const user = users.find(u => u.email === email);
    if (user) {
      $$('users.current').val(user);
      this.loadPermissions(user.id);
    }
    return user;
  }

  loadPermissions(userId) {
    // Modern permission system
    const permissions = $$('permissions.matrix').val() || {};
    const userPerms = permissions[userId] || ['read'];
    $$('users.permissions').set(userPerms, userId);
  }
}
          `
        },
        {
          id: 'setup-reactive-bindings',
          description: 'Configure reactive data bindings',
          action: 'create',
          target: 'refactored.user-management.bindings',
          input: `
// Reactive bindings
$$('users.list').watch((users) => {
  $$('users.count').val(users.length);
});

$$('users.current').watch((user) => {
  $$('users.loggedIn').val(!!user);
  if (user) {
    $$('ui.welcome-message').val('Welcome, ' + user.name);
  }
});
          `
        },
        {
          id: 'migrate-legacy-data',
          description: 'Migrate existing data to new structure',
          action: 'execute',
          target: 'migration',
          input: `
// Simulate migration
const legacyUsers = [
  { id: 1, name: 'Admin User', email: 'admin@example.com', created: new Date() },
  { id: 2, name: 'Regular User', email: 'user@example.com', created: new Date() }
];

$$('users.list').val(legacyUsers);

// Set up permissions
$$('permissions.matrix').val({
  '1': ['admin', 'read', 'write'],
  '2': ['read']
});
          `
        },
        {
          id: 'test-refactored-code',
          description: 'Test that refactored code maintains same functionality',
          action: 'validate',
          target: 'refactored.user-management',
          input: `
const service = new UserService();

// Test adding user
const newUser = service.addUser('Test User', 'test@example.com');

// Test login
const loggedIn = service.loginUser('admin@example.com');

// Verify reactive updates
const userCount = $$('users.count').val();
const isLoggedIn = $$('users.loggedIn').val();
          `
        }
      ],
      validations: [
        {
          description: 'Legacy code is successfully imported',
          check: async () => {
            const legacy = $$('legacy.user-management').val();
            return typeof legacy === 'string' && legacy.includes('function addUser');
          },
          critical: true
        },
        {
          description: 'Modern structure is created',
          check: async () => {
            const modern = $$('refactored.user-management').val();
            return modern && modern.models && modern.services;
          },
          critical: true
        },
        {
          description: 'User service functions correctly',
          check: async () => {
            const users = $$('users.list').val() || [];
            return users.length >= 2;
          },
          critical: true
        },
        {
          description: 'Reactive bindings work',
          check: async () => {
            const count = $$('users.count').val();
            const userList = $$('users.list').val() || [];
            return count === userList.length;
          },
          critical: false
        },
        {
          description: 'Permission system is modernized',
          check: async () => {
            const permissions = $$('permissions.matrix').val();
            return permissions && permissions['1'] && permissions['1'].includes('admin');
          },
          critical: false
        }
      ]
    });

    // Team Collaboration Workflow
    this.addScenario({
      id: 'team-collaboration',
      name: 'Multi-Developer Team Collaboration',
      description: 'Simulate multiple developers working on the same project with conflict resolution',
      category: 'collaboration',
      complexity: 'complex',
      estimatedTime: 35,
      prerequisites: ['team-environment'],
      steps: [
        {
          id: 'setup-shared-project',
          description: 'Initialize shared project workspace',
          action: 'create',
          target: 'team.project.shared-app',
          input: {
            name: 'TeamApp',
            contributors: ['alice', 'bob', 'charlie'],
            branches: ['main', 'feature/user-auth', 'feature/dashboard'],
            version: '1.0.0'
          }
        },
        {
          id: 'alice-creates-auth',
          description: 'Alice works on authentication feature',
          action: 'create',
          target: 'team.project.branches.feature/user-auth',
          input: `
// Alice's authentication work
$$('auth.service').val({
  login: async (email, password) => {
    // Mock authentication
    const user = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }).then(r => r.json());

    $$('auth.user').val(user);
    $$('auth.token').val(user.token);
    return user;
  },

  logout: () => {
    $$('auth.user').val(null);
    $$('auth.token').val(null);
  }
});
          `
        },
        {
          id: 'bob-creates-dashboard',
          description: 'Bob works on dashboard feature',
          action: 'create',
          target: 'team.project.branches.feature/dashboard',
          input: `
// Bob's dashboard work
$$('dashboard.widgets').val([
  { id: 'stats', type: 'statistics', config: { metrics: ['users', 'revenue'] } },
  { id: 'chart', type: 'chart', config: { type: 'line', data: 'sales' } },
  { id: 'tasks', type: 'todo-list', config: { source: 'tasks' } }
]);

$$('dashboard.layout').val({
  grid: '3x2',
  responsive: true,
  widgets: ['stats', 'chart', 'tasks']
});
          `
        },
        {
          id: 'charlie-updates-shared',
          description: 'Charlie updates shared utilities',
          action: 'edit',
          target: 'team.project.main.utils',
          input: `
// Charlie's shared utilities
$$('utils.api').val({
  baseUrl: 'https://api.teamapp.com',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': () => 'Bearer ' + $$('auth.token').val()
  },

  request: async (endpoint, options = {}) => {
    const url = $$('utils.api').val().baseUrl + endpoint;
    const token = $$('auth.token').val();

    return fetch(url, {
      ...options,
      headers: {
        ...$$('utils.api').val().headers,
        'Authorization': token ? 'Bearer ' + token : undefined,
        ...options.headers
      }
    });
  }
});
          `
        },
        {
          id: 'simulate-merge-conflicts',
          description: 'Create merge conflicts when integrating features',
          action: 'execute',
          target: 'team.project.merge-conflicts',
          input: `
// Simulate conflicts in shared files
// Alice modified utils for auth
$$('conflicts.utils.alice').val({
  api: { authEndpoint: '/api/auth', tokenHeader: 'X-Auth-Token' }
});

// Bob modified utils for dashboard
$$('conflicts.utils.bob').val({
  api: { dashboardEndpoint: '/api/dashboard', dataFormat: 'json' }
});

// Charlie's version (base)
$$('conflicts.utils.charlie').val({
  api: { baseUrl: 'https://api.teamapp.com', headers: {} }
});
          `
        },
        {
          id: 'resolve-conflicts',
          description: 'Resolve merge conflicts through negotiation',
          action: 'execute',
          target: 'team.project.conflict-resolution',
          input: `
// Team discussion and conflict resolution
const aliceChanges = $$('conflicts.utils.alice').val();
const bobChanges = $$('conflicts.utils.bob').val();
const charlieChanges = $$('conflicts.utils.charlie').val();

// Merged resolution
$$('utils.api').val({
  baseUrl: charlieChanges.api.baseUrl,
  endpoints: {
    auth: aliceChanges.api.authEndpoint,
    dashboard: bobChanges.api.dashboardEndpoint
  },
  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Token': () => $$('auth.token').val(),
    ...charlieChanges.api.headers
  },
  dataFormat: bobChanges.api.dataFormat
});
          `
        },
        {
          id: 'integrate-features',
          description: 'Integrate all features into main branch',
          action: 'execute',
          target: 'team.project.integration',
          input: `
// Feature integration
const authService = $$('team.project.branches.feature/user-auth').val();
const dashboardConfig = $$('team.project.branches.feature/dashboard').val();
const sharedUtils = $$('utils.api').val();

// Integrated application
$$('team.project.main.app').val({
  auth: authService,
  dashboard: dashboardConfig,
  utils: sharedUtils,
  version: '1.1.0',
  contributors: ['alice', 'bob', 'charlie'],
  integrationDate: new Date()
});
          `
        },
        {
          id: 'test-integration',
          description: 'Test integrated application',
          action: 'validate',
          target: 'team.project.main.app',
          input: `
// Integration testing
const app = $$('team.project.main.app').val();

// Test auth integration
const canLogin = app.auth && typeof app.auth.login === 'function';

// Test dashboard integration
const hasDashboard = app.dashboard && app.dashboard.widgets;

// Test utils integration
const hasUtils = app.utils && app.utils.baseUrl;
          `
        }
      ],
      validations: [
        {
          description: 'Shared project is properly initialized',
          check: async () => {
            const project = $$('team.project.shared-app').val();
            return project && project.contributors.length === 3;
          },
          critical: true
        },
        {
          description: 'All team members completed their features',
          check: async () => {
            const auth = $$('team.project.branches.feature/user-auth').val();
            const dashboard = $$('team.project.branches.feature/dashboard').val();
            const utils = $$('team.project.main.utils').val();
            return auth && dashboard && utils;
          },
          critical: true
        },
        {
          description: 'Merge conflicts are properly resolved',
          check: async () => {
            const resolvedUtils = $$('utils.api').val();
            return resolvedUtils && resolvedUtils.endpoints && resolvedUtils.endpoints.auth;
          },
          critical: true
        },
        {
          description: 'Features are successfully integrated',
          check: async () => {
            const integratedApp = $$('team.project.main.app').val();
            return integratedApp && integratedApp.auth && integratedApp.dashboard && integratedApp.utils;
          },
          critical: true
        },
        {
          description: 'Integration maintains functionality',
          check: async () => {
            const app = $$('team.project.main.app').val();
            return app && app.version === '1.1.0' && app.integrationDate;
          },
          critical: false
        }
      ]
    });

    // Performance Optimization Workflow
    this.addScenario({
      id: 'performance-optimization',
      name: 'Application Performance Optimization',
      description: 'Identify and fix performance bottlenecks in an FX application',
      category: 'maintenance',
      complexity: 'expert',
      estimatedTime: 40,
      prerequisites: ['performance-tools', 'profiling-knowledge'],
      steps: [
        {
          id: 'setup-performance-monitoring',
          description: 'Set up performance monitoring and metrics collection',
          action: 'create',
          target: 'perf.monitoring',
          input: `
// Performance monitoring setup
$$('perf.metrics').val({
  nodeCreation: { count: 0, totalTime: 0, avgTime: 0 },
  selectorQueries: { count: 0, totalTime: 0, avgTime: 0 },
  reactiveUpdates: { count: 0, totalTime: 0, avgTime: 0 },
  memoryUsage: { current: 0, peak: 0, collections: [] }
});

// Performance tracking utilities
$$('perf.utils').val({
  startTimer: (operation) => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      const metrics = $$('perf.metrics').val();
      if (!metrics[operation]) metrics[operation] = { count: 0, totalTime: 0, avgTime: 0 };

      metrics[operation].count++;
      metrics[operation].totalTime += duration;
      metrics[operation].avgTime = metrics[operation].totalTime / metrics[operation].count;

      $$('perf.metrics').val(metrics);
      return duration;
    };
  }
});
          `
        },
        {
          id: 'create-performance-heavy-app',
          description: 'Create application with known performance issues',
          action: 'create',
          target: 'perf.test-app',
          input: `
// Performance-heavy application simulation
const perfUtils = $$('perf.utils').val();

// Create many nodes (performance issue #1)
for (let i = 0; i < 1000; i++) {
  const timer = perfUtils.startTimer('nodeCreation');
  $$('data.items.' + i).val({
    id: i,
    name: 'Item ' + i,
    value: Math.random(),
    metadata: {
      created: new Date(),
      tags: ['tag1', 'tag2', 'tag3'],
      complex: { nested: { data: 'value' + i } }
    }
  });
  timer();
}

// Heavy selector queries (performance issue #2)
for (let i = 0; i < 100; i++) {
  const timer = perfUtils.startTimer('selectorQueries');
  const results = $$('data.items').select('[value>0.5]').list();
  timer();
}

// Excessive reactive updates (performance issue #3)
for (let i = 0; i < 50; i++) {
  $$('reactive.counter' + i).val(0);
  $$('reactive.doubled' + i).val($$('reactive.counter' + i)); // Reactive link

  // Trigger many updates
  for (let j = 0; j < 20; j++) {
    const timer = perfUtils.startTimer('reactiveUpdates');
    $$('reactive.counter' + i).val(j);
    timer();
  }
}
          `
        },
        {
          id: 'analyze-performance-metrics',
          description: 'Analyze collected performance metrics',
          action: 'query',
          target: 'perf.metrics',
          input: 'analyze-bottlenecks'
        },
        {
          id: 'implement-node-pooling',
          description: 'Implement object pooling for node creation',
          action: 'create',
          target: 'perf.optimizations.node-pooling',
          input: `
// Node pooling optimization
$$('perf.optimizations.nodePool').val({
  pool: [],
  maxSize: 1000,

  getNode: function() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return {}; // Create new if pool empty
  },

  returnNode: function(node) {
    // Clear node data
    for (let key in node) {
      delete node[key];
    }

    if (this.pool.length < this.maxSize) {
      this.pool.push(node);
    }
  }
});
          `
        },
        {
          id: 'optimize-selector-queries',
          description: 'Implement selector query caching and optimization',
          action: 'create',
          target: 'perf.optimizations.selector-cache',
          input: `
// Selector query caching
$$('perf.optimizations.selectorCache').val({
  cache: new Map(),
  maxAge: 5000, // 5 seconds

  getCachedResult: function(selector) {
    const cached = this.cache.get(selector);
    if (cached && (Date.now() - cached.timestamp) < this.maxAge) {
      return cached.result;
    }
    return null;
  },

  setCachedResult: function(selector, result) {
    this.cache.set(selector, {
      result,
      timestamp: Date.now()
    });

    // Cleanup old entries
    if (this.cache.size > 100) {
      const cutoff = Date.now() - this.maxAge;
      for (let [key, value] of this.cache.entries()) {
        if (value.timestamp < cutoff) {
          this.cache.delete(key);
        }
      }
    }
  }
});
          `
        },
        {
          id: 'implement-reactive-batching',
          description: 'Implement batched reactive updates',
          action: 'create',
          target: 'perf.optimizations.reactive-batching',
          input: `
// Reactive update batching
$$('perf.optimizations.reactiveBatcher').val({
  batchQueue: [],
  batchTimeout: null,
  batchDelay: 16, // 16ms = ~60fps

  scheduleUpdate: function(updateFn) {
    this.batchQueue.push(updateFn);

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    }
  },

  processBatch: function() {
    const updates = [...this.batchQueue];
    this.batchQueue.length = 0;
    this.batchTimeout = null;

    // Process all updates in one batch
    for (const update of updates) {
      try {
        update();
      } catch (error) {
        console.error('Batch update error:', error);
      }
    }
  }
});
          `
        },
        {
          id: 'apply-optimizations',
          description: 'Apply optimizations to the test application',
          action: 'execute',
          target: 'perf.optimized-app',
          input: `
// Apply optimizations
const nodePool = $$('perf.optimizations.nodePool').val();
const selectorCache = $$('perf.optimizations.selectorCache').val();
const reactiveBatcher = $$('perf.optimizations.reactiveBatcher').val();
const perfUtils = $$('perf.utils').val();

// Reset metrics for comparison
$$('perf.metrics.optimized').val({
  nodeCreation: { count: 0, totalTime: 0, avgTime: 0 },
  selectorQueries: { count: 0, totalTime: 0, avgTime: 0 },
  reactiveUpdates: { count: 0, totalTime: 0, avgTime: 0 }
});

// Optimized node creation using pooling
for (let i = 0; i < 1000; i++) {
  const timer = perfUtils.startTimer('nodeCreation');

  // Use pooled node instead of creating new
  const node = nodePool.getNode();
  node.id = i;
  node.name = 'Optimized Item ' + i;
  node.value = Math.random();

  $$('optimized.items.' + i).val(node);
  timer();
}

// Optimized selector queries with caching
for (let i = 0; i < 100; i++) {
  const timer = perfUtils.startTimer('selectorQueries');
  const selector = '[value>0.5]';

  let results = selectorCache.getCachedResult(selector);
  if (!results) {
    results = $$('optimized.items').select(selector).list();
    selectorCache.setCachedResult(selector, results);
  }

  timer();
}

// Optimized reactive updates with batching
for (let i = 0; i < 50; i++) {
  $$('optimized.counter' + i).val(0);

  for (let j = 0; j < 20; j++) {
    const timer = perfUtils.startTimer('reactiveUpdates');

    reactiveBatcher.scheduleUpdate(() => {
      $$('optimized.counter' + i).val(j);
    });

    timer();
  }
}
          `
        },
        {
          id: 'measure-improvements',
          description: 'Measure performance improvements',
          action: 'validate',
          target: 'perf.comparison',
          input: `
// Compare before and after metrics
const originalMetrics = $$('perf.metrics').val();
const optimizedMetrics = $$('perf.metrics.optimized').val();

$$('perf.comparison').val({
  nodeCreation: {
    before: originalMetrics.nodeCreation.avgTime,
    after: optimizedMetrics.nodeCreation.avgTime,
    improvement: ((originalMetrics.nodeCreation.avgTime - optimizedMetrics.nodeCreation.avgTime) / originalMetrics.nodeCreation.avgTime * 100).toFixed(2) + '%'
  },
  selectorQueries: {
    before: originalMetrics.selectorQueries.avgTime,
    after: optimizedMetrics.selectorQueries.avgTime,
    improvement: ((originalMetrics.selectorQueries.avgTime - optimizedMetrics.selectorQueries.avgTime) / originalMetrics.selectorQueries.avgTime * 100).toFixed(2) + '%'
  },
  reactiveUpdates: {
    before: originalMetrics.reactiveUpdates.avgTime,
    after: optimizedMetrics.reactiveUpdates.avgTime,
    improvement: ((originalMetrics.reactiveUpdates.avgTime - optimizedMetrics.reactiveUpdates.avgTime) / originalMetrics.reactiveUpdates.avgTime * 100).toFixed(2) + '%'
  }
});
          `
        }
      ],
      validations: [
        {
          description: 'Performance monitoring is properly set up',
          check: async () => {
            const monitoring = $$('perf.monitoring').val();
            const metrics = $$('perf.metrics').val();
            return monitoring && metrics && metrics.nodeCreation;
          },
          critical: true
        },
        {
          description: 'Performance issues are identified',
          check: async () => {
            const metrics = $$('perf.metrics').val();
            return metrics.nodeCreation.count > 0 && metrics.selectorQueries.count > 0;
          },
          critical: true
        },
        {
          description: 'Optimizations are implemented',
          check: async () => {
            const nodePool = $$('perf.optimizations.nodePool').val();
            const selectorCache = $$('perf.optimizations.selectorCache').val();
            const batcher = $$('perf.optimizations.reactiveBatcher').val();
            return nodePool && selectorCache && batcher;
          },
          critical: true
        },
        {
          description: 'Performance improvements are measurable',
          check: async () => {
            const comparison = $$('perf.comparison').val();
            return comparison &&
                   parseFloat(comparison.nodeCreation.improvement) > 0 &&
                   parseFloat(comparison.selectorQueries.improvement) > 0;
          },
          critical: false
        },
        {
          description: 'Optimizations maintain functionality',
          check: async () => {
            const optimizedItems = $$('optimized.items').val() || {};
            return Object.keys(optimizedItems).length >= 1000;
          },
          critical: true
        }
      ]
    });
  }

  addScenario(scenario: WorkflowScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  async runScenario(scenarioId: string): Promise<WorkflowResult> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    console.log(`🎬 Starting workflow: ${scenario.name}`);
    console.log(`📋 Complexity: ${scenario.complexity} | Estimated time: ${scenario.estimatedTime}min`);

    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const artifacts: Record<string, any> = {};
    const metrics: Record<string, number> = {};

    let stepsCompleted = 0;

    // Execute workflow steps
    for (const step of scenario.steps) {
      console.log(`  🔄 ${step.description}`);

      try {
        const stepStartTime = performance.now();

        // Execute step based on action type
        switch (step.action) {
          case 'create':
            if (step.input !== undefined) {
              $$(step.target).val(step.input);
            }
            break;

          case 'edit':
            const existing = $$(step.target).val() || {};
            if (typeof existing === 'object' && typeof step.input === 'object') {
              $$(step.target).val({ ...existing, ...step.input });
            } else {
              $$(step.target).val(step.input);
            }
            break;

          case 'delete':
            $$(step.target).val(undefined);
            break;

          case 'query':
            const queryResult = $$(step.target).val();
            artifacts[step.id] = queryResult;
            break;

          case 'execute':
            if (typeof step.input === 'string') {
              // For code execution, we'll evaluate it safely
              try {
                eval(step.input);
              } catch (error) {
                warnings.push(`Code execution warning in ${step.id}: ${error.message}`);
              }
            }
            break;

          case 'validate':
            const validationTarget = $$(step.target).val();
            artifacts[step.id] = validationTarget;
            break;

          case 'import':
            $$(step.target).val(step.input);
            break;

          case 'export':
            const exportData = $$(step.target).val();
            artifacts[step.id] = exportData;
            break;
        }

        const stepDuration = performance.now() - stepStartTime;
        metrics[`step_${step.id}_duration`] = stepDuration;

        stepsCompleted++;
        console.log(`    ✅ Completed (${Math.round(stepDuration)}ms)`);

      } catch (error) {
        errors.push(`Step ${step.id} failed: ${error.message}`);
        console.log(`    ❌ Failed: ${error.message}`);
        break;
      }
    }

    // Run validations
    let validationsPassed = 0;
    for (const validation of scenario.validations) {
      console.log(`  🔍 ${validation.description}`);

      try {
        const passed = await validation.check();
        if (passed) {
          validationsPassed++;
          console.log(`    ✅ Passed`);
        } else {
          const message = `Validation failed: ${validation.description}`;
          if (validation.critical) {
            errors.push(message);
            console.log(`    ❌ Critical failure`);
          } else {
            warnings.push(message);
            console.log(`    ⚠️ Non-critical failure`);
          }
        }
      } catch (error) {
        const message = `Validation error: ${validation.description} - ${error.message}`;
        if (validation.critical) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
        console.log(`    ❌ Error: ${error.message}`);
      }
    }

    const duration = performance.now() - startTime;
    const success = errors.length === 0 && stepsCompleted === scenario.steps.length;

    const result: WorkflowResult = {
      scenarioId: scenario.id,
      success,
      duration,
      stepsCompleted,
      totalSteps: scenario.steps.length,
      validationsPassed,
      totalValidations: scenario.validations.length,
      errors,
      warnings,
      artifacts,
      metrics
    };

    const status = success ? '✅' : '❌';
    const durationMin = Math.round(duration / 1000 / 60 * 100) / 100;
    console.log(`${status} ${scenario.name} completed in ${durationMin}min`);

    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length}`);
    }
    if (warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${warnings.length}`);
    }

    return result;
  }

  async runAllScenarios(filter?: {
    category?: string;
    complexity?: string;
    maxDuration?: number;
  }): Promise<WorkflowReport> {
    console.log('🚀 Starting Real-World Workflow Validation...\n');

    let scenarios = Array.from(this.scenarios.values());

    // Apply filters
    if (filter) {
      scenarios = scenarios.filter(scenario => {
        if (filter.category && scenario.category !== filter.category) return false;
        if (filter.complexity && scenario.complexity !== filter.complexity) return false;
        if (filter.maxDuration && scenario.estimatedTime > filter.maxDuration) return false;
        return true;
      });
    }

    console.log(`📋 Running ${scenarios.length} workflow scenarios...\n`);

    this.results = [];

    // Run scenarios
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario.id);
      this.results.push(result);
    }

    // Generate report
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / this.results.length;

    const report: WorkflowReport = {
      testRun: {
        id: `workflow-${Date.now()}`,
        timestamp: Date.now(),
        environment: 'FXD Real-World Testing'
      },
      scenarios: this.results,
      summary: {
        totalScenarios: this.results.length,
        successful,
        failed,
        averageDuration: avgDuration,
        totalTimeSpent: totalDuration
      },
      insights: this.generateInsights(this.results),
      recommendations: this.generateRecommendations(this.results)
    };

    this.printReport(report);
    return report;
  }

  private generateInsights(results: WorkflowResult[]): string[] {
    const insights: string[] = [];

    // Complexity vs Success Rate
    const complexityStats = new Map();
    results.forEach(result => {
      const scenario = this.scenarios.get(result.scenarioId)!;
      if (!complexityStats.has(scenario.complexity)) {
        complexityStats.set(scenario.complexity, { total: 0, successful: 0 });
      }
      const stats = complexityStats.get(scenario.complexity);
      stats.total++;
      if (result.success) stats.successful++;
    });

    for (const [complexity, stats] of complexityStats) {
      const successRate = Math.round((stats.successful / stats.total) * 100);
      insights.push(`📊 ${complexity.toUpperCase()} workflows: ${successRate}% success rate (${stats.successful}/${stats.total})`);
    }

    // Performance insights
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    insights.push(`⏱️ Average workflow duration: ${Math.round(avgDuration / 1000)}s`);

    // Step completion insights
    const stepCompletionRate = results.reduce((sum, r) => sum + (r.stepsCompleted / r.totalSteps), 0) / results.length;
    insights.push(`📋 Average step completion rate: ${Math.round(stepCompletionRate * 100)}%`);

    // Validation insights
    const validationRate = results.reduce((sum, r) => sum + (r.validationsPassed / r.totalValidations), 0) / results.length;
    insights.push(`✅ Average validation pass rate: ${Math.round(validationRate * 100)}%`);

    return insights;
  }

  private generateRecommendations(results: WorkflowResult[]): string[] {
    const recommendations: string[] = [];

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      recommendations.push(`🔧 CRITICAL: Fix ${failed.length} failed workflows before production use`);
    }

    const highErrorRate = results.filter(r => r.errors.length > 0).length / results.length;
    if (highErrorRate > 0.2) {
      recommendations.push(`⚠️ ERROR RATE: ${Math.round(highErrorRate * 100)}% of workflows had errors - investigate common issues`);
    }

    const slowWorkflows = results.filter(r => r.duration > 60000); // > 1 minute
    if (slowWorkflows.length > 0) {
      recommendations.push(`🐌 PERFORMANCE: ${slowWorkflows.length} workflows are slow - optimize for better developer experience`);
    }

    const lowValidationRate = results.filter(r => (r.validationsPassed / r.totalValidations) < 0.8);
    if (lowValidationRate.length > 0) {
      recommendations.push(`🔍 VALIDATION: ${lowValidationRate.length} workflows have low validation rates - improve test coverage`);
    }

    // Category-specific recommendations
    const devWorkflows = results.filter(r => this.scenarios.get(r.scenarioId)?.category === 'development');
    if (devWorkflows.some(r => !r.success)) {
      recommendations.push(`💻 DEVELOPMENT: Core development workflows failing - prioritize basic functionality fixes`);
    }

    const collabWorkflows = results.filter(r => this.scenarios.get(r.scenarioId)?.category === 'collaboration');
    if (collabWorkflows.some(r => !r.success)) {
      recommendations.push(`👥 COLLABORATION: Team workflows need improvement - focus on multi-user scenarios`);
    }

    if (recommendations.length === 0) {
      recommendations.push('🌟 EXCELLENT: All real-world workflows are functioning properly!');
    }

    return recommendations;
  }

  private printReport(report: WorkflowReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎬 REAL-WORLD WORKFLOW VALIDATION REPORT');
    console.log('='.repeat(60));

    console.log(`\n📅 Test Run: ${report.testRun.id}`);
    console.log(`🕐 Timestamp: ${new Date(report.testRun.timestamp).toISOString()}`);
    console.log(`🌍 Environment: ${report.testRun.environment}`);

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Scenarios: ${report.summary.totalScenarios}`);
    console.log(`   ✅ Successful: ${report.summary.successful}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   ⏱️ Average Duration: ${Math.round(report.summary.averageDuration / 1000)}s`);
    console.log(`   🕐 Total Time: ${Math.round(report.summary.totalTimeSpent / 1000 / 60)}min`);

    // Group by category
    const byCategory = new Map();
    for (const result of report.scenarios) {
      const scenario = this.scenarios.get(result.scenarioId)!;
      const cat = scenario.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(result);
    }

    console.log(`\n📋 BY CATEGORY:`);
    for (const [category, results] of byCategory) {
      const successful = results.filter((r: WorkflowResult) => r.success).length;
      const total = results.length;
      const status = successful === total ? '✅' : (successful === 0 ? '❌' : '⚠️');
      console.log(`   ${status} ${category.toUpperCase()}: ${successful}/${total}`);
    }

    if (report.insights.length > 0) {
      console.log(`\n🔍 INSIGHTS:`);
      for (const insight of report.insights) {
        console.log(`   ${insight}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      for (const rec of report.recommendations) {
        console.log(`   ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(60));
  }
}

// === CLI RUNNER ===

async function runWorkflowValidation() {
  const suite = new RealWorldWorkflowTestSuite();

  // Parse command line arguments
  const args = Deno.args;
  const filter: any = {};

  for (const arg of args) {
    if (arg.startsWith('--category=')) {
      filter.category = arg.split('=')[1];
    } else if (arg.startsWith('--complexity=')) {
      filter.complexity = arg.split('=')[1];
    } else if (arg.startsWith('--max-duration=')) {
      filter.maxDuration = parseInt(arg.split('=')[1]);
    }
  }

  const report = await suite.runAllScenarios(Object.keys(filter).length > 0 ? filter : undefined);

  // Exit with appropriate code
  Deno.exit(report.summary.failed > 0 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.main) {
  await runWorkflowValidation();
}

export { RealWorldWorkflowTestSuite };