/** LogsView - Signal Viewer */
import React from 'react';
import { Pause, Trash2, Filter } from 'lucide-react';

export const LogsView: React.FC = () => {
  const signals = [
    { time: '12:34:56.789', type: 'VALUE', message: 'app.user.name: "Alice" → "Bob"' },
    { time: '12:34:52.123', type: 'CHILDREN', message: 'code.helpers: Added format()' },
    { time: '12:34:48.456', type: 'PERSIST', message: 'Saved 234 nodes to MyProject.fxd' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
        <h2 className="text-xl font-bold text-white">Signal Stream</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 transition-colors text-sm text-white">
            <Pause className="w-4 h-4" />
            Pause
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 transition-colors text-sm text-white">
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 transition-colors text-sm text-white">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {signals.map((signal, i) => (
          <div key={i} className="bg-[#16161d] border border-[#2a2a35] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">{signal.time}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                signal.type === 'VALUE' ? 'bg-blue-500/20 text-blue-400' :
                signal.type === 'CHILDREN' ? 'bg-green-500/20 text-green-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>{signal.type}</span>
            </div>
            <p className="text-sm text-white">{signal.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
