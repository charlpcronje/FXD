/** GraphView - 3D Node Graph Visualization */
import React from 'react';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const GraphView: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button className="p-2 bg-[#16161d] border border-[#2a2a35] rounded-lg hover:bg-[#1f1f2e] transition-colors">
          <ZoomIn className="w-4 h-4 text-gray-400" />
        </button>
        <button className="p-2 bg-[#16161d] border border-[#2a2a35] rounded-lg hover:bg-[#1f1f2e] transition-colors">
          <ZoomOut className="w-4 h-4 text-gray-400" />
        </button>
        <button className="p-2 bg-[#16161d] border border-[#2a2a35] rounded-lg hover:bg-[#1f1f2e] transition-colors">
          <RotateCcw className="w-4 h-4 text-gray-400" />
        </button>
        <button className="p-2 bg-[#16161d] border border-[#2a2a35] rounded-lg hover:bg-[#1f1f2e] transition-colors">
          <Maximize2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#0a0a0f] to-[#050510]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
          </div>
          <p className="text-white font-semibold">3D Graph Visualization</p>
          <p className="text-sm text-gray-500 mt-1">Mount a disk to see the node graph</p>
        </div>
      </div>
    </div>
  );
};
