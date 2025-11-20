/**
 * Timeline - Time travel debugging timeline
 */

import React from 'react';
import { useTimeline } from '@/core/store';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export function Timeline() {
  const timeline = useTimeline();

  if (timeline.snapshots.length === 0) {
    return (
      <div className="p-4 h-full flex items-center justify-center text-white/40">
        <p className="text-sm">No snapshots yet. Create one to enable time travel!</p>
      </div>
    );
  }

  const currentSnapshot = timeline.snapshots[timeline.currentIndex];

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Timeline</h2>
        <div className="flex items-center gap-2">
          <button className="button-secondary p-1.5">
            <SkipBack size={14} />
          </button>
          <button className="button-secondary p-1.5">
            {timeline.playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className="button-secondary p-1.5">
            <SkipForward size={14} />
          </button>
          <select
            className="input text-xs py-1"
            value={timeline.playbackSpeed}
            onChange={(e) => {}}
          >
            <option value={0.1}>0.1x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      {/* Timeline track */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-2 bg-white/10 rounded-full relative">
            {/* Progress bar */}
            <div
              className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all"
              style={{
                width: `${(timeline.currentIndex / (timeline.snapshots.length - 1)) * 100}%`,
              }}
            />

            {/* Snapshot markers */}
            {timeline.snapshots.map((snapshot, index) => {
              const position = (index / (timeline.snapshots.length - 1)) * 100;
              const isCurrent = index === timeline.currentIndex;

              return (
                <div
                  key={snapshot.id}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-blue-500 scale-150 ring-2 ring-blue-500/50'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  style={{ left: `${position}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                  title={snapshot.description}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Current snapshot info */}
      {currentSnapshot && (
        <div className="mt-4 bg-black/30 rounded p-3 text-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{currentSnapshot.description}</div>
              <div className="text-xs text-white/50 mt-1">
                {new Date(currentSnapshot.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-white/50">
              {timeline.currentIndex + 1} / {timeline.snapshots.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
