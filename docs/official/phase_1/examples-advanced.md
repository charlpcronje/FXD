# Advanced Examples

## Complex View Compositions

### Example 1: Multi-Domain View Aggregation

```typescript
// Create a complex application view that aggregates multiple domains
class ApplicationBuilder {
  private views: Map<string, any> = new Map();
  
  buildApplication(config: AppConfig) {
    // Core modules
    this.createView("views.app.core", [
      '.snippet[domain="core"]',
      '.snippet[type="initialization"]',
      '.snippet[priority="high"]'
    ]);
    
    // Feature modules by domain
    for (const domain of config.domains) {
      this.createView(`views.app.${domain}`, [
        `.snippet[domain="${domain}"]`,
        '.snippet[status="stable"]',
        '!.snippet[deprecated=true]'  // Exclude deprecated
      ]);
    }
    
    // Aggregate into main application
    $$("views.app.main")
      .group([])
      .include('.snippet[type="bootstrap"]')  // Bootstrap first
      .computed(() => {
        // Dynamically include all domain views
        const snippets = [];
        for (const [viewName, view] of this.views) {
          snippets.push(...view.list());
        }
        // Sort by priority and order
        return snippets.sort((a, b) => {
          const aMeta = a.node().__meta;
          const bMeta = b.node().__meta;
          const aPriority = aMeta.priority || 999;
          const bPriority = bMeta.priority || 999;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return (aMeta.order || 0) - (bMeta.order || 0);
        });
      });
  }
  
  private createView(name: string, selectors: string[]) {
    const view = $$(name).group([]);
    selectors.forEach(sel => {
      if (sel.startsWith('!')) {
        view.exclude(sel.substring(1));
      } else {
        view.include(sel);
      }
    });
    this.views.set(name, view);
    return view;
  }
}

// Usage
const builder = new ApplicationBuilder();
builder.buildApplication({
  domains: ['auth', 'users', 'products', 'orders'],
  features: ['api', 'ui', 'admin']
});
```

### Example 2: Conditional Snippet Inclusion

```typescript
// Advanced conditional view based on environment and features
class ConditionalView {
  constructor(
    private viewPath: string,
    private config: ViewConfig
  ) {
    this.build();
  }
  
  private build() {
    const view = $$(this.viewPath).group([]);
    
    // Base snippets always included
    view.include('.snippet[required=true]');
    
    // Environment-specific snippets
    if (this.config.env === 'production') {
      view.include('.snippet[env="production"]');
      view.exclude('.snippet[debug=true]');
      view.exclude('.snippet[experimental=true]');
    } else if (this.config.env === 'development') {
      view.include('.snippet[env="development"]');
      view.include('.snippet[debug=true]');
    }
    
    // Feature flags
    for (const [feature, enabled] of Object.entries(this.config.features)) {
      if (enabled) {
        view.include(`.snippet[feature="${feature}"]`);
      }
    }
    
    // Performance optimizations
    if (this.config.optimize) {
      view.where(snippet => {
        const meta = snippet.node().__meta;
        // Only include optimized versions
        return !meta.unoptimized && meta.performance !== 'slow';
      });
    }
    
    // Security filtering
    if (this.config.secure) {
      view.where(snippet => {
        const content = snippet.val();
        // Exclude snippets with potential security issues
        return !content.includes('eval(') && 
               !content.includes('innerHTML') &&
               !content.includes('dangerouslySetInnerHTML');
      });
    }
    
    return view;
  }
}

// Usage
const prodView = new ConditionalView("views.production", {
  env: 'production',
  features: {
    analytics: true,
    adminPanel: false,
    betaFeatures: false
  },
  optimize: true,
  secure: true
});
```

## Advanced Round-Trip Patterns

### Example 3: Merge Conflict Resolution

