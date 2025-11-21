/**
 * StatusBar Component
 * Bottom status bar showing disk info, node count, memory, sync status
 */

import React, { useEffect, useState } from 'react';
import { HardDrive, Box, Database, Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/appStore';
import { formatBytes, formatNumber } from '../../lib/utils';
import { theme } from '../../design-tokens';

interface StatusItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status?: 'default' | 'success' | 'warning' | 'error' | 'loading';
  onClick?: () => void;
}

const StatusItem: React.FC<StatusItemProps> = ({
  icon: Icon,
  label,
  value,
  status = 'default',
  onClick,
}) => {
  const statusColors = {
    default: 'text-gray-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    loading: 'text-blue-400',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1 rounded hover:bg-white/5 transition-colors',
        onClick && 'cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      <Icon className={cn('w-4 h-4', statusColors[status])} />
      <span className="text-xs text-gray-500">{label}:</span>
      <span className={cn('text-xs font-semibold', statusColors[status])}>
        {value}
      </span>
    </button>
  );
};

interface StatusBarProps {
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ className }) => {
  const { disks, nodes, mountedDisks } = useAppStore();
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  // Calculate total stats
  const totalDisks = disks.length;
  const activeDisk = disks.find(d => mountedDisks.includes(d.id));
  const totalNodes = Array.from(nodes.values()).length;
  const totalSize = disks.reduce((sum, d) => sum + d.size, 0);

  // Simulate memory tracking
  useEffect(() => {
    const updateMemory = () => {
      // In real app, this would come from actual memory monitoring
      const randomMemory = 12 + Math.random() * 3; // 12-15 MB
      setMemoryUsage(randomMemory * 1024 * 1024);
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);

    return () => clearInterval(interval);
  }, []);

  // Simulate sync status
  useEffect(() => {
    if (mountedDisks.length === 0) {
      setSyncStatus('synced');
      return;
    }

    const simulateSync = () => {
      setSyncStatus('syncing');
      setTimeout(() => {
        setSyncStatus('synced');
      }, 1000);
    };

    const interval = setInterval(simulateSync, 10000);

    return () => clearInterval(interval);
  }, [mountedDisks]);

  const getSyncIcon = () => {
    if (syncStatus === 'syncing') return Loader2;
    if (syncStatus === 'error') return AlertCircle;
    return CheckCircle2;
  };

  const getSyncText = () => {
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync Error';
    return 'Synced';
  };

  const getSyncStatus = () => {
    if (syncStatus === 'syncing') return 'loading';
    if (syncStatus === 'error') return 'error';
    return 'success';
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 bg-[#0a0a0f] border-t border-[#2a2a35]',
        className
      )}
      style={{ height: theme.layout.statusBarHeight }}
    >
      {/* Left Section - Disk and Node Stats */}
      <div className="flex items-center gap-1">
        <StatusItem
          icon={HardDrive}
          label="Disks"
          value={`${totalDisks}`}
        />
        <div className="w-px h-4 bg-white/10" />
        <StatusItem
          icon={Box}
          label="Nodes"
          value={formatNumber(totalNodes)}
        />
        <div className="w-px h-4 bg-white/10" />
        <StatusItem
          icon={Database}
          label="Size"
          value={formatBytes(totalSize)}
        />
      </div>

      {/* Center Section - Active Disk (if any) */}
      {activeDisk && (
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded text-xs">
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <span className="text-gray-400">{activeDisk.name}</span>
          <span className="text-gray-600">({activeDisk.mountPoint})</span>
        </div>
      )}

      {/* Right Section - Memory and Sync */}
      <div className="flex items-center gap-1">
        <StatusItem
          icon={Activity}
          label="Memory"
          value={formatBytes(memoryUsage)}
          status={memoryUsage > 50 * 1024 * 1024 ? 'warning' : 'default'}
        />
        <div className="w-px h-4 bg-white/10" />
        <StatusItem
          icon={getSyncIcon()}
          label=""
          value={getSyncText()}
          status={getSyncStatus()}
        />
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2 px-3 text-xs">
          <span className="text-gray-600">FXD v1.0.0</span>
          <div className={cn(
            'w-2 h-2 rounded-full',
            syncStatus === 'synced' && 'bg-emerald-400',
            syncStatus === 'syncing' && 'bg-blue-400 animate-pulse',
            syncStatus === 'error' && 'bg-red-400'
          )} />
        </div>
      </div>
    </div>
  );
};
