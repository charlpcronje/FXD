/**
 * Reactive Snippet System - Functions as Containerized Reactive Nodes
 *
 * Simple wrapper approach:
 * - Store function as-is in a node
 * - Map internal params to external nodes
 * - Use atomics for auto-sync
 * - toString returns original code
 */

import { $$, $_$$ } from '../fxn.ts';
import { createSnippet } from './fx-snippets.ts';
import { loadAtomicsPlugin } from '../plugins/fx-atomics.ts';
import type { AtomicLink } from '../plugins/fx-atomics.ts';

// Ensure atomics is loaded
let atomicsPlugin: any;
function getAtomics() {
  if (!atomicsPlugin) {
    atomicsPlugin = loadAtomicsPlugin();
  }
  return atomicsPlugin;
}

export interface ParamMapping {
  external: string;           // Path to external FX node
  transform?: (val: any) => any;
  validate?: (val: any) => boolean;
  default?: any;
}

export interface ReactiveSnippetOptions {
  id: string;
  lang?: string;
  file?: string;
  order?: number;
  version?: number;

  // Parameter mappings (internal param name → external path)
  params?: Record<string, ParamMapping | string>; // string is shorthand for just external path

  // Output mapping
  output?: string | ParamMapping;

  // Auto-execute when inputs change?
  reactive?: boolean;

  // Execution options
  debounce?: number;  // ms to wait before re-executing
}

/**
 * Create a reactive snippet from a function
 */
export function createReactiveSnippet(
  path: string,
  fn: Function,
  opts: ReactiveSnippetOptions
): ReturnType<typeof $$> {
  const atomics = getAtomics();

  // 1. Store the function as code text
  const fnStr = fn.toString();
  createSnippet(path, fnStr, {
    id: opts.id,
    lang: opts.lang || 'js',
    file: opts.file,
    order: opts.order,
    version: opts.version
  });

  // 2. Store the actual function for execution
  $$(`${path}.__fn`).set(fn);

  // 3. Auto-detect parameter names from function signature
  const paramNames = extractParamNames(fnStr);

  // 4. Create param nodes and entanglements
  const links: AtomicLink[] = [];

  if (opts.params) {
    for (const paramName of paramNames) {
      const mapping = opts.params[paramName];
      if (!mapping) continue;

      const config = typeof mapping === 'string'
        ? { external: mapping }
        : mapping;

      const paramPath = `${path}.__params.${paramName}`;

      // Initialize with default if provided
      if (config.default !== undefined) {
        $$(paramPath).val(config.default);
      }

      // Create entanglement: external → param (one-way input)
      const link = atomics.entangle(
        config.external,
        paramPath,
        {
          oneWayAToB: true,
          mapAToB: config.transform,
          syncInitialValue: true,
          hooksB: config.validate ? {
            beforeSet: ({ incoming }: any) => {
              if (!config.validate!(incoming)) {
                console.warn(`[ReactiveSnippet] Validation failed for ${paramName}: ${incoming}`);
                return { action: 'skip' };
              }
              return { action: 'proceed', value: incoming };
            }
          } : undefined
        }
      );

      links.push(link);

      // Track connection
      const connections = $$(`${path}.__connections.in`).get() || [];
      connections.push({
        internal: paramName,
        external: config.external,
        transform: config.transform ? config.transform.toString() : undefined
      });
      $$(`${path}.__connections.in`).set(connections);
    }
  }

  // 5. Setup output mapping if provided
  if (opts.output) {
    const config = typeof opts.output === 'string'
      ? { external: opts.output }
      : opts.output;

    const resultPath = `${path}.__result`;

    // Create entanglement: result → external (one-way output)
    const link = atomics.entangle(
      resultPath,
      config.external,
      {
        oneWayAToB: true,
        mapAToB: config.transform,
        syncInitialValue: false  // Don't sync until we have a result
      }
    );

    links.push(link);

    // Track connection
    const connections = $$(`${path}.__connections.out`).get() || [];
    connections.push({
      internal: 'return',
      external: config.external
    });
    $$(`${path}.__connections.out`).set(connections);
  }

  // 6. Store all links for later control
  $$(`${path}.__links`).set(links);

  // 7. Create execute method
  const executeFn = () => {
    try {
      // Get current param values
      const args = paramNames.map(param => $$(`${path}.__params.${param}`).val());

      // Execute function
      const fn = $$(`${path}.__fn`).val();
      if (typeof fn === 'function') {
        const result = fn(...args);

        // Store result
        $$(`${path}.__result`).val(result);

        // Log execution
        $$(`${path}.__lastExecution`).set({
          timestamp: Date.now(),
          args,
          result
        });

        return result;
      }
    } catch (error) {
      console.error(`[ReactiveSnippet] Execution error in ${opts.id}:`, error);
      $$(`${path}.__error`).set({
        message: String(error),
        timestamp: Date.now()
      });
      return undefined;
    }
  };

  $$(`${path}.execute`).set(executeFn);

  // 8. Setup reactive execution if requested
  if (opts.reactive) {
    setupReactiveExecution(path, paramNames, opts.debounce);
  }

  // 9. Add toString to return original code
  const node = $$(path).node();
  Object.defineProperty(node, 'toString', {
    value: () => fnStr,
    enumerable: false
  });

  console.log(`[ReactiveSnippet] Created ${opts.id} with ${paramNames.length} params, reactive=${opts.reactive || false}`);

  return $$(path);
}