```typescript
import { toPatches, applyPatches } from "./modules/fx-parsing.ts";

class ConflictResolver {
  resolveConflicts(
    localEdits: string,
    remoteEdits: string,
    original: string
  ): ResolveResult {
    // Parse all versions
    const localPatches = toPatches(localEdits, original);
    const remotePatches = toPatches(remoteEdits, original);
    
    // Detect conflicts
    const conflicts = this.detectConflicts(localPatches, remotePatches);
    
    if (conflicts.length === 0) {
      // No conflicts - apply both
      applyPatches(localPatches);
      applyPatches(remotePatches);
      return { success: true, conflicts: [] };
    }
    
    // Resolve conflicts
    const resolved = [];
    for (const conflict of conflicts) {
      const resolution = this.resolveConflict(conflict);
      resolved.push(resolution);
    }
    
    // Apply resolved patches
    const finalPatches = this.mergePatchSets(
      localPatches,
      remotePatches,
      resolved
    );
    applyPatches(finalPatches);
    
    return {
      success: true,
      conflicts: conflicts.length,
      resolutions: resolved
    };
  }
  
  private detectConflicts(local: Patch[], remote: Patch[]): Conflict[] {
    const conflicts = [];
    
    for (const localPatch of local) {
      const remotePatch = remote.find(r => r.id === localPatch.id);
      
      if (remotePatch) {
        // Same snippet modified in both
        if (localPatch.newContent !== remotePatch.newContent) {
          // Check if changes overlap
          const localDiff = this.diff(localPatch.oldContent, localPatch.newContent);
          const remoteDiff = this.diff(remotePatch.oldContent, remotePatch.newContent);
          
          if (this.diffsOverlap(localDiff, remoteDiff)) {
            conflicts.push({
              snippetId: localPatch.id,
              local: localPatch,
              remote: remotePatch,
              type: 'content-conflict'
            });
          }
        }
      }
    }
    
    return conflicts;
  }
  
  private resolveConflict(conflict: Conflict): Resolution {
    // Try automatic resolution strategies
    const strategies = [
      this.trySemanticMerge,
      this.tryLineBasedMerge,
      this.tryTimestampBased,
      this.tryUserPreference
    ];
    
    for (const strategy of strategies) {
      const result = strategy.call(this, conflict);
      if (result.success) {
        return result;
      }
    }
    
    // Fall back to manual resolution
    return this.manualResolve(conflict);
  }
  
  private trySemanticMerge(conflict: Conflict): Resolution {
    // Parse both versions as AST if possible
    try {
      const localAst = parseAST(conflict.local.newContent);
      const remoteAst = parseAST(conflict.remote.newContent);
      const baseAst = parseAST(conflict.local.oldContent);
      
      // Merge ASTs
      const mergedAst = mergeASTs(baseAst, localAst, remoteAst);
      const mergedContent = generateCode(mergedAst);
      
      return {
        success: true,
        content: mergedContent,
        strategy: 'semantic-merge'
      };
    } catch {
      return { success: false };
    }
  }
}
```

### Example 4: Incremental Patch Application

```typescript
// Apply patches incrementally with validation at each step
class IncrementalPatcher {
  private snapshots: Map<string, SnapshotEntry> = new Map();
  
  applyWithRollback(patches: Patch[]): PatchResult {
    // Create snapshots before applying
    this.createSnapshots(patches);
    
    const applied = [];
    const failed = [];
    
    for (const patch of patches) {
      try {
        // Validate patch before applying
        const validation = this.validatePatch(patch);
        if (!validation.valid) {
          failed.push({
            patch,
            reason: validation.reason
          });
          continue;
        }
        
        // Apply patch
        this.applyPatch(patch);
        
        // Test after application
        const testResult = this.testAfterPatch(patch);
        if (!testResult.passed) {
          // Rollback this patch
          this.rollbackPatch(patch);
          failed.push({
            patch,
            reason: `Tests failed: ${testResult.failures.join(', ')}`
          });
          continue;
        }
        
        applied.push(patch);
        
      } catch (error) {
        // Rollback on error
        this.rollbackPatch(patch);
        failed.push({
          patch,
          reason: error.message
        });
      }
    }
    
    // Clean up snapshots for successful patches
    applied.forEach(p => this.snapshots.delete(p.id));
    
    return {
      total: patches.length,
      applied: applied.length,
      failed: failed.length,
      details: { applied, failed }
    };
  }
  
  private validatePatch(patch: Patch): ValidationResult {
    // Check syntax
    if (patch.newContent) {
      const syntaxCheck = this.checkSyntax(patch.newContent, patch.lang);
      if (!syntaxCheck.valid) {
        return {
          valid: false,
          reason: `Syntax error: ${syntaxCheck.error}`
        };
      }
    }
    
    // Check for breaking changes
    const breakingChanges = this.detectBreakingChanges(patch);
    if (breakingChanges.length > 0) {
      return {
        valid: false,
        reason: `Breaking changes detected: ${breakingChanges.join(', ')}`
      };
    }
    
    // Check dependencies
    const missingDeps = this.checkDependencies(patch);
    if (missingDeps.length > 0) {
      return {
        valid: false,
        reason: `Missing dependencies: ${missingDeps.join(', ')}`
      };
    }
    
    return { valid: true };
  }
  
  private rollbackPatch(patch: Patch) {
    const snapshot = this.snapshots.get(patch.id);
    if (snapshot) {
      const location = findBySnippetId(patch.id);
      $$(location.path).val(snapshot.content);
      $$(location.path).node().__meta = snapshot.metadata;
    }
  }
}
```

