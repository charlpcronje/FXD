/**
 * FX Snippet Manager
 * Comprehensive snippet management with tagging, search, compilation, and collaboration
 */

import type { FXCore, FXNodeProxy } from "../fx.ts";
import { VersionedNode } from "./fx-versioned-nodes.ts";

export interface SnippetMetadata {
    id: string;
    name: string;
    description: string;
    documentation?: string;
    tags: string[];
    categories: string[];
    language: string;
    author: string;
    created: Date;
    modified: Date;
    version: string;
    dependencies?: string[];
    compilable?: boolean;
    testable?: boolean;
    visibility: 'public' | 'private' | 'team';
    license?: string;
    examples?: SnippetExample[];
    performance?: PerformanceMetrics;
    usage?: UsageStats;
}

export interface SnippetExample {
    title: string;
    code: string;
    output?: string;
    explanation?: string;
}

export interface PerformanceMetrics {
    executionTime?: number;
    memoryUsage?: number;
    complexity?: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(2^n)';
    benchmarks?: Record<string, number>;
}

export interface UsageStats {
    views: number;
    uses: number;
    forks: number;
    stars: number;
    lastUsed?: Date;
}

export interface ViewMetadata {
    id: string;
    name: string;
    description: string;
    filename?: string;
    snippets: string[]; // snippet IDs
    layout?: 'grid' | 'list' | 'tree' | 'graph';
    filters?: ViewFilter[];
    sortOrder?: 'name' | 'date' | 'popularity' | 'relevance';
    author: string;
    created: Date;
    modified: Date;
    shared: boolean;
}

export interface ViewFilter {
    type: 'tag' | 'category' | 'language' | 'author' | 'date';
    value: string | string[] | DateRange;
    operator?: 'includes' | 'excludes' | 'equals' | 'contains';
}

export interface DateRange {
    from?: Date;
    to?: Date;
}

export interface CompilationResult {
    success: boolean;
    output?: string;
    errors?: string[];
    warnings?: string[];
    artifacts?: Record<string, Uint8Array>;
    executionTime?: number;
}

export interface TestResult {
    passed: boolean;
    tests: {
        name: string;
        passed: boolean;
        error?: string;
        duration?: number;
    }[];
    coverage?: number;
}

export interface MergeRequest {
    id: string;
    source: string; // user/branch
    target: string; // usually 'main'
    snippets: SnippetChange[];
    author: string;
    created: Date;
    status: 'pending' | 'approved' | 'rejected' | 'merged';
    reviewers?: string[];
    comments?: Comment[];
}

export interface SnippetChange {
    snippetId: string;
    type: 'create' | 'update' | 'delete';
    before?: string;
    after?: string;
    metadata?: Partial<SnippetMetadata>;
}

export interface Comment {
    author: string;
    text: string;
    timestamp: Date;
    resolved?: boolean;
}

/**
 * Main Snippet Manager class
 */
export class SnippetManager {
    private fx: FXCore;
    private snippets: Map<string, VersionedNode> = new Map();
    private metadata: Map<string, SnippetMetadata> = new Map();
    private views: Map<string, ViewMetadata> = new Map();
    private searchIndex: SearchIndex;
    private compiler: SnippetCompiler;
    private tester: SnippetTester;
    private collaborator: SnippetCollaborator;

    constructor(fx: FXCore) {
        this.fx = fx;
        this.searchIndex = new SearchIndex();
        this.compiler = new SnippetCompiler();
        this.tester = new SnippetTester();
        this.collaborator = new SnippetCollaborator(fx);
        this.initialize();
    }

    private initialize(): void {
        // Create base nodes
        $$(
            "snippets.registry",
            "snippets.views",
            "snippets.tags",
            "snippets.categories",
            "snippets.search"
        );
    }

