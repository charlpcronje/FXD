/**
 * Metrics - Performance metrics panel
 */

import React from 'react';
import { useMetrics } from '@/core/store';
import { Activity, Layers, Link, Clock, Cpu } from 'lucide-react';

export function Metrics() {
  const metrics = useMetrics();

  const getFPSClass = (fps: number) => {
    if (fps >= 55) return 'fps-good';
    if (fps >= 30) return 'fps-medium';
    return 'fps-bad';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="glass-dark rounded-lg p-4 min-w-[280px]">
      <h2 className="text-sm font-bold mb-3 text-white/70">Performance</h2>

      <div className="space-y-2">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Activity size={14} className="text-white/50" />
            <span className="text-white/70">FPS</span>
          </div>
          <span className={`text-sm font-mono font-bold ${getFPSClass(metrics.fps)}`}>
            {metrics.fps}
          </span>
        </div>

        {/* Nodes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Layers size={14} className="text-white/50" />
            <span className="text-white/70">Nodes</span>
          </div>
          <span className="text-sm font-mono">{metrics.nodeCount}</span>
        </div>

        {/* Connections */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Link size={14} className="text-white/50" />
            <span className="text-white/70">Connections</span>
          </div>
          <span className="text-sm font-mono">{metrics.connectionCount}</span>
        </div>

        {/* Update rate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Clock size={14} className="text-white/50" />
            <span className="text-white/70">Updates/s</span>
          </div>
          <span className="text-sm font-mono">{metrics.updateRate.toFixed(1)}</span>
        </div>

        {/* Render time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Cpu size={14} className="text-white/50" />
            <span className="text-white/70">Render</span>
          </div>
          <span className="text-sm font-mono">{metrics.renderTime.toFixed(2)}ms</span>
        </div>

        {/* Memory */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Cpu size={14} className="text-white/50" />
            <span className="text-white/70">Memory</span>
          </div>
          <span className="text-sm font-mono">{formatBytes(metrics.memoryUsage)}</span>
        </div>
      </div>
    </div>
  );
}