## Performance Optimization

### Example 5: Lazy Loading Views

```typescript
// Implement lazy loading for large snippet collections
class LazyView {
  private loaded: Set<string> = new Set();
  private chunks: Map<string, string[]> = new Map();
  
  constructor(
    private viewPath: string,
    private chunkSize: number = 50
  ) {
    this.initialize();
  }
  
  private initialize() {
    // Get all matching snippet IDs without loading content
    const allIds = this.getAllSnippetIds();
    
    // Divide into chunks
    for (let i = 0; i < allIds.length; i += this.chunkSize) {
      const chunkId = `chunk-${i / this.chunkSize}`;
      this.chunks.set(chunkId, allIds.slice(i, i + this.chunkSize));
    }
    
    // Create paginated view
    $$(this.viewPath).group([]).computed(() => {
      // Only return loaded snippets
      const snippets = [];
      for (const id of this.loaded) {
        const location = findBySnippetId(id);
        if (location) {
          snippets.push($$(location.path));
        }
      }
      return snippets;
    });
  }
  
  loadChunk(chunkIndex: number) {
    const chunkId = `chunk-${chunkIndex}`;
    const ids = this.chunks.get(chunkId);
    
    if (ids) {
      // Load snippets in this chunk
      ids.forEach(id => this.loaded.add(id));
      
      // Trigger view update
      $$(this.viewPath).group([]).refresh();
    }
  }
  
  async loadOnDemand(startIndex: number, count: number) {
    // Calculate which chunks to load
    const startChunk = Math.floor(startIndex / this.chunkSize);
    const endChunk = Math.floor((startIndex + count) / this.chunkSize);
    
    // Load chunks asynchronously
    const promises = [];
    for (let i = startChunk; i <= endChunk; i++) {
      promises.push(this.loadChunkAsync(i));
    }
    
    await Promise.all(promises);
  }
  
  private async loadChunkAsync(chunkIndex: number): Promise<void> {
    return new Promise(resolve => {
      // Simulate async loading
      setTimeout(() => {
        this.loadChunk(chunkIndex);
        resolve();
      }, 10);
    });
  }
}

// Usage
const lazyView = new LazyView("views.large", 100);

// Load first 100 snippets
lazyView.loadChunk(0);

// Load on scroll
window.addEventListener('scroll', () => {
  const scrollPosition = window.scrollY;
  const itemHeight = 50;
  const startIndex = Math.floor(scrollPosition / itemHeight);
  
  lazyView.loadOnDemand(startIndex, 20);
});
```

### Example 6: Cached Rendering

```typescript
// Implement caching for expensive render operations
class CachedRenderer {
  private cache: Map<string, CacheEntry> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  
  renderWithCache(
    viewPath: string,
    options: RenderOptions = {}
  ): string {
    const cacheKey = this.getCacheKey(viewPath, options);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isStale(cached)) {
      return cached.content;
    }
    
    // Track dependencies during render
    const deps = new Set<string>();
    const originalWatch = $$.prototype.watch;
    
    // Monkey-patch to track dependencies
    $$.prototype.watch = function(cb) {
      deps.add(this.path());
      return originalWatch.call(this, cb);
    };
    
    // Render
    const content = renderView(viewPath, options);
    
    // Restore original watch
    $$.prototype.watch = originalWatch;
    
    // Cache result
    this.cache.set(cacheKey, {
      content,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(content),
      dependencies: deps
    });
    
    // Store dependencies
    this.dependencies.set(cacheKey, deps);
    
    // Set up invalidation
    this.setupInvalidation(cacheKey, deps);
    
    return content;
  }
  
  private setupInvalidation(cacheKey: string, deps: Set<string>) {
    for (const dep of deps) {
      $$(dep).watch(() => {
        // Invalidate cache when dependency changes
        this.invalidate(cacheKey);
      });
    }
  }
  
  private invalidate(cacheKey: string) {
    this.cache.delete(cacheKey);
    
    // Invalidate dependent caches
    for (const [key, deps] of this.dependencies) {
      if (deps.has(cacheKey)) {
        this.invalidate(key);
      }
    }
  }
  
  private isStale(entry: CacheEntry): boolean {
    // Check age
    const age = Date.now() - entry.timestamp;
    if (age > 60000) return true; // 1 minute TTL
    
    // Check if dependencies changed
    for (const dep of entry.dependencies) {
      const current = $$(dep).val();
      const currentChecksum = this.calculateChecksum(current);
      if (currentChecksum !== entry.checksum) {
        return true;
      }
    }
    
    return false;
  }
}
```