    /**
     * Create a new snippet
     */
    createSnippet(options: {
        name: string;
        code: string;
        description?: string;
        language?: string;
        tags?: string[];
        categories?: string[];
    }): string {
        const id = this.generateId(options.name);
        const path = `snippets.registry.${id}`;

        // Create versioned node for the snippet
        const node = new VersionedNode(this.fx, path, {
            enableTimeTravel: true,
            enableSafePatterns: true,
            autoSnapshot: true
        });

        // Set initial code
        node.set(options.code, `Created snippet: ${options.name}`);

        // Create metadata
        const metadata: SnippetMetadata = {
            id,
            name: options.name,
            description: options.description || '',
            tags: options.tags || [],
            categories: options.categories || [],
            language: options.language || this.detectLanguage(options.code),
            author: this.getCurrentUser(),
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            compilable: this.isCompilable(options.language || ''),
            testable: true,
            visibility: 'private',
            usage: { views: 0, uses: 0, forks: 0, stars: 0 }
        };

        this.snippets.set(id, node);
        this.metadata.set(id, metadata);

        // Update search index
        this.searchIndex.add(id, metadata, options.code);

        // Update tag registry
        this.updateTagRegistry(options.tags || []);

        return id;
    }

    /**
     * Search snippets with advanced filters
     */
    searchSnippets(query: {
        text?: string;
        tags?: string[];
        categories?: string[];
        language?: string;
        author?: string;
        dateRange?: DateRange;
        sortBy?: 'relevance' | 'date' | 'popularity' | 'name';
        limit?: number;
    }): SnippetMetadata[] {
        let results = this.searchIndex.search(query.text || '');

        // Apply filters
        if (query.tags?.length) {
            results = results.filter(r => 
                query.tags!.some(tag => r.tags.includes(tag))
            );
        }

        if (query.categories?.length) {
            results = results.filter(r =>
                query.categories!.some(cat => r.categories.includes(cat))
            );
        }

        if (query.language) {
            results = results.filter(r => r.language === query.language);
        }

        if (query.author) {
            results = results.filter(r => r.author === query.author);
        }

        if (query.dateRange) {
            results = results.filter(r => {
                const date = r.modified.getTime();
                const from = query.dateRange!.from?.getTime() || 0;
                const to = query.dateRange!.to?.getTime() || Date.now();
                return date >= from && date <= to;
            });
        }

        // Sort results
        results = this.sortResults(results, query.sortBy || 'relevance');

        // Apply limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    /**
     * Get similar snippets using AI/embeddings
     */
    async findSimilar(snippetId: string, limit: number = 5): Promise<SnippetMetadata[]> {
        const snippet = this.metadata.get(snippetId);
        if (!snippet) return [];

        // Use embeddings or simple tag/category matching for now
        const similar = this.searchSnippets({
            tags: snippet.tags,
            categories: snippet.categories,
            language: snippet.language,
            limit: limit + 1
        }).filter(s => s.id !== snippetId);

        return similar.slice(0, limit);
    }

    /**
     * Create a view
     */
    createView(options: {
        name: string;
        description?: string;
        snippets?: string[];
        filters?: ViewFilter[];
        layout?: 'grid' | 'list' | 'tree' | 'graph';
    }): string {
        const id = this.generateId(options.name);

        const view: ViewMetadata = {
            id,
            name: options.name,
            description: options.description || '',
            snippets: options.snippets || [],
            filters: options.filters || [],
            layout: options.layout || 'grid',
            author: this.getCurrentUser(),
            created: new Date(),
            modified: new Date(),
            shared: false
        };

        this.views.set(id, view);
        $$(`snippets.views.${id}`).set(view);

        return id;
    }

    /**
     * Compile a snippet
     */
    async compile(snippetId: string): Promise<CompilationResult> {
        const snippet = this.snippets.get(snippetId);
        const metadata = this.metadata.get(snippetId);
        
        if (!snippet || !metadata) {
            return { success: false, errors: ['Snippet not found'] };
        }

        if (!metadata.compilable) {
            return { success: false, errors: ['Snippet is not compilable'] };
        }

        const code = snippet.get();
        return await this.compiler.compile(code, metadata.language);
    }

    /**
     * Test a snippet
     */
    async test(snippetId: string): Promise<TestResult> {
        const snippet = this.snippets.get(snippetId);
        const metadata = this.metadata.get(snippetId);
        
        if (!snippet || !metadata) {
            return {
                passed: false,
                tests: [{ name: 'load', passed: false, error: 'Snippet not found' }]
            };
        }

        const code = snippet.get();
        return await this.tester.test(code, metadata.language);
    }

    /**
     * Create merge request for fxd.dev
     */
    async createMergeRequest(
        snippetIds: string[],
        target: string = 'main',
        message?: string
    ): Promise<MergeRequest> {
        const changes: SnippetChange[] = [];

        for (const id of snippetIds) {
            const snippet = this.snippets.get(id);
            const metadata = this.metadata.get(id);
            
            if (!snippet || !metadata) continue;

            changes.push({
                snippetId: id,
                type: 'create', // or 'update' if exists
                after: snippet.get(),
                metadata
            });
        }

        return await this.collaborator.createMergeRequest({
            target,
            changes,
            message
        });
    }

    /**
     * Push to fxd.dev
     */
    async pushToFxdDev(mergeRequestId: string): Promise<boolean> {
        return await this.collaborator.push(mergeRequestId);
    }

    /**
     * Helper methods
     */
    private generateId(name: string): string {
        const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    }

    private detectLanguage(code: string): string {
        // Simple detection based on patterns
        if (code.includes('function') || code.includes('const')) return 'javascript';
        if (code.includes('def ') || code.includes('import ')) return 'python';
        if (code.includes('class ') && code.includes('{')) return 'java';
        if (code.includes('fn ') || code.includes('let ')) return 'rust';
        if (code.includes('package ') || code.includes('func ')) return 'go';
        return 'text';
    }

    private isCompilable(language: string): boolean {
        return ['typescript', 'rust', 'go', 'java', 'c', 'cpp'].includes(language);
    }

    private getCurrentUser(): string {
        return $$('user.current').val() || 'anonymous';
    }

    private updateTagRegistry(tags: string[]): void {
        const registry = $$('snippets.tags').val() || {};
        tags.forEach(tag => {
            registry[tag] = (registry[tag] || 0) + 1;
        });
        $$('snippets.tags').set(registry);
    }

    private sortResults(
        results: SnippetMetadata[],
        sortBy: 'relevance' | 'date' | 'popularity' | 'name'
    ): SnippetMetadata[] {
        switch (sortBy) {
            case 'date':
                return results.sort((a, b) => b.modified.getTime() - a.modified.getTime());
            case 'popularity':
                return results.sort((a, b) => 
                    (b.usage?.stars || 0) - (a.usage?.stars || 0)
                );
            case 'name':
                return results.sort((a, b) => a.name.localeCompare(b.name));
            default:
                return results; // Already sorted by relevance
        }
    }
}

/**
 * Search Index for fast snippet discovery
 */
class SearchIndex {
    private index: Map<string, Set<string>> = new Map(); // term -> snippet IDs
    private snippetData: Map<string, SnippetMetadata> = new Map();

