/** FilesView - Virtual Filesystem Explorer */
import React from 'react';
import { Folder, File, RefreshCw } from 'lucide-react';
import { formatBytes } from '../../../lib/utils';

export const FilesView: React.FC = () => {
  const files = [
    { name: 'auth.ts', type: 'file', size: 4200, modified: '2 mins ago' },
    { name: 'db.ts', type: 'file', size: 8100, modified: '1 hour ago' },
    { name: 'components', type: 'folder', size: 12300, modified: '5 mins ago' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between p-6 border-b border-[#2a2a35]">
        <div>
          <h2 className="text-2xl font-bold text-white">Files</h2>
          <p className="text-sm text-gray-500 mt-1">R:\ (MyProject - Mounted)</p>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <div className="flex-1 p-6">
        <table className="w-full">
          <thead className="text-left text-xs text-gray-500 border-b border-[#2a2a35]">
            <tr>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Size</th>
              <th className="pb-2 font-medium">Modified</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr key={file.name} className="border-b border-[#2a2a35]/50 hover:bg-white/5 cursor-pointer">
                <td className="py-3 flex items-center gap-2">
                  {file.type === 'folder' ?
                    <Folder className="w-4 h-4 text-blue-400" /> :
                    <File className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-white text-sm">{file.name}</span>
                </td>
                <td className="py-3 text-sm text-gray-400">{formatBytes(file.size)}</td>
                <td className="py-3 text-sm text-gray-500">{file.modified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