## Plugin Development

### Example 7: Custom Snippet Type Plugin

```typescript
// Create a plugin for SQL snippets with special handling
class SQLSnippetPlugin {
  install() {
    // Register SQL snippet type
    this.registerType();
    
    // Add SQL-specific methods
    this.extendAPI();
    
    // Set up validation
    this.setupValidation();
    
    // Add rendering hooks
    this.setupRendering();
  }
  
  private registerType() {
    // Define SQL snippet behavior
    const SQLBehavior = {
      name: "sql-snippet",
      
      validate(content: string): boolean {
        // Basic SQL validation
        const keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE'];
        return keywords.some(k => content.toUpperCase().includes(k));
      },
      
      format(content: string): string {
        // Format SQL for readability
        return content
          .replace(/\bSELECT\b/gi, 'SELECT')
          .replace(/\bFROM\b/gi, '\nFROM')
          .replace(/\bWHERE\b/gi, '\nWHERE')
          .replace(/\bJOIN\b/gi, '\nJOIN')
          .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
          .replace(/\bORDER BY\b/gi, '\nORDER BY');
      },
      
      analyze(content: string): SQLAnalysis {
        return {
          tables: this.extractTables(content),
          columns: this.extractColumns(content),
          operations: this.extractOperations(content),
          complexity: this.calculateComplexity(content)
        };
      }
    };
    
    // Register with FX
    fx.registerBehavior('sql', SQLBehavior);
  }
  
  private extendAPI() {
    // Add SQL-specific snippet creation
    window.createSQLSnippet = (
      path: string,
      query: string,
      metadata: SQLMetadata
    ) => {
      // Parse query
      const analysis = this.analyzeQuery(query);
      
      // Create snippet with SQL metadata
      createSnippet(path, query, {
        ...metadata,
        type: 'sql',
        lang: 'sql',
        tables: analysis.tables,
        operations: analysis.operations,
        indexed: analysis.usesIndexes,
        estimated_time: analysis.estimatedTime
      });
      
      // Set up query plan caching
      this.cacheQueryPlan(metadata.id, query);
    };
    
    // Add SQL view builder
    window.createSQLView = (viewPath: string, options: SQLViewOptions) => {
      const view = $$(viewPath).group([]);
      
      // Include SQL snippets
      view.include('.snippet[type="sql"]');
      
      // Filter by table access
      if (options.tables) {
        view.where(snippet => {
          const meta = snippet.node().__meta;
          return options.tables.some(t => meta.tables?.includes(t));
        });
      }
      
      // Filter by operation type
      if (options.operations) {
        view.where(snippet => {
          const meta = snippet.node().__meta;
          return options.operations.some(op => meta.operations?.includes(op));
        });
      }
      
      // Sort by complexity
      if (options.sortByComplexity) {
        view.computed(items => {
          return items.sort((a, b) => {
            const aComplexity = a.node().__meta.complexity || 0;
            const bComplexity = b.node().__meta.complexity || 0;
            return aComplexity - bComplexity;
          });
        });
      }
      
      return view;
    };
  }
  
  private setupValidation() {
    // Add SQL validation rules
    fx.addValidator('sql', (content: string) => {
      // Check for SQL injection risks
      const risks = [
        /;\s*DROP\s+TABLE/i,
        /;\s*DELETE\s+FROM/i,
        /EXEC\s*\(/i,
        /xp_cmdshell/i
      ];
      
      for (const risk of risks) {
        if (risk.test(content)) {
          return {
            valid: false,
            error: 'Potential SQL injection risk detected'
          };
        }
      }
      
      // Validate syntax
      try {
        this.parseSQLSyntax(content);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: error.message
        };
      }
    });
  }
  
  private setupRendering() {
    // Custom SQL rendering
    fx.addRenderer('sql', (content: string, options: RenderOptions) => {
      // Add SQL comments for markers
      const commentStyle = '-- ';
      
      // Format for specific database
      if (options.database === 'postgres') {
        content = this.formatForPostgres(content);
      } else if (options.database === 'mysql') {
        content = this.formatForMySQL(content);
      }
      
      // Add execution hints
      if (options.addHints) {
        content = `${commentStyle}Execution hints: ${this.generateHints(content)}\n${content}`;
      }
      
      return content;
    });
  }
}

// Install plugin
const sqlPlugin = new SQLSnippetPlugin();
sqlPlugin.install();

// Usage
createSQLSnippet(
  "snippets.queries.getUsers",
  "SELECT id, name, email FROM users WHERE active = true",
  {
    id: "query-get-users",
    database: "postgres",
    schema: "public",
    indexes: ["users_active_idx"]
  }
);
```