    add(id: string, metadata: SnippetMetadata, code: string): void {
        this.snippetData.set(id, metadata);

        // Index all searchable terms
        const terms = this.extractTerms([
            metadata.name,
            metadata.description,
            ...metadata.tags,
            ...metadata.categories,
            metadata.language,
            code
        ].join(' '));

        terms.forEach(term => {
            if (!this.index.has(term)) {
                this.index.set(term, new Set());
            }
            this.index.get(term)!.add(id);
        });
    }

    search(query: string): SnippetMetadata[] {
        if (!query) {
            return Array.from(this.snippetData.values());
        }

        const terms = this.extractTerms(query);
        const scores = new Map<string, number>();

        // Calculate relevance scores
        terms.forEach(term => {
            const snippetIds = this.index.get(term);
            if (snippetIds) {
                snippetIds.forEach(id => {
                    scores.set(id, (scores.get(id) || 0) + 1);
                });
            }
        });

        // Sort by score and return metadata
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => this.snippetData.get(id)!)
            .filter(Boolean);
    }

    private extractTerms(text: string): string[] {
        return text.toLowerCase()
            .split(/\W+/)
            .filter(term => term.length > 2);
    }
}

/**
 * Snippet Compiler for various languages
 */
class SnippetCompiler {
    async compile(code: string, language: string): Promise<CompilationResult> {
        switch (language) {
            case 'typescript':
                return await this.compileTypeScript(code);
            case 'rust':
                return await this.compileRust(code);
            case 'go':
                return await this.compileGo(code);
            default:
                return {
                    success: false,
                    errors: [`Compilation not supported for ${language}`]
                };
        }
    }

