/**
 * DisksView Component
 * Main view for managing FXDisks - shows active, saved, and cloud disks
 */

import React, { useState, useCallback } from 'react';
import { Plus, Upload, FolderOpen, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store/appStore';
import { DiskCard } from './DiskCard';

interface DropZoneProps {
  onDrop?: (files: FileList) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onDrop }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop?.(e.dataTransfer.files);
    }
  }, [onDrop]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 transition-all',
        'flex flex-col items-center justify-center gap-4',
        isDragging
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-[#2a2a35] hover:border-[#3a3a45] bg-[#16161d]/50'
      )}
    >
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
        isDragging ? 'bg-indigo-500/20' : 'bg-white/5'
      )}>
        <FolderOpen className={cn(
          'w-8 h-8',
          isDragging ? 'text-indigo-400' : 'text-gray-400'
        )} />
      </div>

      <div className="text-center">
        <p className="text-white font-semibold mb-1">
          {isDragging ? 'Drop folder to create FXDisk' : 'Drop Folder Here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to browse and select a folder
        </p>
      </div>

      <button className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors text-sm font-medium">
        Browse Folders
      </button>
    </div>
  );
};

export const DisksView: React.FC = () => {
  const { disks, mountedDisks, addDisk, mountDisk, unmountDisk, setActiveView, openModal } = useAppStore();

  // Separate disks into categories
  const activeDisk = disks.filter(d => mountedDisks.includes(d.id));
  const savedDisks = disks.filter(d => !mountedDisks.includes(d.id) && d.isLocal);
  const cloudDisks = disks.filter(d => !d.isLocal);

  const handleCreateNew = () => {
    openModal('createDisk');
  };

  const handleImport = () => {
    openModal('mountDisk');
  };

  const handleDrop = (files: FileList) => {
    console.log('Files dropped:', files);
    // In real app, this would process the folder and create a disk
  };

  const handleMount = (disk: any) => {
    const mountPoint = `${String.fromCharCode(82 + mountedDisks.length)}:\\`; // R:\, S:\, T:\ ...
    mountDisk(disk.id, mountPoint);
  };

  const handleUnmount = (disk: any) => {
    unmountDisk(disk.id);
  };

  const handleView = (disk: any) => {
    setActiveView('graph');
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#2a2a35]">
        <div>
          <h2 className="text-2xl font-bold text-white">FXDisks</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your local and cloud FXDisks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Disk
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Drop Zone (when no disks) */}
        {disks.length === 0 && (
          <DropZone onDrop={handleDrop} />
        )}

        {/* Active Disks (Mounted) */}
        {activeDisk.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <h3 className="text-lg font-semibold text-white">Active Disks (Mounted)</h3>
              <span className="text-sm text-gray-500">({activeDisk.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {activeDisk.map((disk) => (
                  <DiskCard
                    key={disk.id}
                    disk={disk}
                    onMount={handleMount}
                    onUnmount={handleUnmount}
                    onView={handleView}
                    onSave={(d) => console.log('Save:', d)}
                    onShare={(d) => console.log('Share:', d)}
                    onSettings={(d) => console.log('Settings:', d)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Saved Disks (Unmounted) */}
        {savedDisks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <h3 className="text-lg font-semibold text-white">Saved Disks (Unmounted)</h3>
              <span className="text-sm text-gray-500">({savedDisks.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {savedDisks.map((disk) => (
                  <DiskCard
                    key={disk.id}
                    disk={disk}
                    onMount={handleMount}
                    onUnmount={handleUnmount}
                    onView={handleView}
                    onSave={(d) => console.log('Save:', d)}
                    onShare={(d) => console.log('Share:', d)}
                    onSettings={(d) => console.log('Settings:', d)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Cloud Disks (fxd.dev) */}
        {cloudDisks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Cloud Disks (fxd.dev)</h3>
              <span className="text-sm text-gray-500">({cloudDisks.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {cloudDisks.map((disk) => (
                  <DiskCard
                    key={disk.id}
                    disk={disk}
                    onMount={handleMount}
                    onUnmount={handleUnmount}
                    onView={handleView}
                    onSave={(d) => console.log('Save:', d)}
                    onShare={(d) => console.log('Share:', d)}
                    onSettings={(d) => console.log('Settings:', d)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