/**
 * Extract parameter names from function string
 */
function extractParamNames(fnStr: string): string[] {
  // Try function syntax: function name(a, b, c)
  let match = fnStr.match(/function\s+\w*\s*\(([^)]*)\)/);

  if (!match) {
    // Try arrow syntax: (a, b, c) =>
    match = fnStr.match(/\(([^)]*)\)\s*=>/);
  }

  if (!match) {
    // Try single param arrow: a =>
    match = fnStr.match(/(\w+)\s*=>/);
  }

  if (!match) {
    return [];
  }

  const paramsStr = match[1];
  return paramsStr
    .split(',')
    .map(p => p.trim().split(/[:=\s]/)[0].trim())
    .filter(Boolean);
}

/**
 * Setup reactive execution (auto-execute when params change)
 */
function setupReactiveExecution(
  snippetPath: string,
  paramNames: string[],
  debounceMs: number = 0
) {
  let timer: any = null;

  const execute = () => {
    const executeFn = $$(`${snippetPath}.execute`).val();
    if (typeof executeFn === 'function') {
      executeFn();
    }
  };

  const scheduleExecution = () => {
    if (debounceMs > 0) {
      clearTimeout(timer);
      timer = setTimeout(execute, debounceMs);
    } else {
      // Use microtask for immediate but coalesced execution
      queueMicrotask(execute);
    }
  };

  // Watch all param nodes for changes
  for (const paramName of paramNames) {
    const paramPath = `${snippetPath}.__params.${paramName}`;
    $$(paramPath).watch(() => {
      scheduleExecution();
    });
  }

  console.log(`[ReactiveSnippet] Setup reactive execution for ${snippetPath} (debounce=${debounceMs}ms)`);
}

/**
 * Helper: Get all param values for a snippet
 */
export function getSnippetParams(snippetPath: string): Record<string, any> {
  const connections = $$(`${snippetPath}.__connections.in`).get() || [];
  const params: Record<string, any> = {};

  for (const conn of connections) {
    params[conn.internal] = $$(`${snippetPath}.__params.${conn.internal}`).val();
  }

  return params;
}

/**
 * Helper: Get snippet result
 */
export function getSnippetResult(snippetPath: string): any {
  return $$(`${snippetPath}.__result`).val();
}

/**
 * Helper: Get snippet execution history
 */
export function getSnippetHistory(snippetPath: string): any {
  return $$(`${snippetPath}.__lastExecution`).get();
}

/**
 * Helper: Pause/resume snippet reactivity
 */
export function pauseSnippet(snippetPath: string): void {
  const links = $$(`${snippetPath}.__links`).val() as AtomicLink[];
  if (links && Array.isArray(links)) {
    links.forEach(link => link.pause());
  }
}

export function resumeSnippet(snippetPath: string): void {
  const links = $$(`${snippetPath}.__links`).val() as AtomicLink[];
  if (links && Array.isArray(links)) {
    links.forEach(link => link.resume());
  }
}

/**
 * Helper: Dispose snippet (cleanup all entanglements)
 */
export function disposeSnippet(snippetPath: string): void {
  const links = $$(`${snippetPath}.__links`).val() as AtomicLink[];
  if (links && Array.isArray(links)) {
    links.forEach(link => link.dispose());
  }
  console.log(`[ReactiveSnippet] Disposed ${snippetPath}`);
}