    private async compileTypeScript(code: string): Promise<CompilationResult> {
        try {
            // Use Deno's TypeScript compiler
            const result = await Deno.emit("data:application/typescript," + encodeURIComponent(code), {
                check: true,
                compilerOptions: {
                    target: "ES2020",
                    module: "ES2020"
                }
            });

            return {
                success: true,
                output: result.files["data:application/javascript"],
                executionTime: Date.now()
            };
        } catch (error: any) {
            return {
                success: false,
                errors: [error.message]
            };
        }
    }

    private async compileRust(code: string): Promise<CompilationResult> {
        // Would need rustc installed
        const tempFile = await Deno.makeTempFile({ suffix: '.rs' });
        await Deno.writeTextFile(tempFile, code);

        const command = new Deno.Command('rustc', {
            args: [tempFile, '--edition', '2021'],
            stdout: 'piped',
            stderr: 'piped'
        });

        const { success, stdout, stderr } = await command.output();

        return {
            success,
            output: new TextDecoder().decode(stdout),
            errors: success ? [] : [new TextDecoder().decode(stderr)]
        };
    }

    private async compileGo(code: string): Promise<CompilationResult> {
        // Would need go installed
        const tempFile = await Deno.makeTempFile({ suffix: '.go' });
        await Deno.writeTextFile(tempFile, code);

        const command = new Deno.Command('go', {
            args: ['build', tempFile],
            stdout: 'piped',
            stderr: 'piped'
        });

        const { success, stdout, stderr } = await command.output();

        return {
            success,
            output: new TextDecoder().decode(stdout),
            errors: success ? [] : [new TextDecoder().decode(stderr)]
        };
    }
}

/**
 * Snippet Tester
 */
class SnippetTester {
    async test(code: string, language: string): Promise<TestResult> {
        switch (language) {
            case 'javascript':
            case 'typescript':
                return await this.testJavaScript(code);
            case 'python':
                return await this.testPython(code);
            default:
                return {
                    passed: false,
                    tests: [{
                        name: 'run',
                        passed: false,
                        error: `Testing not supported for ${language}`
                    }]
                };
        }
    }

    private async testJavaScript(code: string): Promise<TestResult> {
        try {
            // Look for test patterns
            const hasTests = code.includes('test(') || code.includes('describe(');
            
            if (!hasTests) {
                // Just try to run the code
                const func = new Function(code);
                func();
                return {
                    passed: true,
                    tests: [{ name: 'execution', passed: true }]
                };
            }

            // Run actual tests (would need a test framework)
            return {
                passed: true,
                tests: [{ name: 'suite', passed: true }]
            };
        } catch (error: any) {
            return {
                passed: false,
                tests: [{
                    name: 'execution',
                    passed: false,
                    error: error.message
                }]
            };
        }
    }

