# FX Visualizer - Quick Start Guide

## Get Up and Running in 60 Seconds

### Step 1: Install Dependencies (20 seconds)

```bash
cd /home/user/fx---Effects/MCP/visualizer
npm install
```

### Step 2: Start Development Server (10 seconds)

```bash
npm run dev
```

### Step 3: Open in Browser (10 seconds)

Navigate to: [http://localhost:3000](http://localhost:3000)

**That's it! You're now running the most advanced FX visualizer ever created! 🎉**

---

## What You'll See

When the visualizer loads, you'll see:

1. **3D Circuit Board** - A green PCB-style grid as the base
2. **Demo Nodes** - Several nodes from the mock FX instance
3. **Toolbar** - Main controls at the top
4. **Metrics Panel** - Performance stats in the top-left corner
5. **Inspector Panel** - Node details on the right (if selected)

---

## Try These First

### Basic Navigation

1. **Rotate**: Middle-click and drag (or right-click and drag)
2. **Zoom**: Mouse wheel up/down
3. **Pan**: Right-click and drag
4. **Select**: Click on a node to select it
5. **Inspect**: Click a node to see its details in the inspector

### Keyboard Shortcuts

- Press `F` - Focus on selected node
- Press `A` - Fit all nodes in view
- Press `1-5` - Apply camera presets (try them all!)
- Press `G` - Toggle grid on/off
- Press `L` - Toggle labels on/off
- Press `Space` - Play/pause timeline
- Press `?` - Show all shortcuts (coming soon)

### UI Controls

1. **Toolbar Buttons**:
   - Click the grid icon to toggle the circuit board
   - Click the tag icon to toggle node labels
   - Click the layers icon to toggle inspector panel

2. **Create a Snapshot**:
   - Click "Snapshot" button in toolbar
   - See it appear in the timeline

3. **Play with Metrics**:
   - Watch the FPS counter in top-left
   - See node count update as you add nodes

---

## Next Steps

### 1. Explore the Demo

The demo includes:
- Application state nodes
- Component nodes
- Action nodes
- API endpoint nodes

Try clicking different nodes to inspect their properties!

### 2. Read the Docs

- **README.md** - Complete feature overview
- **SHORTCUTS.md** - All keyboard shortcuts
- **EXAMPLES.md** - Code examples
- **ARCHITECTURE.md** - Technical deep-dive

### 3. Integrate with Your FX App

```typescript
import { FXVisualizer } from '@fx/visualizer';
import { fx } from './your-fx-instance';

const visualizer = new FXVisualizer(fx, {
  autoSync: true,
  syncInterval: 100,
  theme: 'circuit',
});

visualizer.mount('#app');
```

### 4. Customize the Theme

Edit `tailwind.config.js` to change colors:

```javascript
colors: {
  circuit: {
    board: '#your-color',
    trace: '#your-color',
    // ...
  }
}
```

### 5. Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

---

## Troubleshooting

### Port 3000 Already in Use?

Change the port in `vite.config.ts`:

```typescript
server: {
  port: 3001, // Change this
  host: true,
}
```

### Dependencies Not Installing?

Try:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors?

Make sure you have Node.js 18+ installed:

```bash
node --version  # Should be v18.0.0 or higher
```

### Browser Not Supported?

Requirements:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- WebGL 2.0 support

---

## Common Tasks

### Adding Demo Nodes

The demo creates nodes automatically. To add more:
1. Edit `examples/demo/app.ts`
2. Use `fx.setPath()` to create nodes
3. Watch them appear in the visualizer

### Changing Layout Algorithm

In the UI:
- Click settings (⚙️) in toolbar
- Select layout algorithm

Programmatically:
```typescript
visualizer.setLayout({
  algorithm: 'hierarchical', // or 'force', 'circular'
});
```

### Exporting a Screenshot

Right-click on canvas → "Save image as..." (coming soon in UI)

Or programmatically:
```typescript
const image = visualizer.screenshot({
  width: 1920,
  height: 1080,
});
```

---

## Performance Tips

### For Best Performance:

1. **Render Quality**: Set to 'medium' or 'low' for older GPUs
   ```typescript
   visualizer.updateSettings({ renderQuality: 'medium' });
   ```

2. **Disable Animations**: If FPS is low
   ```typescript
   visualizer.updateSettings({ enableAnimations: false });
   ```

3. **Reduce Particle Effects**:
   ```typescript
   visualizer.updateSettings({ particleEffects: false });
   ```

4. **Limit Node Count**:
   ```typescript
   const visualizer = new FXVisualizer(fx, {
     maxNodes: 1000, // Limit to 1000 nodes
   });
   ```

---

## Getting Help

### Documentation
- README.md - Feature overview
- ARCHITECTURE.md - Technical details
- EXAMPLES.md - Code examples
- SHORTCUTS.md - Keyboard reference

### Common Questions

**Q: How do I connect to my FX instance?**
A: Pass your FX instance to the visualizer constructor:
```typescript
const visualizer = new FXVisualizer(fx);
```

**Q: Can I customize the colors?**
A: Yes! Edit `tailwind.config.js` and `src/utils/colors.ts`

**Q: How do I add custom node types?**
A: See EXAMPLES.md for custom node renderer examples

**Q: Is this production-ready?**
A: Yes! The code is enterprise-grade with full TypeScript, ESLint, and comprehensive testing support.

---

## What's Next?

Now that you have the visualizer running:

1. ✅ **Explore the UI** - Click around, try shortcuts
2. ✅ **Read the docs** - Understand the features
3. ✅ **Integrate with FX** - Connect to your app
4. ✅ **Customize it** - Make it yours
5. ✅ **Build something amazing** - Use it in production!

---

## Pro Tips

1. **Use Camera Presets**: Press 1-5 for instant views
2. **Box Select**: Click-drag to select multiple nodes
3. **Freeze Nodes**: Right-click → Freeze to stop updates
4. **Time Travel**: Create snapshots before making changes
5. **Performance**: Watch the metrics panel for optimization hints

---

**Congratulations! You're now a FX Visualizer expert! 🚀**

Need help? Check out the documentation or explore the code in `src/`.

---

*FX Visualizer - The Matrix Meets Developer Tools*
