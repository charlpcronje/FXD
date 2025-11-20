const { ipcRenderer } = require('electron');
import * as THREE from 'https://cdn.skypack.dev/three@0.150.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.150.0/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.150.0/examples/jsm/renderers/CSS2DRenderer';

// Application state
const state = {
    currentFile: null,
    nodes: new Map(),
    selectedNodes: new Set(),
    clipboard: null,
    undoStack: [],
    redoStack: [],
    searchQuery: '',
    zoomLevel: 1,
    performanceMode: false
};

// Three.js objects
let scene, camera, renderer, labelRenderer, controls;
let raycaster, mouse;

// Performance tracking
const perf = {
    fps: 0,
    frameTime: 0,
    lastTime: performance.now(),
    frames: 0
};

// Initialize the visualizer
async function init() {
    updateLoadingProgress(10, 'Setting up scene...');

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 100, 1000);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(0, 100, 200);

    updateLoadingProgress(30, 'Initializing renderer...');

    // Create WebGL renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('visualizer').appendChild(renderer.domElement);

    // Create CSS2D renderer for labels
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('visualizer').appendChild(labelRenderer.domElement);

    updateLoadingProgress(50, 'Setting up controls...');

    // Create orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    // Raycaster for mouse picking
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    updateLoadingProgress(70, 'Adding lights...');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x64c8ff, 0.5, 300);
    pointLight1.position.set(-100, 50, -100);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff6b6b, 0.5, 300);
    pointLight2.position.set(100, 50, 100);
    scene.add(pointLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x222222);
    scene.add(gridHelper);

    updateLoadingProgress(90, 'Setting up event listeners...');

    // Setup event listeners
    setupEventListeners();

    // Setup IPC listeners
    setupIPCListeners();

    updateLoadingProgress(100, 'Ready!');

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 500);
    }, 500);

    // Start animation loop
    animate();

    // Create demo nodes
    createDemoScene();
}

function updateLoadingProgress(percent, text) {
    const progressBar = document.querySelector('.loading-progress-bar');
    const loadingText = document.querySelector('.loading-text');
    progressBar.style.width = percent + '%';
    loadingText.textContent = text;
}

function createDemoScene() {
    // Create a simple demo graph
    const rootNode = createNode('app', 'root', new THREE.Vector3(0, 0, 0));
    const coreNode = createNode('app.core', 'class', new THREE.Vector3(0, 30, 0));
    const uiNode = createNode('app.ui', 'class', new THREE.Vector3(-60, 20, -50));
    const dataNode = createNode('app.data', 'class', new THREE.Vector3(60, 20, -50));
    const apiNode = createNode('app.api', 'function', new THREE.Vector3(0, 20, 60));

    createConnection(rootNode, coreNode);
    createConnection(coreNode, uiNode);
    createConnection(coreNode, dataNode);
    createConnection(coreNode, apiNode);

    updateStatusBar();
}

function createNode(path, type, position) {
    const geometry = getGeometryForType(type);
    const material = new THREE.MeshPhongMaterial({
        color: getColorForType(type),
        emissive: getColorForType(type),
        emissiveIntensity: 0.2,
        shininess: 30
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        nodeId: path,
        nodeType: type,
        selected: false
    };

    // Add label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'node-label';
    labelDiv.textContent = path.split('.').pop();
    labelDiv.style.color = '#fff';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.padding = '4px 8px';
    labelDiv.style.background = 'rgba(0,0,0,0.8)';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.pointerEvents = 'all';

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, 15, 0);
    mesh.add(label);

    scene.add(mesh);
    state.nodes.set(path, mesh);

    // Animate entrance
    mesh.scale.set(0, 0, 0);
    animateScale(mesh, 1, 500);

    return mesh;
}

function getGeometryForType(type) {
    switch (type) {
        case 'function':
            return new THREE.SphereGeometry(8, 32, 16);
        case 'class':
            return new THREE.BoxGeometry(12, 12, 12);
        case 'variable':
            return new THREE.ConeGeometry(8, 12, 8);
        case 'root':
            return new THREE.OctahedronGeometry(10);
        default:
            return new THREE.DodecahedronGeometry(8);
    }
}

function getColorForType(type) {
    switch (type) {
        case 'function': return 0x00ff88;
        case 'class': return 0x0088ff;
        case 'variable': return 0xff8800;
        case 'root': return 0xff6b6b;
        default: return 0x888888;
    }
}

function createConnection(fromNode, toNode) {
    const points = [];
    points.push(fromNode.position);
    points.push(toNode.position);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0x4488ff,
        opacity: 0.5,
        transparent: true
    });

    const line = new THREE.Line(geometry, material);
    line.userData.isConnection = true;
    scene.add(line);

    return line;
}

