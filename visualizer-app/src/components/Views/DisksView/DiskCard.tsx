/**
 * DiskCard Component
 * Individual disk card showing disk information and actions
 */

import React from 'react';
import { HardDrive, Play, Pause, Save, Share2, MoreVertical, Eye, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { formatBytes, formatNumber, formatRelativeTime } from '../../../lib/utils';
import type { Disk } from '../../../store/appStore';

interface DiskCardProps {
  disk: Disk;
  onMount?: (disk: Disk) => void;
  onUnmount?: (disk: Disk) => void;
  onView?: (disk: Disk) => void;
  onSave?: (disk: Disk) => void;
  onShare?: (disk: Disk) => void;
  onSettings?: (disk: Disk) => void;
}

export const DiskCard: React.FC<DiskCardProps> = ({
  disk,
  onMount,
  onUnmount,
  onView,
  onSave,
  onShare,
  onSettings,
}) => {
  const isMounted = disk.isMounted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'bg-[#16161d] rounded-xl border transition-all',
        isMounted
          ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10'
          : 'border-[#2a2a35] hover:border-[#3a3a45]'
      )}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-[#2a2a35]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isMounted ? 'bg-indigo-500/20' : 'bg-white/5'
            )}>
              <HardDrive className={cn(
                'w-5 h-5',
                isMounted ? 'text-indigo-400' : 'text-gray-400'
              )} />
            </div>
            <div>
              <h3 className="text-white font-semibold">{disk.name}</h3>
              {disk.mountPoint && (
                <p className="text-xs text-gray-500">{disk.mountPoint}</p>
              )}
            </div>
          </div>

          <button className="p-1 hover:bg-white/10 rounded transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Card Body - Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="text-2xl">📊</div>
            <div>
              <div className="text-xs text-gray-500">Nodes</div>
              <div className="text-sm text-white font-semibold">
                {formatNumber(disk.nodeCount)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-2xl">💾</div>
            <div>
              <div className="text-xs text-gray-500">Size</div>
              <div className="text-sm text-white font-semibold">
                {formatBytes(disk.size)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-2xl">📝</div>
            <div>
              <div className="text-xs text-gray-500">Files</div>
              <div className="text-sm text-white font-semibold">
                {disk.fileCount}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-2xl">🔄</div>
            <div>
              <div className="text-xs text-gray-500">Sync</div>
              <div className="text-sm text-white font-semibold">
                {formatRelativeTime(disk.lastModified)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="pt-2 border-t border-[#2a2a35] space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Auto-sync</span>
            <span className={cn(
              'font-medium',
              disk.autoSync ? 'text-emerald-400' : 'text-gray-400'
            )}>
              {disk.autoSync ? 'ON' : 'OFF'}
            </span>
          </div>
          {isMounted && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Status</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Mounted
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer - Actions */}
      <div className="p-3 bg-[#0a0a0f] rounded-b-xl border-t border-[#2a2a35]">
        <div className="flex items-center gap-2">
          {isMounted ? (
            <>
              <button
                onClick={() => onView?.(disk)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                onClick={() => onUnmount?.(disk)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
              >
                <Pause className="w-4 h-4" />
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={() => onMount?.(disk)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Mount
            </button>
          )}

          <button
            onClick={() => onSave?.(disk)}
            className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title="Save"
          >
            <Save className="w-4 h-4" />
          </button>

          <button
            onClick={() => onShare?.(disk)}
            className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSettings?.(disk)}
            className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
