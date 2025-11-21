/**
 * FXD Quantum App - Main Application Component
 * Complete desktop app with all 8 views
 */

import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { TitleBar } from './components/Layout/TitleBar';
import { Sidebar } from './components/Layout/Sidebar';
import { StatusBar } from './components/Layout/StatusBar';
import { MainWorkspace } from './components/Layout/MainWorkspace';
import { BottomPanel } from './components/Layout/BottomPanel';

// Views
import { DisksView } from './components/Views/DisksView/DisksView';
import { NodesView } from './components/Views/NodesView/NodesView';
import { FilesView } from './components/Views/FilesView/FilesView';
import { GraphView } from './components/Views/GraphView/GraphView';
import { EditorView } from './components/Views/EditorView/EditorView';
import { StatsView } from './components/Views/StatsView/StatsView';
import { LogsView } from './components/Views/LogsView/LogsView';
import { ShareView } from './components/Views/ShareView/ShareView';

import { useAppStore } from './store/appStore';
import { generateId } from './lib/utils';

function AppQuantum() {
  const { activeView, addDisk } = useAppStore();

  // Initialize with mock data
  useEffect(() => {
    // Add some mock disks
    const mockDisks = [
      {
        id: generateId(),
        name: 'MyProject.fxd',
        path: '/projects/myproject.fxd',
        mountPoint: 'R:\\',
        isMounted: true,
        isLocal: true,
        nodeCount: 1234,
        fileCount: 89,
        size: 45200000, // 45.2 MB
        lastModified: new Date(Date.now() - 120000), // 2 mins ago
        autoSync: true,
        syncInterval: 500,
        metadata: {
          description: 'My awesome project',
          tags: ['react', 'typescript'],
        },
      },
      {
        id: generateId(),
        name: 'Website.fxd',
        path: '/projects/website.fxd',
        mountPoint: null,
        isMounted: false,
        isLocal: true,
        nodeCount: 456,
        fileCount: 23,
        size: 12800000, // 12.8 MB
        lastModified: new Date(Date.now() - 172800000), // 2 days ago
        autoSync: false,
        syncInterval: 1000,
      },
    ];

    // Only add if not already added
    mockDisks.forEach(disk => {
      addDisk(disk);
    });
  }, []);

  // Render active view
  const renderView = () => {
    switch (activeView) {
      case 'disks':
        return <DisksView />;
      case 'nodes':
        return <NodesView />;
      case 'files':
        return <FilesView />;
      case 'graph':
        return <GraphView />;
      case 'editor':
        return <EditorView />;
      case 'stats':
        return <StatsView />;
      case 'logs':
        return <LogsView />;
      case 'share':
        return <ShareView />;
      default:
        return <DisksView />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#16161d',
            color: '#fff',
            border: '1px solid #2a2a35',
          },
        }}
      />

      {/* Title Bar */}
      <TitleBar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MainWorkspace>
            {renderView()}
          </MainWorkspace>

          {/* Bottom Panel */}
          <BottomPanel />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

export default AppQuantum;
