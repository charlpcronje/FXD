/**
 * Inspector - Node property inspector panel
 */

import React from 'react';
import { useVisualizerStore } from '@/core/store';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

export function Inspector() {
  const { inspector, setInspector } = useVisualizerStore();
  const node = inspector.node;

  if (!node) {
    return (
      <div className="p-4 h-full flex items-center justify-center text-white/40">
        <div className="text-center">
          <p className="text-sm">No node selected</p>
          <p className="text-xs mt-2">Click a node to inspect it</p>
        </div>
      </div>
    );
  }

  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;

    const type = typeof value;

    if (type === 'string') {
      return <span className="text-green-400">"{value}"</span>;
    }

    if (type === 'number') {
      return <span className="text-blue-400">{value}</span>;
    }

    if (type === 'boolean') {
      return <span className="text-yellow-400">{String(value)}</span>;
    }

    if (type === 'function') {
      return <span className="text-cyan-400">[Function]</span>;
    }

    if (Array.isArray(value)) {
      return (
        <span className="text-pink-400">
          Array({value.length})
        </span>
      );
    }

    if (type === 'object') {
      const keys = Object.keys(value);
      return (
        <span className="text-purple-400">
          Object ({keys.length} keys)
        </span>
      );
    }

    return String(value);
  };

  return (
    <div className="p-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">{node.id}</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {node.type}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
              {node.dataType}
            </span>
            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">
              {node.layer}
            </span>
          </div>
        </div>
        <button
          className="p-1 hover:bg-white/10 rounded"
          onClick={() => setInspector({ node: null })}
        >
          <X size={16} />
        </button>
      </div>

      {/* Properties */}
      <div className="space-y-4">
        {/* Value */}
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Value</h3>
          <div className="bg-black/30 rounded p-3 font-mono text-sm">
            {renderValue(node.value)}
          </div>
        </div>

        {/* State */}
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-2">State</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Status</div>
              <div className="text-white mt-1">{node.state}</div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Updates</div>
              <div className="text-white mt-1">{node.updateCount}</div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Frequency</div>
              <div className="text-white mt-1">{node.updateFrequency.toFixed(2)}/s</div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Watched</div>
              <div className="text-white mt-1">{node.isWatched ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>

        {/* Position */}
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Position</h3>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">X</div>
              <div className="text-white mt-1">{node.position.x.toFixed(1)}</div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Y</div>
              <div className="text-white mt-1">{node.position.y.toFixed(1)}</div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-white/50">Z</div>
              <div className="text-white mt-1">{node.position.z.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Metadata</h3>
          <div className="bg-black/30 rounded p-3 text-xs font-mono space-y-1">
            {Object.entries(node.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-white/50">{key}:</span>
                <span className="text-white">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Errors */}
        {node.errors.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-2">Errors</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs space-y-2">
              {node.errors.map((error, i) => (
                <div key={i} className="text-red-300">
                  {error.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
