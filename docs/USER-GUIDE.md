# FXD Quantum Desktop Visualizer - User Guide

Welcome to the FXD Quantum Desktop Visualizer! This powerful 3D visualization tool helps you explore, understand, and manipulate your FXD quantum development files.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Working with Files](#working-with-files)
4. [Navigation](#navigation)
5. [Node Operations](#node-operations)
6. [Advanced Features](#advanced-features)
7. [Performance Tips](#performance-tips)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

1. Download the installer from the FXD releases page
2. Run `FXD-Quantum-Visualizer-Setup.exe`
3. Follow the installation wizard
4. Choose whether to create desktop shortcut
5. FXD files (.fxd) will automatically be associated with the visualizer

### First Launch

When you first launch the visualizer:

1. You'll see a demo scene with sample nodes
2. The status bar at the bottom shows file info, node count, and performance metrics
3. Use your mouse to rotate, zoom, and pan the camera
4. Press **F1** to see all keyboard shortcuts

### Opening Your First File

- **File → Open** (or press **Ctrl+O**)
- Navigate to your .fxd file
- Double-click or select and click Open
- The visualizer will load and display your node graph

You can also:
- Drag and drop .fxd files into the window
- Double-click .fxd files in Windows Explorer (they'll open automatically)

---

## Interface Overview

### Main View

The main 3D viewport displays your node graph as an interactive 3D scene:

- **Nodes** appear as 3D shapes (spheres, boxes, cones)
- **Connections** are shown as lines between nodes
- **Labels** float above each node showing their name
- **Grid** provides spatial reference

### Status Bar (Bottom)

Shows real-time information:
- **File**: Currently open file name
- **Nodes**: Total number of nodes in the scene
- **Selected**: Number of currently selected nodes
- **FPS**: Frame rate (should be 60 for smooth experience)
- **Zoom**: Current zoom level percentage

### Breadcrumbs (Top Left)

Shows your current location in the node hierarchy:
- Click any breadcrumb to navigate to that level
- Useful for complex nested structures

### Minimap (Bottom Right)

Toggle with **Ctrl+M**:
- Shows bird's-eye view of entire graph
- Blue dots = nodes
- Red box = current camera view
- Click to quickly navigate

### Performance Overlay (Top Right)

Toggle with **Ctrl+Shift+P**:
- FPS (green = good, orange = ok, red = slow)
- Frame Time (target: <16ms for 60fps)
- Draw Calls
- Triangle count
- Memory usage

---

## Working with Files

### Opening Files

**Methods:**
1. **Menu**: File → Open (Ctrl+O)
2. **Drag & Drop**: Drag .fxd file into window
3. **Double-Click**: In Windows Explorer
4. **Recent Files**: File → Recent Files

### Saving Files

- **Save**: File → Save (Ctrl+S)
  - Saves to current file
  - Disabled if no file is open

- **Save As**: File → Save As (Ctrl+Shift+S)
  - Save with new name
  - Choose location

### Exporting

**Export as PNG** (Ctrl+Shift+P):
- Saves current view as high-quality image
- Perfect for documentation and presentations

**Export as SVG** (Ctrl+Shift+G):
- Saves as vector graphics
- Scalable for any size

---

## Navigation

### Mouse Controls

- **Left Click**: Select node
- **Left Click + Drag**: Rotate camera
- **Right Click**: Context menu (on nodes)
- **Middle Click + Drag**: Pan camera
- **Mouse Wheel**: Zoom in/out

### Keyboard Navigation

- **Ctrl + +**: Zoom in
- **Ctrl + -**: Zoom out
- **Ctrl + 0**: Reset zoom
- **F**: Focus on selected node
- **Esc**: Clear selection

### Camera Animation

When you:
- Click a search result
- Use "Focus on Node" in context menu
- Navigate via breadcrumbs

The camera smoothly animates to the target location with a beautiful easing animation.

---

## Node Operations

### Selecting Nodes

- **Click**: Select single node (clears previous selection)
- **Ctrl + Click**: Add to selection
- **Ctrl + A**: Select all nodes
- **Esc**: Clear selection

Selected nodes glow brighter to indicate selection.

### Creating Nodes

Currently nodes are created from .fxd files. Future versions will support:
- Manual node creation
- Importing from various formats
- Node templates

### Editing Nodes

- **Double Click**: Edit node (coming soon)
- **Right Click → Properties**: View/edit details (coming soon)

### Deleting Nodes

- **Delete Key**: Delete selected nodes
- **Right Click → Delete**: From context menu

Note: Deletion is recorded in undo history.

### Copy & Paste

- **Copy** (Ctrl+C): Copy selected nodes
- **Paste** (Ctrl+V): Paste at offset position
- Copied nodes get "_copy" suffix

### Undo & Redo

- **Undo** (Ctrl+Z): Revert last change
- **Redo** (Ctrl+Shift+Z): Reapply undone change
- Up to 50 actions stored

---

## Advanced Features

### Search (Ctrl+F)

1. Press **Ctrl+F** to open search panel
2. Type node name or path
3. Results appear instantly
4. Click result to focus camera on node
5. Press **Esc** to close

Search is:
- **Real-time**: Updates as you type
- **Case-insensitive**: Finds "APP", "app", "App"
- **Partial match**: "user" finds "userData", "userProfile"

### Context Menu (Right Click)

Available actions:
- **Copy Node** (Ctrl+C)
- **Paste Node** (Ctrl+V)
- **Delete Node** (Del)
- **Focus on Node** (F)
- **Expand All Children** (coming soon)

### Tooltips

Hover over any node to see:
- Node ID/path
- Node type
- Additional metadata

Tooltips appear after short delay and follow your cursor.

### Node Types

Nodes are color-coded by type:

- **Green Sphere**: Functions
- **Blue Box**: Classes
- **Orange Cone**: Variables
- **Red Octahedron**: Root/special

---

## Performance Tips

### For Best Performance

1. **Monitor FPS**: Keep eye on status bar
   - 60 FPS = perfect
   - 30-60 FPS = acceptable
   - <30 FPS = may feel sluggish

2. **Large Graphs** (100+ nodes):
   - Close performance overlay when not needed
   - Disable minimap (Ctrl+M)
   - Reduce zoom for better view

3. **Hardware Acceleration**:
   - Ensure GPU drivers are updated
   - Close other 3D applications
   - Use dedicated GPU (not integrated)

### Performance Overlay

Use to diagnose issues:
- **High frame time**: Graph too complex or slow GPU
- **Many draw calls**: Many separate objects
- **High memory**: Large textures or many nodes

### Optimization Settings

Future versions will include:
- Level of detail (LOD)
- Culling options
- Simplified rendering mode

---

## Troubleshooting

### Common Issues

**Problem**: Visualizer won't start
- **Solution**: Check Windows Event Viewer, ensure .NET/VC++ redistributables installed

**Problem**: Black screen
- **Solution**: Update GPU drivers, disable hardware acceleration

**Problem**: Low FPS
- **Solution**: Close other apps, reduce node count, check GPU usage

**Problem**: .fxd files don't open with visualizer
- **Solution**: Right-click .fxd file → Open With → Choose FXD Visualizer → Always use this app

**Problem**: Context menu doesn't appear
- **Solution**: Ensure node is selected first, right-click directly on node

**Problem**: Search not working
- **Solution**: Press Ctrl+F, ensure search panel is visible

### Getting Help

- **Documentation**: See KEYBOARD-SHORTCUTS.md for complete shortcut list
- **GitHub Issues**: Report bugs at github.com/fxd-project/visualizer
- **Community**: Join FXD Discord for support

### Log Files

Located at:
- Windows: `%APPDATA%\fxd-quantum-visualizer\logs\`

Include log files when reporting bugs.

---

## Tips & Tricks

### Power User Features

1. **Quick Focus**: Press **F** to instantly center on selected node

2. **Rapid Selection**: Hold Ctrl and click multiple nodes for batch operations

3. **Precision Zoom**: Use Ctrl+Wheel for fine-grained zoom control

4. **Screenshot Perfect Views**:
   - Hide minimap and performance overlay
   - Adjust lighting with camera position
   - Export as PNG for docs

5. **Keyboard-Only Navigation**:
   - Ctrl+F → type → Enter → Esc
   - Navigates without mouse!

### Workflow Examples

**Exploring New Codebase**:
1. Open .fxd file
2. Use search to find entry points
3. Focus on main nodes
4. Expand to see dependencies

**Documentation**:
1. Position camera for best view
2. Hide UI overlays
3. Export as PNG
4. Add to your docs

**Debugging**:
1. Search for specific node
2. Check connections
3. View metadata in tooltip
4. Copy problematic nodes for analysis

---

## What's Next?

Future features planned:
- Live editing of nodes
- Plugin system
- Custom color schemes
- Collaboration features
- Timeline/history visualization
- Integration with IDEs

---

**Happy visualizing!** 🌌

For keyboard shortcuts, see [KEYBOARD-SHORTCUTS.md](KEYBOARD-SHORTCUTS.md)
