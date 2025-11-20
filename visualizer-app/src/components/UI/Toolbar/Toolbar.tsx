/**
 * Toolbar - Main application toolbar
 */

import React from 'react';
import {
  Play,
  Pause,
  Camera,
  Grid3x3,
  Tag,
  BarChart3,
  Layers,
  Settings,
  Maximize2,
  Download,
  Upload,
} from 'lucide-react';
import { useVisualizerStore, useSettings, useTimeline } from '@/core/store';

export function Toolbar() {
  const settings = useSettings();
  const timeline = useTimeline();
  const { updateSettings, togglePanel, playTimeline, pauseTimeline, createSnapshot } =
    useVisualizerStore();

  return (
    <div className="glass-dark border-b border-white/10 px-4 py-2 flex items-center gap-4 z-50">
      {/* Logo */}
      <div className="text-gradient-primary font-bold text-lg">FX VISUALIZER</div>

      <div className="h-6 w-px bg-white/10" />

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <button
          className="button-secondary p-2"
          onClick={() => (timeline.playing ? pauseTimeline() : playTimeline())}
          title={timeline.playing ? 'Pause' : 'Play'}
        >
          {timeline.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          className="button-secondary px-3 py-1 text-sm"
          onClick={() => createSnapshot('Manual snapshot')}
          title="Create snapshot"
        >
          Snapshot
        </button>
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* View controls */}
      <div className="flex items-center gap-2">
        <button
          className={`button-secondary p-2 ${settings.showGrid ? 'bg-blue-500/20' : ''}`}
          onClick={() => updateSettings({ showGrid: !settings.showGrid })}
          title="Toggle grid"
        >
          <Grid3x3 size={16} />
        </button>

        <button
          className={`button-secondary p-2 ${settings.showLabels ? 'bg-blue-500/20' : ''}`}
          onClick={() => updateSettings({ showLabels: !settings.showLabels })}
          title="Toggle labels"
        >
          <Tag size={16} />
        </button>

        <button
          className={`button-secondary p-2 ${settings.showStats ? 'bg-blue-500/20' : ''}`}
          onClick={() => updateSettings({ showStats: !settings.showStats })}
          title="Toggle stats"
        >
          <BarChart3 size={16} />
        </button>
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Panel toggles */}
      <div className="flex items-center gap-2">
        <button
          className="button-secondary p-2"
          onClick={() => togglePanel('inspector')}
          title="Toggle inspector"
        >
          <Layers size={16} />
        </button>

        <button
          className="button-secondary p-2"
          onClick={() => togglePanel('metrics')}
          title="Toggle metrics"
        >
          <BarChart3 size={16} />
        </button>

        <button
          className="button-secondary p-2"
          onClick={() => togglePanel('timeline')}
          title="Toggle timeline"
        >
          <Camera size={16} />
        </button>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="button-secondary p-2" title="Export state">
          <Download size={16} />
        </button>

        <button className="button-secondary p-2" title="Import state">
          <Upload size={16} />
        </button>

        <button className="button-secondary p-2" title="Fullscreen">
          <Maximize2 size={16} />
        </button>

        <button className="button-secondary p-2" title="Settings">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