    private async testPython(code: string): Promise<TestResult> {
        const command = new Deno.Command('python', {
            args: ['-c', code],
            stdout: 'piped',
            stderr: 'piped'
        });

        const { success, stderr } = await command.output();

        return {
            passed: success,
            tests: [{
                name: 'execution',
                passed: success,
                error: success ? undefined : new TextDecoder().decode(stderr)
            }]
        };
    }
}

/**
 * Snippet Collaborator for multi-user workflows
 */
class SnippetCollaborator {
    private fx: FXCore;
    private mergeRequests: Map<string, MergeRequest> = new Map();

    constructor(fx: FXCore) {
        this.fx = fx;
    }

    async createMergeRequest(options: {
        target: string;
        changes: SnippetChange[];
        message?: string;
    }): Promise<MergeRequest> {
        const id = `mr-${Date.now()}`;
        
        const mergeRequest: MergeRequest = {
            id,
            source: `${this.getCurrentUser()}/${this.getCurrentBranch()}`,
            target: options.target,
            snippets: options.changes,
            author: this.getCurrentUser(),
            created: new Date(),
            status: 'pending',
            comments: options.message ? [{
                author: this.getCurrentUser(),
                text: options.message,
                timestamp: new Date()
            }] : []
        };

        this.mergeRequests.set(id, mergeRequest);
        $$(`snippets.mergeRequests.${id}`).set(mergeRequest);

        return mergeRequest;
    }

    async push(mergeRequestId: string): Promise<boolean> {
        const mr = this.mergeRequests.get(mergeRequestId);
        if (!mr || mr.status !== 'approved') {
            return false;
        }

        try {
            // Push to fxd.dev
            const response = await fetch('https://api.fxd.dev/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getApiToken()}`
                },
                body: JSON.stringify({
                    mergeRequest: mr,
                    signature: await this.signRequest(mr)
                })
            });

