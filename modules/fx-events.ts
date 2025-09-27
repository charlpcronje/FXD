/**
 * @file fx-events.ts
 * @description Advanced event bus system for FXD
 * Provides typed events, priority handling, async/sync dispatch, and middleware support
 */

import { FXCore } from "../fx.ts";

/**
 * Event priority levels
 */
export enum EventPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15
}

/**
 * Event listener options
 */
export interface EventListenerOptions {
  priority?: EventPriority;
  once?: boolean;
  async?: boolean;
  timeout?: number;
  condition?: () => boolean;
  metadata?: Record<string, any>;
}

/**
 * Event listener with metadata
 */
export interface EventListener<T = any> {
  id: string;
  handler: (data: T, event: FXDEvent<T>) => void | Promise<void>;
  options: Required<EventListenerOptions>;
  registeredAt: Date;
  callCount: number;
  lastCalled?: Date;
  errors: Array<{ error: Error; timestamp: Date }>;
}

/**
 * Event object structure
 */
export interface FXDEvent<T = any> {
  id: string;
  type: string;
  data: T;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
  cancelled?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
}

/**
 * Event middleware function
 */
export type EventMiddleware = (
  event: FXDEvent,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Event statistics
 */
export interface EventStats {
  totalEvents: number;
  totalListeners: number;
  averageDispatchTime: number;
  errorRate: number;
  typeStats: Record<string, {
    count: number;
    averageTime: number;
    errors: number;
  }>;
}

/**
 * Built-in FXD system events
 */
export interface FXDSystemEvents {
  "app:ready": { app: any };
  "app:shutdown": { app: any };
  "app:error": { error: Error; context?: string };
  "config:changed": { key: string; value: any; oldValue: any };
  "module:loaded": { name: string; module: any };
  "module:unloaded": { name: string };
  "persistence:save": { type: "auto" | "manual"; success: boolean };
  "persistence:load": { source: string; success: boolean };
  "node:created": { nodeId: string; path?: string };
  "node:updated": { nodeId: string; path?: string; value: any };
  "node:deleted": { nodeId: string; path?: string };
  "server:started": { port: number; host: string };
  "server:stopped": {};
  "health:check": { healthy: boolean; details: any };
}

/**
 * Advanced event bus system
 */
export class FXDEventBus {
  private fx: FXCore;
  private listeners = new Map<string, Map<string, EventListener>>();
  private middleware: EventMiddleware[] = [];
  private eventHistory: FXDEvent[] = [];
  private stats: EventStats = {
    totalEvents: 0,
    totalListeners: 0,
    averageDispatchTime: 0,
    errorRate: 0,
    typeStats: {}
  };

  // Configuration
  private maxHistorySize = 1000;
  private defaultTimeout = 5000;
  private enableMetrics = true;

  // Performance tracking
  private dispatchTimes: number[] = [];
  private errorCount = 0;

  constructor(fx: FXCore) {
    this.fx = fx;
    this._setupDefaultMiddleware();
  }

  /**
   * Subscribe to events with type safety
   */
  on<K extends keyof FXDSystemEvents>(
    type: K,
    handler: (data: FXDSystemEvents[K], event: FXDEvent<FXDSystemEvents[K]>) => void | Promise<void>,
    options?: EventListenerOptions
  ): string;
  on<T = any>(
    type: string,
    handler: (data: T, event: FXDEvent<T>) => void | Promise<void>,
    options?: EventListenerOptions
  ): string;
  on<T = any>(
    type: string,
    handler: (data: T, event: FXDEvent<T>) => void | Promise<void>,
    options: EventListenerOptions = {}
  ): string {
    const id = this._generateId();
    const listener: EventListener<T> = {
      id,
      handler,
      options: {
        priority: options.priority ?? EventPriority.NORMAL,
        once: options.once ?? false,
        async: options.async ?? false,
        timeout: options.timeout ?? this.defaultTimeout,
        condition: options.condition ?? (() => true),
        metadata: options.metadata ?? {},
      },
      registeredAt: new Date(),
      callCount: 0,
      errors: [],
    };

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Map());
    }

    this.listeners.get(type)!.set(id, listener);
    this._updateStats();

    // Store in FX tree for introspection
    this.fx.proxy(`system.events.listeners.${type}.${id}`).val(listener);

    return id;
  }

  /**
   * Subscribe to event once
   */
  once<K extends keyof FXDSystemEvents>(
    type: K,
    handler: (data: FXDSystemEvents[K], event: FXDEvent<FXDSystemEvents[K]>) => void | Promise<void>,
    options?: Omit<EventListenerOptions, 'once'>
  ): string;
  once<T = any>(
    type: string,
    handler: (data: T, event: FXDEvent<T>) => void | Promise<void>,
    options?: Omit<EventListenerOptions, 'once'>
  ): string;
  once<T = any>(
    type: string,
    handler: (data: T, event: FXDEvent<T>) => void | Promise<void>,
    options: Omit<EventListenerOptions, 'once'> = {}
  ): string {
    return this.on(type, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from events
   */
  off(listenerId: string): boolean;
  off(type: string, listenerId?: string): boolean;
  off(typeOrId: string, listenerId?: string): boolean {
    if (!listenerId) {
      // Remove by listener ID across all types
      for (const [type, typeListeners] of this.listeners) {
        if (typeListeners.has(typeOrId)) {
          typeListeners.delete(typeOrId);
          this.fx.proxy(`system.events.listeners.${type}.${typeOrId}`).val(undefined);
          this._updateStats();
          return true;
        }
      }
      return false;
    }

    // Remove specific listener from type
    const typeListeners = this.listeners.get(typeOrId);
    if (!typeListeners || !typeListeners.has(listenerId)) {
      return false;
    }

    typeListeners.delete(listenerId);
    this.fx.proxy(`system.events.listeners.${typeOrId}.${listenerId}`).val(undefined);
    this._updateStats();
    return true;
  }

  /**
   * Emit event synchronously
   */
  emit<K extends keyof FXDSystemEvents>(
    type: K,
    data: FXDSystemEvents[K],
    source?: string,
    metadata?: Record<string, any>
  ): void;
  emit<T = any>(
    type: string,
    data: T,
    source?: string,
    metadata?: Record<string, any>
  ): void;
  emit<T = any>(
    type: string,
    data: T,
    source?: string,
    metadata?: Record<string, any>
  ): void {
    const event = this._createEvent(type, data, source, metadata);
    this._dispatchSync(event);
  }

  /**
   * Emit event asynchronously
   */
  async emitAsync<K extends keyof FXDSystemEvents>(
    type: K,
    data: FXDSystemEvents[K],
    source?: string,
    metadata?: Record<string, any>
  ): Promise<void>;
  async emitAsync<T = any>(
    type: string,
    data: T,
    source?: string,
    metadata?: Record<string, any>
  ): Promise<void>;
  async emitAsync<T = any>(
    type: string,
    data: T,
    source?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event = this._createEvent(type, data, source, metadata);
    await this._dispatchAsync(event);
  }

  /**
   * Wait for a specific event
   */
  waitFor<K extends keyof FXDSystemEvents>(
    type: K,
    timeout?: number,
    condition?: (data: FXDSystemEvents[K]) => boolean
  ): Promise<FXDSystemEvents[K]>;
  waitFor<T = any>(
    type: string,
    timeout?: number,
    condition?: (data: T) => boolean
  ): Promise<T>;
  waitFor<T = any>(
    type: string,
    timeout: number = this.defaultTimeout,
    condition?: (data: T) => boolean
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: any;

      const listenerId = this.once(type, (data: T) => {
        if (!condition || condition(data)) {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(data);
        }
      });

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(listenerId);
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeout);
      }
    });
  }

  /**
   * Add middleware for event processing
   */
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware: EventMiddleware): boolean {
    const index = this.middleware.indexOf(middleware);
    if (index >= 0) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get event statistics
   */
  getStats(): EventStats {
    return { ...this.stats };
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): FXDEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory];
  }

  /**
   * Get listeners for a type
   */
  getListeners(type: string): EventListener[] {
    const typeListeners = this.listeners.get(type);
    return typeListeners ? Array.from(typeListeners.values()) : [];
  }

  /**
   * Get all event types
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys()).sort();
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this._updateStats();
    this.fx.proxy("system.events.listeners").val({});
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Enable/disable metrics collection
   */
  setMetricsEnabled(enabled: boolean): void {
    this.enableMetrics = enabled;
  }

  /**
   * Configure event bus settings
   */
  configure(options: {
    maxHistorySize?: number;
    defaultTimeout?: number;
    enableMetrics?: boolean;
  }): void {
    if (options.maxHistorySize !== undefined) {
      this.maxHistorySize = options.maxHistorySize;
    }
    if (options.defaultTimeout !== undefined) {
      this.defaultTimeout = options.defaultTimeout;
    }
    if (options.enableMetrics !== undefined) {
      this.enableMetrics = options.enableMetrics;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clear();
    this.clearHistory();
    this.middleware = [];
    this.dispatchTimes = [];
    this.errorCount = 0;
  }

  // Private methods

  private _generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private _createEvent<T>(
    type: string,
    data: T,
    source?: string,
    metadata?: Record<string, any>
  ): FXDEvent<T> {
    let cancelled = false;
    let propagationStopped = false;
    let immediatePropagationStopped = false;

    return {
      id: this._generateId(),
      type,
      data,
      timestamp: new Date(),
      source,
      metadata: metadata || {},
      get cancelled() { return cancelled; },
      preventDefault: () => { cancelled = true; },
      stopPropagation: () => { propagationStopped = true; },
      stopImmediatePropagation: () => { immediatePropagationStopped = true; },
      _propagationStopped: () => propagationStopped,
      _immediatePropagationStopped: () => immediatePropagationStopped,
    } as FXDEvent<T> & {
      _propagationStopped: () => boolean;
      _immediatePropagationStopped: () => boolean;
    };
  }

  private _dispatchSync<T>(event: FXDEvent<T>): void {
    const startTime = Date.now();

    try {
      this._addToHistory(event);
      this._processMiddleware(event, () => Promise.resolve()).catch(console.error);
      this._callListeners(event, false);
    } catch (error) {
      this._recordError(error as Error);
      console.error("[Events] Sync dispatch error:", error);
    } finally {
      if (this.enableMetrics) {
        this._recordDispatchTime(Date.now() - startTime);
        this._updateTypeStats(event.type, Date.now() - startTime, false);
      }
    }
  }

  private async _dispatchAsync<T>(event: FXDEvent<T>): Promise<void> {
    const startTime = Date.now();

    try {
      this._addToHistory(event);
      await this._processMiddleware(event, async () => {
        await this._callListeners(event, true);
      });
    } catch (error) {
      this._recordError(error as Error);
      console.error("[Events] Async dispatch error:", error);
      throw error;
    } finally {
      if (this.enableMetrics) {
        this._recordDispatchTime(Date.now() - startTime);
        this._updateTypeStats(event.type, Date.now() - startTime, false);
      }
    }
  }

  private async _processMiddleware(event: FXDEvent, next: () => Promise<void>): Promise<void> {
    let index = 0;

    const runNext = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        await next();
        return;
      }

      const middleware = this.middleware[index++];
      await middleware(event, runNext);
    };

    await runNext();
  }

  private async _callListeners<T>(event: FXDEvent<T>, async: boolean): Promise<void> {
    const typeListeners = this.listeners.get(event.type);
    if (!typeListeners) return;

    // Sort listeners by priority (highest first)
    const sortedListeners = Array.from(typeListeners.values())
      .filter(listener => listener.options.condition())
      .sort((a, b) => b.options.priority - a.options.priority);

    const promises: Promise<void>[] = [];

    for (const listener of sortedListeners) {
      // Check for immediate propagation stop
      if ((event as any)._immediatePropagationStopped()) {
        break;
      }

      const promise = this._callListener(listener, event);

      if (async && listener.options.async) {
        promises.push(promise);
      } else {
        await promise;
      }

      // Remove one-time listeners
      if (listener.options.once) {
        typeListeners.delete(listener.id);
        this.fx.proxy(`system.events.listeners.${event.type}.${listener.id}`).val(undefined);
      }
    }

    // Wait for all async listeners
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    this._updateStats();
  }

  private async _callListener<T>(listener: EventListener<T>, event: FXDEvent<T>): Promise<void> {
    try {
      listener.callCount++;
      listener.lastCalled = new Date();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Listener timeout")), listener.options.timeout);
      });

      const handlerPromise = Promise.resolve(listener.handler(event.data, event));

      await Promise.race([handlerPromise, timeoutPromise]);

    } catch (error) {
      const errorObj = error as Error;
      listener.errors.push({ error: errorObj, timestamp: new Date() });
      this._recordError(errorObj);
      console.error(`[Events] Listener error for event ${event.type}:`, error);

      // Limit error history per listener
      if (listener.errors.length > 10) {
        listener.errors.splice(0, listener.errors.length - 10);
      }
    }
  }

  private _addToHistory<T>(event: FXDEvent<T>): void {
    this.eventHistory.push(event);

    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.splice(0, this.eventHistory.length - this.maxHistorySize);
    }

    // Store in FX tree for introspection
    this.fx.proxy(`system.events.history.${event.id}`).val(event);
  }

  private _recordDispatchTime(time: number): void {
    this.dispatchTimes.push(time);

    // Keep only last 100 dispatch times
    if (this.dispatchTimes.length > 100) {
      this.dispatchTimes.splice(0, this.dispatchTimes.length - 100);
    }

    // Update average
    this.stats.averageDispatchTime =
      this.dispatchTimes.reduce((sum, time) => sum + time, 0) / this.dispatchTimes.length;
  }

  private _recordError(error: Error): void {
    this.errorCount++;
    this.stats.errorRate = this.errorCount / Math.max(this.stats.totalEvents, 1);
  }

  private _updateTypeStats(type: string, time: number, hasError: boolean): void {
    if (!this.stats.typeStats[type]) {
      this.stats.typeStats[type] = { count: 0, averageTime: 0, errors: 0 };
    }

    const typeStats = this.stats.typeStats[type];
    typeStats.count++;
    typeStats.averageTime = (typeStats.averageTime * (typeStats.count - 1) + time) / typeStats.count;

    if (hasError) {
      typeStats.errors++;
    }
  }

  private _updateStats(): void {
    this.stats.totalEvents = this.eventHistory.length;
    this.stats.totalListeners = Array.from(this.listeners.values())
      .reduce((sum, typeListeners) => sum + typeListeners.size, 0);

    // Update FX tree
    this.fx.proxy("system.events.stats").val(this.stats);
  }

  private _setupDefaultMiddleware(): void {
    // Logging middleware
    this.use(async (event, next) => {
      console.debug(`[Events] ${event.type}`, event.data);
      await next();
    });

    // Metrics middleware
    this.use(async (event, next) => {
      if (this.enableMetrics) {
        this.stats.totalEvents++;
      }
      await next();
    });
  }
}

/**
 * Factory function to create an event bus
 */
export function createEventBus(fx: FXCore): FXDEventBus {
  return new FXDEventBus(fx);
}

/**
 * Export types and enums
 */
export type {
  EventListener,
  EventListenerOptions,
  FXDEvent,
  EventMiddleware,
  EventStats,
  FXDSystemEvents,
};