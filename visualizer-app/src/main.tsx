/**
 * FX Visualizer - Main Entry Point
 * The Matrix Meets Developer Tools
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Hide loading screen after a short delay
setTimeout(() => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => {
      loading.remove();
    }, 500);
  }
}, 1000);

// Log welcome message
console.log(
  '%cFX VISUALIZER',
  'font-size: 32px; font-weight: bold; background: linear-gradient(45deg, #3498db, #2ecc71); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'
);
console.log(
  '%cThe Matrix Meets Developer Tools',
  'font-size: 14px; color: #95a5a6; font-style: italic;'
);
console.log('');
console.log('%cControls:', 'font-weight: bold; color: #3498db;');
console.log('  Mouse Wheel: Zoom');
console.log('  Right Drag: Pan');
console.log('  Middle Drag: Rotate');
console.log('  F: Focus on selected node');
console.log('  A: Fit all nodes');
console.log('  1-9: Camera presets');
console.log('  Space: Play/Pause timeline');
console.log('');
console.log('%cKeyboard Shortcuts:', 'font-weight: bold; color: #2ecc71;');
console.log('  Ctrl+K: Command palette');
console.log('  Ctrl+Shift+I: Toggle inspector');
console.log('  Ctrl+Shift+C: Toggle console');
console.log('  Ctrl+Shift+P: Toggle profiler');
console.log('');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
