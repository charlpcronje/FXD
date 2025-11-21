/** StatsView - Stats & Analytics Dashboard */
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatsView: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Nodes', value: '1,234', change: '+12%', up: true },
          { label: 'Storage', value: '45.2 MB', change: '-5%', up: false },
          { label: 'Syncs', value: '2.3k', change: '+34%', up: true },
        ].map(stat => (
          <div key={stat.label} className="bg-[#16161d] rounded-lg p-6 border border-[#2a2a35]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <span className={`flex items-center gap-1 text-xs ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#16161d] rounded-lg p-6 border border-[#2a2a35]">
        <h3 className="text-white font-semibold mb-4">Activity Graph</h3>
        <div className="h-48 flex items-end justify-around gap-2">
          {[40, 65, 45, 80, 55, 70, 60].map((height, i) => (
            <div key={i} className="flex-1 bg-indigo-500/30 rounded-t" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
};