function animateScale(mesh, targetScale, duration) {
    const startScale = mesh.scale.x;
    const startTime = performance.now();

    function update() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutElastic(progress);

        mesh.scale.setScalar(startScale + (targetScale - startScale) * eased);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    update();
}

function easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Update performance stats
    updatePerformanceStats();

    // Render
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    // Update minimap
    updateMinimap();
}

function updatePerformanceStats() {
    const now = performance.now();
    perf.frames++;

    if (now - perf.lastTime >= 1000) {
        perf.fps = perf.frames;
        perf.frames = 0;
        perf.lastTime = now;

        // Update UI
        document.getElementById('status-fps').textContent = perf.fps;
        document.getElementById('perf-fps').textContent = perf.fps;

        // Set color based on FPS
        const fpsElement = document.getElementById('perf-fps');
        if (perf.fps >= 55) {
            fpsElement.className = 'perf-value good';
        } else if (perf.fps >= 30) {
            fpsElement.className = 'perf-value warning';
        } else {
            fpsElement.className = 'perf-value bad';
        }
    }

    perf.frameTime = now - (perf.lastFrameTime || now);
    perf.lastFrameTime = now;

    document.getElementById('perf-frame-time').textContent = perf.frameTime.toFixed(1) + 'ms';
    document.getElementById('perf-draw-calls').textContent = renderer.info.render.calls;
    document.getElementById('perf-triangles').textContent = renderer.info.render.triangles;

    // Memory (approximation)
    if (performance.memory) {
        const memMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
        document.getElementById('perf-memory').textContent = memMB + ' MB';
    }
}

function updateMinimap() {
    const minimapCanvas = document.getElementById('minimap-canvas');
    if (!minimapCanvas || document.getElementById('minimap').classList.contains('hidden')) {
        return;
    }

    const ctx = minimapCanvas.getContext('2d');
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Draw simplified node positions
    state.nodes.forEach(node => {
        const x = (node.position.x + 250) / 500 * minimapCanvas.width;
        const z = (node.position.z + 250) / 500 * minimapCanvas.height;

        ctx.fillStyle = node.userData.selected ? '#64c8ff' : '#444';
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw camera frustum
    const camX = (camera.position.x + 250) / 500 * minimapCanvas.width;
    const camZ = (camera.position.z + 250) / 500 * minimapCanvas.height;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(camX - 10, camZ - 10, 20, 20);
}

function setupEventListeners() {
    // Mouse events
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onMouseWheel);

    // Keyboard events
    window.addEventListener('keydown', onKeyDown);

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Search input
    document.getElementById('search-input').addEventListener('input', onSearchInput);

    // Context menu items
    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', onContextMenuAction);
    });
}

function onMouseClick(event) {
    updateMousePosition(event);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    let clickedNode = null;
    for (const intersect of intersects) {
        if (intersect.object.userData.nodeId) {
            clickedNode = intersect.object;
            break;
        }
    }

    if (clickedNode) {
        selectNode(clickedNode, event.ctrlKey);
    } else if (!event.ctrlKey) {
        clearSelection();
    }

    hideContextMenu();
}

function onContextMenu(event) {
    event.preventDefault();

    updateMousePosition(event);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    let clickedNode = null;
    for (const intersect of intersects) {
        if (intersect.object.userData.nodeId) {
            clickedNode = intersect.object;
            break;
        }
    }

    if (clickedNode && !clickedNode.userData.selected) {
        selectNode(clickedNode, false);
    }

    if (state.selectedNodes.size > 0) {
        showContextMenu(event.clientX, event.clientY);
    }
}

function onMouseMove(event) {
    updateMousePosition(event);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    let hoveredNode = null;
    for (const intersect of intersects) {
        if (intersect.object.userData.nodeId) {
            hoveredNode = intersect.object;
            break;
        }
    }

    if (hoveredNode) {
        showTooltip(event.clientX, event.clientY, hoveredNode);
        renderer.domElement.style.cursor = 'pointer';
    } else {
        hideTooltip();
        renderer.domElement.style.cursor = 'default';
    }
}

function onMouseWheel(event) {
    updateStatusBar();
}

function updateMousePosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onKeyDown(event) {
    // Ctrl+F - Find
    if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        toggleSearch();
    }
    // Ctrl+Z - Undo
    else if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
    }
    // Ctrl+Shift+Z - Redo
    else if (event.ctrlKey && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
    }
    // Ctrl+C - Copy
    else if (event.ctrlKey && event.key === 'c') {
        event.preventDefault();
        copySelection();
    }
    // Ctrl+V - Paste
    else if (event.ctrlKey && event.key === 'v') {
        event.preventDefault();
        paste();
    }
    // Delete - Delete node
    else if (event.key === 'Delete') {
        deleteSelection();
    }
    // Escape - Clear selection / close modals
    else if (event.key === 'Escape') {
        clearSelection();
        hideSearch();
        hideShortcuts();
        hideContextMenu();
    }
    // F1 - Show shortcuts
    else if (event.key === 'F1') {
        event.preventDefault();
        showShortcuts();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// Selection
function selectNode(node, addToSelection) {
    if (!addToSelection) {
        clearSelection();
    }

    node.userData.selected = true;
    node.material.emissiveIntensity = 0.5;
    state.selectedNodes.add(node);

    updateStatusBar();
}

function clearSelection() {
    state.selectedNodes.forEach(node => {
        node.userData.selected = false;
        node.material.emissiveIntensity = 0.2;
    });
    state.selectedNodes.clear();

    updateStatusBar();
}

// Undo/Redo
function saveState() {
    const currentState = {
        nodes: Array.from(state.nodes.entries()).map(([id, node]) => ({
            id,
            position: node.position.clone(),
            type: node.userData.nodeType
        }))
    };

    state.undoStack.push(currentState);
    state.redoStack = [];

    // Limit undo stack
    if (state.undoStack.length > 50) {
        state.undoStack.shift();
    }
}

function undo() {
    if (state.undoStack.length === 0) return;

    const currentState = captureCurrentState();
    state.redoStack.push(currentState);

    const previousState = state.undoStack.pop();
    restoreState(previousState);

    console.log('Undo performed');
}

function redo() {
    if (state.redoStack.length === 0) return;

    const currentState = captureCurrentState();
    state.undoStack.push(currentState);

    const nextState = state.redoStack.pop();
    restoreState(nextState);

    console.log('Redo performed');
}

function captureCurrentState() {
    return {
        nodes: Array.from(state.nodes.entries()).map(([id, node]) => ({
            id,
            position: node.position.clone(),
            type: node.userData.nodeType
        }))
    };
}

function restoreState(savedState) {
    // Simple implementation - just restore positions
    savedState.nodes.forEach(nodeData => {
        const node = state.nodes.get(nodeData.id);
        if (node) {
            node.position.copy(nodeData.position);
        }
    });
}

// Copy/Paste
function copySelection() {
    if (state.selectedNodes.size === 0) return;

    state.clipboard = Array.from(state.selectedNodes).map(node => ({
        id: node.userData.nodeId,
        type: node.userData.nodeType,
        position: node.position.clone()
    }));

    console.log('Copied', state.clipboard.length, 'nodes');
}

function paste() {
    if (!state.clipboard) return;

    saveState();

    clearSelection();

    state.clipboard.forEach(nodeData => {
        const newPos = nodeData.position.clone().add(new THREE.Vector3(20, 0, 20));
        const newId = nodeData.id + '_copy';
        const newNode = createNode(newId, nodeData.type, newPos);
        selectNode(newNode, true);
    });

    console.log('Pasted', state.clipboard.length, 'nodes');
}

function deleteSelection() {
    if (state.selectedNodes.size === 0) return;

    saveState();

    state.selectedNodes.forEach(node => {
        scene.remove(node);
        state.nodes.delete(node.userData.nodeId);
    });

    state.selectedNodes.clear();
    updateStatusBar();

    console.log('Deleted nodes');
}

// Search
function toggleSearch() {
    const searchPanel = document.getElementById('search-panel');
    if (searchPanel.classList.contains('visible')) {
        hideSearch();
    } else {
        showSearch();
    }
}

function showSearch() {
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('search-input');

    searchPanel.classList.add('visible');
    searchInput.focus();
}

function hideSearch() {
    const searchPanel = document.getElementById('search-panel');
    searchPanel.classList.remove('visible');
}

function onSearchInput(event) {
    const query = event.target.value.toLowerCase();
    const resultsDiv = document.getElementById('search-results');

    if (!query) {
        resultsDiv.innerHTML = '';
        return;
    }

    const matches = [];
    state.nodes.forEach((node, id) => {
        if (id.toLowerCase().includes(query)) {
            matches.push({ id, node });
        }
    });

    resultsDiv.innerHTML = matches.map(match => `
        <div class="search-result-item" onclick="focusOnNode('${match.id}')">
            ${match.id} <span style="color: #888">(${match.node.userData.nodeType})</span>
        </div>
    `).join('');
}

window.focusOnNode = function(nodeId) {
    const node = state.nodes.get(nodeId);
    if (!node) return;

    clearSelection();
    selectNode(node, false);

    // Animate camera to node
    animateCamera(node.position);

    hideSearch();
};

function animateCamera(targetPosition) {
    const startPosition = camera.position.clone();
    const endPosition = targetPosition.clone().add(new THREE.Vector3(50, 50, 50));
    const startTime = performance.now();
    const duration = 1000;

    function update() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);

        camera.position.lerpVectors(startPosition, endPosition, eased);
        controls.target.copy(targetPosition);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    update();
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Context menu
function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('visible');
}

