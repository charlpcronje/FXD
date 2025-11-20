// ═══════════════════════════════════════════════════════════════
// @agent: agent-modules-core
// @timestamp: 2025-10-02T10:22:00Z
// @task: TRACK-B-MODULES.md#B1.4
// @status: in_progress
// @notes: Fixed imports to resolve $$, $_$$, fx from fxn.ts core
//         Group extensions for FXD - extends FX Group API with snippet-specific functionality
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Core FX Imports
// ═══════════════════════════════════════════════════════════════

import { $$, $_$$, fx } from '../fxn.ts';
import type { FXNode, FXNodeProxy, GroupWrapper } from '../fxn.ts';

// ═══════════════════════════════════════════════════════════════
// Module Imports
// ═══════════════════════════════════════════════════════════════

import { renderView } from "./fx-view.ts";
import { toPatches, applyPatches } from "./fx-parse.ts";
import { isSnippet, findBySnippetId } from "./fx-snippets.ts";

// Legacy functions for compatibility
export function groupList(viewPath: string) {
    const g = $$(viewPath).group();
    return g.list(); // GroupWrapper always has list()
}

export function groupMapStrings(viewPath: string, map: (it: any, idx: number) => string, sep = "\n\n") {
    const items = groupList(viewPath);
    const strs = items.map(map);
    return { concat: (s = sep) => strs.join(s) };
}

// Extend the Group prototype with FXD-specific methods
declare global {
    interface GroupWrapper {
        // Snippet-specific filters
        listSnippets(): any[];
        mapSnippets<T>(fn: (snippet: any) => T): T[];
        
        // Rendering
        concatWithMarkers(lang?: string, opts?: any): string;
        toView(opts?: any): string;
        
        // Filtering helpers
        byFile(filename: string): GroupWrapper;
        byLang(language: string): GroupWrapper;
        
        // Ordering
        sortByOrder(): GroupWrapper;
        reorder(snippetId: string, newIndex: number): GroupWrapper;
        
        // Parsing
        fromText(text: string): GroupWrapper;
        
        // Cloning and diffing
        clone(): GroupWrapper;
        diff(other: GroupWrapper): { added: any[], removed: any[], changed: any[] };
    }
}

// Helper to get the underlying Group from a wrapped group
function getUnderlyingGroup(wrapper: any): any {
    return wrapper._group || wrapper;
}

