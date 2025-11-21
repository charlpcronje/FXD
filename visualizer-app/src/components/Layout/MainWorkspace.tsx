/**
 * MainWorkspace Component
 * Main content area that displays different views based on active navigation
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/appStore';
import { theme } from '../../design-tokens';

interface MainWorkspaceProps {
  className?: string;
  children: React.ReactNode;
}

export const MainWorkspace: React.FC<MainWorkspaceProps> = ({ className, children }) => {
  return (
    <div className={cn('flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key="workspace"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
