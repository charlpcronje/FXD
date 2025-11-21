/** ShareView - Share & Collaborate */
import React from 'react';
import { Upload, Star, Download, Users } from 'lucide-react';

export const ShareView: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Share & Collaborate</h2>

      <div className="bg-[#16161d] rounded-lg p-6 border border-[#2a2a35] mb-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-400" />
          Publish Disk
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="my-ui-components"
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
          />
          <div className="flex gap-2">
            {['Public', 'Private', 'Team'].map(opt => (
              <button key={opt} className="px-4 py-2 bg-white/10 rounded hover:bg-white/20 transition-colors text-sm text-white">
                {opt}
              </button>
            ))}
          </div>
          <button className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium">
            Publish to fxd.dev
          </button>
        </div>
      </div>

      <div className="bg-[#16161d] rounded-lg p-6 border border-[#2a2a35]">
        <h3 className="text-white font-semibold mb-4">Trending</h3>
        <div className="space-y-3">
          {['auth-helpers', 'state-management', 'data-hooks'].map((name, i) => (
            <div key={name} className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm">@user/{name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Star className="w-3 h-3" /> {(1200 - i * 300)}
                </span>
                <button className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 transition-colors text-sm">
                  Clone
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
