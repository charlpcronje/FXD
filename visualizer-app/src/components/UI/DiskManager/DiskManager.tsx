/**
 * DiskManager Component
 * Manages .fxd and .fxwal files
 * - List available files
 * - Load/unload disks
 * - Create new disks
 * - Show disk statistics
 */

import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Database, HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import type { FXDFileInfo } from '../../../adapters/FXDAdapter';

interface DiskManagerProps {
  onLoadDisk: (filePath: string) => Promise<void>;
  onCreateDisk: (name: string) => Promise<void>;
  onUnloadDisk: () => void;
  currentDisk: string | null;
}

interface DiskInfo extends FXDFileInfo {
  isLoaded: boolean;
}

export const DiskManager: React.FC<DiskManagerProps> = ({
  onLoadDisk,
  onCreateDisk,
  onUnloadDisk,
  currentDisk,
}) => {
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDiskName, setNewDiskName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available disks
  useEffect(() => {
    loadAvailableDisks();
  }, []);

  const loadAvailableDisks = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would use FXDAdapter.listFXDFiles()
      // For now, we'll simulate with example files
      const exampleDisks: DiskInfo[] = [
        {
          path: 'examples/demo-final.fxd',
          name: 'demo-final.fxd',
          size: 49152,
          nodeCount: 15,
          lastModified: new Date('2025-11-19'),
          isSynced: true,
          isLoaded: currentDisk === 'examples/demo-final.fxd',
        },
        {
          path: 'examples/comprehensive-demo.fxd',
          name: 'comprehensive-demo.fxd',
          size: 65536,
          nodeCount: 23,
          lastModified: new Date('2025-11-19'),
          isSynced: true,
          isLoaded: currentDisk === 'examples/comprehensive-demo.fxd',
        },
        {
          path: 'examples/code-project.fxd',
          name: 'code-project.fxd',
          size: 32768,
          nodeCount: 8,
          lastModified: new Date('2025-11-19'),
          isSynced: true,
          isLoaded: currentDisk === 'examples/code-project.fxd',
        },
      ];

      setDisks(exampleDisks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disks');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDisk = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      await onLoadDisk(path);
      await loadAvailableDisks(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disk');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDisk = async () => {
    if (!newDiskName.trim()) {
      setError('Please enter a disk name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onCreateDisk(newDiskName);
      setNewDiskName('');
      setShowCreateDialog(false);
      await loadAvailableDisks(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create disk');
    } finally {
      setLoading(false);
    }
  };

  const handleUnloadDisk = () => {
    onUnloadDisk();
    loadAvailableDisks(); // Refresh list
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="disk-manager">
      {/* Header */}
      <div className="disk-manager-header">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Disk Manager</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAvailableDisks}
            disabled={loading}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="btn-primary"
            title="Create New Disk"
          >
            <Plus className="w-4 h-4" />
            New Disk
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Current Disk Info */}
      {currentDisk && (
        <div className="current-disk-info">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-green-500" />
            <div>
              <div className="font-semibold">Current Disk</div>
              <div className="text-sm text-gray-500">{currentDisk}</div>
            </div>
          </div>
          <button onClick={handleUnloadDisk} className="btn-danger-sm">
            Unload
          </button>
        </div>
      )}

      {/* Disk List */}
      <div className="disk-list">
        {loading && disks.length === 0 ? (
          <div className="loading-message">Loading disks...</div>
        ) : disks.length === 0 ? (
          <div className="empty-message">
            <Database className="w-12 h-12 text-gray-400 mb-2" />
            <p>No disks found</p>
            <p className="text-sm text-gray-500">Create a new disk to get started</p>
          </div>
        ) : (
          disks.map((disk) => (
            <div
              key={disk.path}
              className={`disk-item ${disk.isLoaded ? 'loaded' : ''}`}
            >
              <div className="disk-info">
                <div className="flex items-center gap-2">
                  <Database
                    className={`w-5 h-5 ${disk.isLoaded ? 'text-green-500' : 'text-gray-400'}`}
                  />
                  <div>
                    <div className="font-semibold">{disk.name}</div>
                    <div className="text-xs text-gray-500">{disk.path}</div>
                  </div>
                </div>
                <div className="disk-stats">
                  <div className="stat">
                    <span className="label">Nodes:</span>
                    <span className="value">{disk.nodeCount}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Size:</span>
                    <span className="value">{formatFileSize(disk.size)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Modified:</span>
                    <span className="value">{formatDate(disk.lastModified)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Synced:</span>
                    <span className={`value ${disk.isSynced ? 'text-green-500' : 'text-yellow-500'}`}>
                      {disk.isSynced ? '✓' : '⋯'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="disk-actions">
                {disk.isLoaded ? (
                  <button onClick={handleUnloadDisk} className="btn-danger-sm">
                    Unload
                  </button>
                ) : (
                  <button
                    onClick={() => handleLoadDisk(disk.path)}
                    disabled={loading}
                    className="btn-primary-sm"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Load
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Disk Dialog */}
      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Disk</h3>
              <button onClick={() => setShowCreateDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <label htmlFor="disk-name">Disk Name</label>
              <input
                id="disk-name"
                type="text"
                value={newDiskName}
                onChange={(e) => setNewDiskName(e.target.value)}
                placeholder="my-project.fxd"
                className="input-field"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-2">
                The .fxd extension will be added automatically
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateDialog(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleCreateDisk}
                disabled={loading || !newDiskName.trim()}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .disk-manager {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          height: 100%;
          overflow: hidden;
        }

        .disk-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #333;
        }

        .disk-manager-header .flex {
          display: flex;
        }

        .disk-manager-header .items-center {
          align-items: center;
        }

        .disk-manager-header .gap-2 {
          gap: 0.5rem;
        }

        .current-disk-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #1a3a1a;
          border: 1px solid #2ecc71;
          border-radius: 0.375rem;
        }

        .disk-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .disk-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .disk-item:hover {
          border-color: #555;
          background: #252525;
        }

        .disk-item.loaded {
          border-color: #2ecc71;
          background: #1a3a1a;
        }

        .disk-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .disk-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .disk-stats .stat {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .disk-stats .label {
          font-size: 0.625rem;
          color: #888;
          text-transform: uppercase;
        }

        .disk-stats .value {
          font-size: 0.875rem;
          font-weight: 600;
        }

        .disk-actions {
          display: flex;
          gap: 0.5rem;
        }

        .loading-message,
        .empty-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: #888;
        }

        .error-message {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #3c1f1f;
          border: 1px solid #e74c3c;
          border-radius: 0.375rem;
          color: #e74c3c;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 0.5rem;
          min-width: 400px;
          max-width: 90vw;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #333;
        }

        .modal-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .modal-header button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #888;
        }

        .modal-body {
          padding: 1rem;
        }

        .modal-body label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .input-field {
          width: 100%;
          padding: 0.5rem;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 0.25rem;
          color: #fff;
          font-size: 0.875rem;
        }

        .input-field:focus {
          outline: none;
          border-color: #d4af37;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 1rem;
          border-top: 1px solid #333;
        }

        .btn-icon,
        .btn-primary,
        .btn-secondary,
        .btn-danger-sm,
        .btn-primary-sm {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-icon {
          padding: 0.5rem;
          background: #2a2a2a;
          color: #d4af37;
        }

        .btn-icon:hover:not(:disabled) {
          background: #333;
        }

        .btn-primary {
          background: #d4af37;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: #c09b2a;
        }

        .btn-primary-sm {
          padding: 0.375rem 0.75rem;
          background: #d4af37;
          color: #000;
        }

        .btn-primary-sm:hover:not(:disabled) {
          background: #c09b2a;
        }

        .btn-secondary {
          background: #2a2a2a;
          color: #fff;
        }

        .btn-secondary:hover {
          background: #333;
        }

        .btn-danger-sm {
          padding: 0.375rem 0.75rem;
          background: #e74c3c;
          color: #fff;
        }

        .btn-danger-sm:hover {
          background: #c0392b;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .flex {
          display: flex;
        }

        .items-center {
          align-items: center;
        }

        .gap-2 {
          gap: 0.5rem;
        }

        .text-lg {
          font-size: 1.125rem;
        }

        .text-sm {
          font-size: 0.875rem;
        }

        .text-xs {
          font-size: 0.75rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .text-gray-400 {
          color: #9ca3af;
        }

        .text-gray-500 {
          color: #6b7280;
        }

        .text-green-500 {
          color: #2ecc71;
        }

        .text-yellow-500 {
          color: #f39c12;
        }

        .w-4 {
          width: 1rem;
        }

        .h-4 {
          height: 1rem;
        }

        .w-5 {
          width: 1.25rem;
        }

        .h-5 {
          height: 1.25rem;
        }

        .w-12 {
          width: 3rem;
        }

        .h-12 {
          height: 3rem;
        }

        .mb-2 {
          margin-bottom: 0.5rem;
        }

        .mt-2 {
          margin-top: 0.5rem;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
