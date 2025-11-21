/** EditorView - Code Editor with Monaco */
import React from 'react';
import { Code2, Save, Play } from 'lucide-react';

export const EditorView: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#16161d] border-b border-[#2a2a35]">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-[#0a0a0f] rounded text-sm text-white">auth.ts</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 transition-colors text-sm">
            <Save className="w-4 h-4" />
            Save
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors text-sm">
            <Play className="w-4 h-4" />
            Run
          </button>
        </div>
      </div>
      <div className="flex-1 p-4 font-mono text-sm text-gray-300 bg-[#1e1e1e]">
        <pre className="text-gray-400">
{`// Monaco Editor placeholder
export async function login(username, password) {
  const hashed = hash(password);
  const user = await db.users.findOne({
    username,
    passwordHash: hashed
  });

  if (!user) throw new Error('Invalid');
  return { token: generateToken(user) };
}`}
        </pre>
      </div>
    </div>
  );
};
