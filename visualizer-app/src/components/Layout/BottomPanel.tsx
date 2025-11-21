/**
 * BottomPanel Component
 * Bottom panel with Console, Terminal, and AI Assistant tabs
 */

import React from 'react';
import { Terminal, Code2, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore, type BottomPanelTab } from '../../store/appStore';
import { theme } from '../../design-tokens';

interface TabButtonProps {
  icon: React.ElementType;
  label: string;
  tab: BottomPanelTab;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ icon: Icon, label, tab, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
        isActive
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

interface BottomPanelProps {
  className?: string;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ className }) => {
  const { bottomPanelOpen, bottomPanelTab, setBottomPanelTab, toggleBottomPanel } = useAppStore();

  const tabs: Array<{ icon: React.ElementType; label: string; tab: BottomPanelTab }> = [
    { icon: Code2, label: 'Console', tab: 'console' },
    { icon: Terminal, label: 'Terminal', tab: 'terminal' },
    { icon: Sparkles, label: 'AI Assistant', tab: 'ai' },
  ];

  return (
    <AnimatePresence>
      {bottomPanelOpen && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: theme.layout.bottomPanelHeight.expanded }}
          exit={{ height: 0 }}
          className={cn('flex flex-col bg-[#0a0a0f] border-t border-[#2a2a35]', className)}
        >
          {/* Tab Header */}
          <div className="flex items-center justify-between bg-[#16161d] border-b border-[#2a2a35]">
            <div className="flex items-center">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.tab}
                  icon={tab.icon}
                  label={tab.label}
                  tab={tab.tab}
                  isActive={bottomPanelTab === tab.tab}
                  onClick={() => setBottomPanelTab(tab.tab)}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 px-2">
              <button
                onClick={toggleBottomPanel}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Collapse Panel"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={toggleBottomPanel}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Close Panel"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {bottomPanelTab === 'console' && (
                <motion.div
                  key="console"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-4 font-mono text-sm text-gray-300"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-400">&gt;</span>
                    <span className="text-gray-500">FXD Console - Type commands here...</span>
                  </div>
                  <div className="text-gray-600 text-xs">
                    Try: <span className="text-indigo-400">help</span> | <span className="text-indigo-400">status</span> | <span className="text-indigo-400">nodes</span>
                  </div>
                </motion.div>
              )}

              {bottomPanelTab === 'terminal' && (
                <motion.div
                  key="terminal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-4 font-mono text-sm text-gray-300 bg-black"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-400">$</span>
                    <span className="text-gray-500">Terminal ready...</span>
                  </div>
                </motion.div>
              )}

              {bottomPanelTab === 'ai' && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-white font-semibold">FXD AI Assistant</h3>
                  </div>
                  <div className="text-sm text-gray-400">
                    <p className="mb-2">Ask me anything about your FXD project...</p>
                    <div className="flex gap-2 mt-4">
                      <button className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded text-xs hover:bg-indigo-500/30 transition-colors">
                        Find unused nodes
                      </button>
                      <button className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded text-xs hover:bg-indigo-500/30 transition-colors">
                        Optimize connections
                      </button>
                      <button className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded text-xs hover:bg-indigo-500/30 transition-colors">
                        Analyze structure
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