// Extension implementations
export function extendGroups() {
    // Get the GroupWrapper prototype (created by wrapGroup in fx.ts)
    const proto = Object.getPrototypeOf($$("temp").group([]));
    
    // List only snippets (filter by __type="snippet")
    proto.listSnippets = function() {
        const items = this.list();
        return items.filter((item: FXNodeProxy) => {
            const node = item.node();
            return isSnippet(node);
        });
    };
    
    // Map over snippets only
    proto.mapSnippets = function<T>(fn: (snippet: any) => T): T[] {
        return this.listSnippets().map(fn);
    };
    
    // Render all snippets with markers
    proto.concatWithMarkers = async function(lang: string = "js", opts: any = {}) {
        const snippets = this.listSnippets();

        // Import wrapSnippet dynamically to avoid circular dependency
        const { wrapSnippet } = await import("./fx-snippets.ts");

        const rendered = snippets.map((s: FXNodeProxy) => {
            const node = s.node();
            const meta = (node as any).__meta || {};
            const value = s.val();
            // Use snippet's own language if available, otherwise use parameter
            const snippetLang = meta.lang || lang;
            return wrapSnippet(meta.id, value, snippetLang, meta);
        });

        const separator = opts.separator || "\n\n";
        return rendered.join(separator);
    };
    
    // Convert group to rendered view
    proto.toView = function(opts: any = {}) {
        // Create a temporary view path
        const tempPath = `_temp_view_${Date.now()}`;
        const node = $$(tempPath).node();
        (node as any).__group = getUnderlyingGroup(this);

        // Render using the view system
        return renderView(tempPath, opts);
    };
    
    // Filter by file - returns NEW group to avoid clearing issues
    proto.byFile = function(filename: string) {
        const items = this.list();
        const filtered = items.filter((item: FXNodeProxy) => {
            const node = item.node();
            const meta = (node as any).__meta || {};
            return meta.file === filename;
        });

        // Create a new temporary group and add filtered items
        const tempPath = `_filter_${Date.now()}_${Math.random()}`;
        const newGroup = $$(tempPath).group([]);

        filtered.forEach((item: any) => {
            newGroup.add(item);
        });

        return newGroup;
    };

    // Filter by language - returns NEW group to avoid clearing issues
    proto.byLang = function(language: string) {
        const items = this.list();
        const filtered = items.filter((item: FXNodeProxy) => {
            const node = item.node();
            const meta = (node as any).__meta || {};
            return meta.lang === language;
        });

        // Create a new temporary group and add filtered items
        const tempPath = `_filter_${Date.now()}_${Math.random()}`;
        const newGroup = $$(tempPath).group([]);

        filtered.forEach((item: any) => {
            newGroup.add(item);
        });

        return newGroup;
    };
    
    // Sort by order property - returns new group
    proto.sortByOrder = function() {
        const items = this.list().sort((a: any, b: any) => {
            const aOrder = a.node().__meta?.order ?? 999;
            const bOrder = b.node().__meta?.order ?? 999;
            return aOrder - bOrder;
        });

        // Create a new group with sorted items
        const tempPath = `_sorted_${Date.now()}_${Math.random()}`;
        const newGroup = $$(tempPath).group([]);

        items.forEach((item: any) => {
            newGroup.add(item);
        });

        return newGroup;
    };

    // Reorder a specific snippet - returns new group
    proto.reorder = function(snippetId: string, newIndex: number) {
        const items = this.list();
        const currentIndex = items.findIndex((item: any) =>
            item.node().__meta?.id === snippetId
        );

        if (currentIndex === -1) return this;

        // Remove from current position
        const [item] = items.splice(currentIndex, 1);

        // Insert at new position
        items.splice(newIndex, 0, item);

        // Create a new group with reordered items
        const tempPath = `_reordered_${Date.now()}_${Math.random()}`;
        const newGroup = $$(tempPath).group([]);

        items.forEach((item: any) => {
            newGroup.add(item);
        });

        return newGroup;
    };
    
    // Parse text into group
    proto.fromText = function(text: string) {
        const patches = toPatches(text);
        
        // Clear current group
        this.clear();
        
        // Add snippets from patches
        patches.forEach(patch => {
            const location = findBySnippetId(patch.id);
            if (location) {
                this.add($$(location.path));
            }
        });
        
        return this;
    };
    
    // Clone the group
    proto.clone = function() {
        const newGroup = $$("_clone_" + Date.now()).group([]);
        this.list().forEach((item: any) => newGroup.add(item));
        return newGroup;
    };
    
    // Diff with another group
    proto.diff = function(other: any) {
        const thisIds = new Set(this.list().map((item: any) => 
            item.node().__meta?.id || item.node().__id
        ));
        const otherIds = new Set(other.list().map((item: any) => 
            item.node().__meta?.id || item.node().__id
        ));
        
        const added: any[] = [];
        const removed: any[] = [];
        const changed: any[] = [];
        
        // Find added items (in other but not in this)
        other.list().forEach((item: any) => {
            const id = item.node().__meta?.id || item.node().__id;
            if (!thisIds.has(id)) {
                added.push(item);
            }
        });
        
        // Find removed items (in this but not in other)
        this.list().forEach((item: any) => {
            const id = item.node().__meta?.id || item.node().__id;
            if (!otherIds.has(id)) {
                removed.push(item);
            } else {
                // Check if content changed
                const otherItem = other.list().find((o: any) => 
                    (o.node().__meta?.id || o.node().__id) === id
                );
                if (otherItem && item.val() !== otherItem.val()) {
                    changed.push({ old: item, new: otherItem });
                }
            }
        });
        
        return { added, removed, changed };
    };
}

// Helper function to create a view from a group
export function createView(path: string, groupPaths: string[] = []) {
    const view = $$(path).group(groupPaths);
    
    // Store view in registry for filesystem mapping
    registerView(path);
    
    return view;
}

// View registry for filesystem mapping
const viewRegistry = new Map<string, boolean>();

export function registerView(viewPath: string) {
    viewRegistry.set(viewPath, true);
}

export function getRegisteredViews(): string[] {
    return Array.from(viewRegistry.keys());
}

// Auto-discovery of views from views.* namespace
export function discoverViews(): string[] {
    const views: string[] = [];
    
    function traverse(node: any, path: string) {
        // Check if this is a view (has a group)
        if (node.__group) {
            views.push(path);
        }
        
        // Traverse children
        for (const key in node.__nodes) {
            traverse(node.__nodes[key], path ? `${path}.${key}` : key);
        }
    }
    
    // Start from views namespace
    const viewsNode = $$("views").node();
    traverse(viewsNode, "views");
    
    return views;
}

// Initialize extensions when module is imported
if (typeof $$ !== "undefined") {
    extendGroups();
}