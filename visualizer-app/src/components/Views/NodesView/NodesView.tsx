/** NodesView - Node Browser with tree view */
import React from 'react';
import { Box, Search, ChevronRight, ChevronDown } from 'lucide-react';

export const NodesView: React.FC = () => {
  return (
    <div className="h-full flex bg-[#0a0a0f]">
      <div className="w-80 border-r border-[#2a2a35] p-4">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search nodes..."
              className="w-full pl-10 pr-4 py-2 bg-[#16161d] border border-[#2a2a35] rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="space-y-1">
          {['app', 'code', 'views', 'data'].map(node => (
            <div key={node} className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded cursor-pointer">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <Box className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-white">{node}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Node Inspector</h3>
        <div className="bg-[#16161d] rounded-lg p-4 border border-[#2a2a35]">
          <p className="text-gray-500 text-sm">Select a node to view details</p>
        </div>
      </div>
    </div>
  );
};