function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    menu.classList.remove('visible');
}

function onContextMenuAction(event) {
    const action = event.currentTarget.getAttribute('data-action');

    switch (action) {
        case 'copy':
            copySelection();
            break;
        case 'paste':
            paste();
            break;
        case 'delete':
            deleteSelection();
            break;
        case 'focus':
            if (state.selectedNodes.size > 0) {
                const node = Array.from(state.selectedNodes)[0];
                animateCamera(node.position);
            }
            break;
    }

    hideContextMenu();
}

// Tooltip
function showTooltip(x, y, node) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = `
        <strong>${node.userData.nodeId}</strong><br>
        Type: ${node.userData.nodeType}
    `;
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y + 10) + 'px';
    tooltip.classList.add('visible');
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');
}

// Shortcuts modal
window.showShortcuts = function() {
    const modal = document.getElementById('shortcuts-modal');
    modal.classList.add('visible');
};

window.hideShortcuts = function() {
    const modal = document.getElementById('shortcuts-modal');
    modal.classList.remove('visible');
};

// Status bar
function updateStatusBar() {
    document.getElementById('status-file').textContent = state.currentFile || 'No file loaded';
    document.getElementById('status-nodes').textContent = state.nodes.size;
    document.getElementById('status-selected').textContent = state.selectedNodes.size;

    const zoom = Math.round(camera.position.distanceTo(controls.target) / 2);
    document.getElementById('status-zoom').textContent = (100 / zoom * 100).toFixed(0) + '%';
}

// IPC Listeners
function setupIPCListeners() {
    ipcRenderer.on('file-opened', (event, data) => {
        loadFile(data.path, data.data);
    });

    ipcRenderer.on('menu-save', () => {
        if (state.currentFile) {
            saveFile(state.currentFile);
        }
    });

    ipcRenderer.on('save-file-as', (event, filePath) => {
        saveFile(filePath);
    });

    ipcRenderer.on('menu-undo', undo);
    ipcRenderer.on('menu-redo', redo);
    ipcRenderer.on('menu-copy', copySelection);
    ipcRenderer.on('menu-paste', paste);
    ipcRenderer.on('menu-find', toggleSearch);
    ipcRenderer.on('menu-zoom-in', () => zoomCamera(0.9));
    ipcRenderer.on('menu-zoom-out', () => zoomCamera(1.1));
    ipcRenderer.on('menu-zoom-reset', () => resetCamera());
    ipcRenderer.on('menu-toggle-minimap', toggleMinimap);
    ipcRenderer.on('menu-toggle-performance', togglePerformance);
    ipcRenderer.on('menu-show-shortcuts', showShortcuts);
    ipcRenderer.on('menu-export-png', () => exportImage('png'));
    ipcRenderer.on('menu-export-svg', () => exportImage('svg'));
}

function loadFile(filePath, data) {
    try {
        // Parse FXD file (SQLite binary format)
        // For now, just update state
        state.currentFile = filePath;
        console.log('Loaded file:', filePath);
        updateStatusBar();
    } catch (error) {
        console.error('Error loading file:', error);
    }
}

async function saveFile(filePath) {
    try {
        // Serialize current state to FXD format
        const data = new Uint8Array(); // Placeholder

        const result = await ipcRenderer.invoke('save-file', {
            path: filePath,
            content: data
        });

        if (result.success) {
            state.currentFile = filePath;
            console.log('Saved file:', filePath);
            updateStatusBar();
        }
    } catch (error) {
        console.error('Error saving file:', error);
    }
}

function zoomCamera(factor) {
    const distance = camera.position.distanceTo(controls.target);
    const newDistance = distance * factor;

    camera.position.sub(controls.target).normalize().multiplyScalar(newDistance).add(controls.target);
    updateStatusBar();
}

function resetCamera() {
    animateCamera(new THREE.Vector3(0, 0, 0));
}

function toggleMinimap() {
    const minimap = document.getElementById('minimap');
    minimap.classList.toggle('hidden');
}

function togglePerformance() {
    const overlay = document.getElementById('performance-overlay');
    overlay.classList.toggle('hidden');
}

async function exportImage(type) {
    try {
        renderer.render(scene, camera);
        const imageData = renderer.domElement.toDataURL(`image/${type}`);

        const result = await ipcRenderer.invoke('export-image', {
            type,
            imageData
        });

        if (result.success) {
            console.log('Exported image:', result.path);
        }
    } catch (error) {
        console.error('Error exporting image:', error);
    }
}

// Initialize when DOM is ready
init();