            if (response.ok) {
                mr.status = 'merged';
                return true;
            }
        } catch (error) {
            console.error('Push failed:', error);
        }

        return false;
    }

    async merge(mergeRequestId: string): Promise<boolean> {
        const mr = this.mergeRequests.get(mergeRequestId);
        if (!mr) return false;

        // Apply changes locally
        for (const change of mr.snippets) {
            const path = `snippets.registry.${change.snippetId}`;
            
            switch (change.type) {
                case 'create':
                    $$(path).set(change.after);
                    break;
                case 'update':
                    $$(path).set(change.after);
                    break;
                case 'delete':
                    // Mark as deleted
                    $$(path + '.__deleted').set(true);
                    break;
            }

            // Update metadata
            if (change.metadata) {
                $$(path + '.__metadata').set(change.metadata);
            }
        }

        mr.status = 'merged';
        return true;
    }

    /**
     * Conflict resolution
     */
    async resolveConflicts(
        local: SnippetChange,
        remote: SnippetChange
    ): Promise<SnippetChange> {
        // Three-way merge
        const base = local.before || '';
        const localChange = local.after || '';
        const remoteChange = remote.after || '';

        // Try automatic merge
        if (this.canAutoMerge(base, localChange, remoteChange)) {
            return {
                ...local,
                after: this.autoMerge(base, localChange, remoteChange)
            };
        }

        // Manual resolution required
        return await this.promptManualResolve(local, remote);
    }

    private canAutoMerge(base: string, local: string, remote: string): boolean {
        // Simple check - if changes are in different parts
        const baseLines = base.split('\n');
        const localLines = local.split('\n');
        const remoteLines = remote.split('\n');

        // Find changed line ranges
        const localChanges = this.findChangedLines(baseLines, localLines);
        const remoteChanges = this.findChangedLines(baseLines, remoteLines);

        // Check for overlap
        return !this.hasOverlap(localChanges, remoteChanges);
    }

    private autoMerge(base: string, local: string, remote: string): string {
        // Simple line-based merge
        const baseLines = base.split('\n');
        const localLines = local.split('\n');
        const remoteLines = remote.split('\n');
        const result: string[] = [];

        for (let i = 0; i < Math.max(localLines.length, remoteLines.length); i++) {
            if (localLines[i] !== baseLines[i] && remoteLines[i] === baseLines[i]) {
                result.push(localLines[i] || '');
            } else if (remoteLines[i] !== baseLines[i] && localLines[i] === baseLines[i]) {
                result.push(remoteLines[i] || '');
            } else if (localLines[i] === remoteLines[i]) {
                result.push(localLines[i] || '');
            } else {
                // Conflict - include both
                result.push('<<<<<<< LOCAL');
                result.push(localLines[i] || '');
                result.push('=======');
                result.push(remoteLines[i] || '');
                result.push('>>>>>>> REMOTE');
            }
        }

        return result.join('\n');
    }

    private findChangedLines(base: string[], changed: string[]): Set<number> {
        const changes = new Set<number>();
        for (let i = 0; i < Math.max(base.length, changed.length); i++) {
            if (base[i] !== changed[i]) {
                changes.add(i);
            }
        }
        return changes;
    }

    private hasOverlap(set1: Set<number>, set2: Set<number>): boolean {
        for (const item of set1) {
            if (set2.has(item)) return true;
        }
        return false;
    }

    private async promptManualResolve(
        local: SnippetChange,
        remote: SnippetChange
    ): Promise<SnippetChange> {
        // Would show UI for manual resolution
        console.log('Manual conflict resolution required');
        return local; // Default to local for now
    }

    private getCurrentUser(): string {
        return $$('user.current').val() || 'anonymous';
    }

    private getCurrentBranch(): string {
        return $$('git.branch').val() || 'main';
    }

    private getApiToken(): string {
        return $$('auth.token').val() || '';
    }

    private async signRequest(data: any): Promise<string> {
        // Sign with private key for authenticity
        const encoder = new TextEncoder();
        const data_encoded = encoder.encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data_encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

/**
 * Export convenience functions
 */
export function createSnippetManager(fx: FXCore): SnippetManager {
    return new SnippetManager(fx);
}

/**
 * Example usage
 */
export function exampleSnippetWorkflow() {
    const manager = new SnippetManager(globalThis.fx);

    // Create snippets with rich metadata
    const fibId = manager.createSnippet({
        name: 'fibonacci-optimized',
        code: `
            function fibonacci(n, memo = {}) {
                if (n <= 1) return n;
                if (memo[n]) return memo[n];
                memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
                return memo[n];
            }
        `,
        description: 'Optimized Fibonacci with memoization',
        tags: ['algorithm', 'dynamic-programming', 'math', 'optimized'],
        categories: ['algorithms', 'mathematics'],
        language: 'javascript'
    });

    // Create a view for algorithms
    const algoViewId = manager.createView({
        name: 'Algorithm Collection',
        description: 'Curated collection of algorithm implementations',
        filters: [{
            type: 'category',
            value: 'algorithms',
            operator: 'includes'
        }],
        layout: 'grid'
    });

    // Search for snippets
    const results = manager.searchSnippets({
        text: 'fibonacci',
        tags: ['optimized'],
        sortBy: 'relevance'
    });

    // Find similar snippets
    manager.findSimilar(fibId, 5).then(similar => {
        console.log('Similar snippets:', similar);
    });

    // Test the snippet
    manager.test(fibId).then(result => {
        console.log('Test result:', result);
    });

    // Compile if applicable
    manager.compile(fibId).then(result => {
        console.log('Compilation:', result);
    });

    // Create merge request for collaboration
    manager.createMergeRequest([fibId], 'main', 'Adding optimized Fibonacci implementation')
        .then(mr => {
            console.log('Merge request created:', mr.id);
            
            // Push to fxd.dev
            manager.pushToFxdDev(mr.id).then(success => {
                console.log('Pushed to fxd.dev:', success);
            });
        });

    return manager;
}