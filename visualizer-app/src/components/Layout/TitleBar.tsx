/**
 * TitleBar Component
 * Main application title bar with logo, title, and window controls
 */

import React from 'react';
import { Bell, User, Settings, Minimize2, Maximize2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { theme } from '../../design-tokens';

interface TitleBarProps {
  className?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const handleMinimize = () => {
    if ((window as any).electron) {
      (window as any).electron.ipcRenderer.send('window-minimize');
    }
  };

  const handleMaximize = () => {
    if ((window as any).electron) {
      (window as any).electron.ipcRenderer.send('window-maximize');
    }
  };

  const handleClose = () => {
    if ((window as any).electron) {
      (window as any).electron.ipcRenderer.send('window-close');
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 select-none',
        'bg-[#0a0a0f] border-b border-[#2a2a35]',
        className
      )}
      style={{ height: theme.layout.titleBarHeight }}
    >
      {/* Left: Logo and Title */}
      <div className="flex items-center gap-3">
        {/* Quantum Particles Logo Animation */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/30 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border border-indigo-400/20 rounded-full animate-ping" />
          </div>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            FXD <span className="text-indigo-400">QUANTUM</span>
          </h1>
        </div>
      </div>

      {/* Right: User Menu and Window Controls */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors',
            'hover:bg-white/10 active:scale-95'
          )}
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-400" />
        </button>

        {/* User */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors',
            'hover:bg-white/10 active:scale-95'
          )}
          title="User Profile"
        >
          <User className="w-5 h-5 text-gray-400" />
        </button>

        {/* Settings */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors',
            'hover:bg-white/10 active:scale-95'
          )}
          title="Settings"
        >
          <Settings className="w-5 h-5 text-gray-400" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-white/10 active:scale-95'
            )}
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={handleMaximize}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-white/10 active:scale-95'
            )}
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={handleClose}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-red-500/20 hover:text-red-400 active:scale-95'
            )}
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
