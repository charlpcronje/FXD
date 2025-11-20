/**
 * Console - Integrated console panel
 */

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, Trash2, Search } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export function Console() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<string>>(
    new Set(['log', 'info', 'warn', 'error'])
  );
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Capture console methods (for demo)
  useEffect(() => {
    const addLog = (level: 'log' | 'info' | 'warn' | 'error', ...args: any[]) => {
      const message = args.map((arg) => String(arg)).join(' ');
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          level,
          message,
          data: args.length > 1 ? args.slice(1) : undefined,
        },
      ]);
    };

    // Add some demo logs
    addLog('info', '[FX Visualizer] Console initialized');

    return () => {};
  }, []);

  const clearLogs = () => setLogs([]);

  const toggleLevel = (level: string) => {
    const newFilter = new Set(levelFilter);
    if (newFilter.has(level)) {
      newFilter.delete(level);
    } else {
      newFilter.add(level);
    }
    setLevelFilter(newFilter);
  };

  const filteredLogs = logs.filter((log) => {
    if (!levelFilter.has(log.level)) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal size={16} />
          <h2 className="text-sm font-bold">Console</h2>
          <span className="text-xs text-white/40">({filteredLogs.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Level filters */}
          <div className="flex items-center gap-1">
            {['log', 'info', 'warn', 'error'].map((level) => (
              <button
                key={level}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  levelFilter.has(level)
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
                onClick={() => toggleLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <button className="button-secondary p-1.5" onClick={clearLogs} title="Clear console">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          className="input w-full pl-9 py-1.5 text-sm"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto bg-black/30 rounded p-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-white/40 text-center py-8">No logs to display</div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 px-2 py-1 rounded">
                <span className="text-white/30 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-white break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
