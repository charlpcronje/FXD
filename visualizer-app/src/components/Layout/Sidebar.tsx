/**
 * Sidebar Component
 * Main navigation sidebar with collapsible menu
 */

import React from 'react';
import {
  HardDrive,
  Box,
  FolderOpen,
  Network,
  Code2,
  BarChart3,
  ScrollText,
  Share2,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore, type ViewType } from '../../store/appStore';
import { theme } from '../../design-tokens';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: ViewType;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  view,
  isActive,
  isCollapsed,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
        'hover:bg-white/10 active:scale-95',
        isActive && 'bg-indigo-500/20 text-indigo-400',
        !isActive && 'text-gray-400 hover:text-white',
        isCollapsed && 'justify-center px-2'
      )}
      title={isCollapsed ? label : undefined}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-indigo-400')} />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { activeView, sidebarCollapsed, setActiveView, toggleSidebar } = useAppStore();

  const navItems = [
    { icon: HardDrive, label: 'Disks', view: 'disks' as ViewType },
    { icon: Box, label: 'Nodes', view: 'nodes' as ViewType },
    { icon: FolderOpen, label: 'Files', view: 'files' as ViewType },
    { icon: Network, label: 'Graph', view: 'graph' as ViewType },
    { icon: Code2, label: 'Editor', view: 'editor' as ViewType },
    { icon: BarChart3, label: 'Stats', view: 'stats' as ViewType },
    { icon: ScrollText, label: 'Logs', view: 'logs' as ViewType },
    { icon: Share2, label: 'Share', view: 'share' as ViewType },
  ];

  return (
    <motion.div
      animate={{
        width: sidebarCollapsed
          ? theme.layout.sidebarWidth.collapsed
          : theme.layout.sidebarWidth.expanded,
      }}
      className={cn(
        'flex flex-col bg-[#0a0a0f] border-r border-[#2a2a35] relative',
        className
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-4 z-10',
          'w-6 h-6 rounded-full bg-[#16161d] border border-[#2a2a35]',
          'flex items-center justify-center',
          'hover:bg-[#1f1f2e] hover:border-indigo-500/50',
          'transition-all duration-200 active:scale-90'
        )}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            view={item.view}
            isActive={activeView === item.view}
            isCollapsed={sidebarCollapsed}
            onClick={() => setActiveView(item.view)}
          />
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 space-y-1 border-t border-[#2a2a35]">
        <button
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
            'text-gray-400 hover:bg-white/10 hover:text-white active:scale-95',
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
            'text-gray-400 hover:bg-white/10 hover:text-white active:scale-95',
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? 'Help' : undefined}
        >
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                Help
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
};