## Testing Strategies

### Example 8: Automated Round-Trip Testing

```typescript
// Comprehensive round-trip testing framework
class RoundTripTester {
  private testCases: TestCase[] = [];
  
  addTestCase(testCase: TestCase) {
    this.testCases.push(testCase);
  }
  
  async runAll(): Promise<TestResults> {
    const results: TestResult[] = [];
    
    for (const testCase of this.testCases) {
      const result = await this.runTestCase(testCase);
      results.push(result);
    }
    
    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    };
  }
  
  private async runTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      // Setup
      this.setup(testCase);
      
      // Create initial snippets
      for (const snippet of testCase.snippets) {
        createSnippet(snippet.path, snippet.content, snippet.meta);
      }
      
      // Create view
      const view = $$(testCase.viewPath).group([]);
      testCase.selectors.forEach(sel => view.include(sel));
      
      // Render original
      const original = renderView(testCase.viewPath, testCase.renderOptions);
      
      // Apply edits
      let edited = original;
      for (const edit of testCase.edits) {
        edited = this.applyEdit(edited, edit);
      }
      
      // Parse and apply patches
      const patches = toPatches(edited, original);
      applyPatches(patches);
      
      // Verify expectations
      for (const expectation of testCase.expectations) {
        this.verifyExpectation(expectation);
      }
      
      // Cleanup
      this.cleanup(testCase);
      
      return {
        name: testCase.name,
        passed: true,
        duration: performance.now() - startTime
      };
      
    } catch (error) {
      return {
        name: testCase.name,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }
  
  private verifyExpectation(expectation: Expectation) {
    switch (expectation.type) {
      case 'content':
        const content = $$(expectation.path).val();
        if (!content.includes(expectation.expected)) {
          throw new Error(`Content expectation failed for ${expectation.path}`);
        }
        break;
        
      case 'metadata':
        const meta = $$(expectation.path).node().__meta;
        if (meta[expectation.field] !== expectation.expected) {
          throw new Error(`Metadata expectation failed for ${expectation.path}`);
        }
        break;
        
      case 'count':
        const view = $$(expectation.path).group([]);
        if (view.list().length !== expectation.expected) {
          throw new Error(`Count expectation failed for ${expectation.path}`);
        }
        break;
    }
  }
}

// Define test cases
const tester = new RoundTripTester();

tester.addTestCase({
  name: "Basic round-trip edit",
  snippets: [
    {
      path: "snippets.test.func",
      content: "function test() { return 1; }",
      meta: { id: "test-func-001" }
    }
  ],
  viewPath: "views.test",
  selectors: ['.snippet[id="test-func-001"]'],
  edits: [
    { type: 'replace', find: 'return 1', replace: 'return 2' }
  ],
  expectations: [
    {
      type: 'content',
      path: 'snippets.test.func',
      expected: 'return 2'
    }
  ]
});

// Run tests
const results = await tester.runAll();
console.log(`Tests: ${results.passed}/${results.total} passed`);
```

## See Also

- [Basic Examples](examples-basic.md) - Fundamental usage patterns
- [Demo Application](demo.md) - Complete working application
- [API Reference](api-snippets.md) - Complete API documentation
- [Architecture](architecture.md) - System design details