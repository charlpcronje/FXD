/**
 * Canvas3D - Main 3D visualization canvas
 * Uses Three.js with React Three Fiber for WebGL rendering
 */

import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { useVisualizerStore, useNodes, useConnections, useSettings } from '@/core/store';
import { NodeRenderer } from '../NodeRenderer/NodeRenderer';
import { ConnectionRenderer } from '../ConnectionRenderer/ConnectionRenderer';

/**
 * Scene content
 */
function SceneContent() {
  const nodes = useNodes();
  const connections = useConnections();
  const settings = useSettings();

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#3498db" />
      <pointLight position={[10, -10, -5]} intensity={0.3} color="#2ecc71" />

      {/* Circuit board base grid */}
      {settings.showGrid && (
        <Grid
          args={[100, 100]}
          cellSize={50}
          cellThickness={0.5}
          cellColor="#d4af37"
          sectionSize={500}
          sectionThickness={1}
          sectionColor="#b87333"
          fadeDistance={5000}
          fadeStrength={1}
          infiniteGrid
        />
      )}

      {/* Render nodes */}
      {Array.from(nodes.values()).map((node) => (
        <NodeRenderer key={node.id} node={node} />
      ))}

      {/* Render connections */}
      {Array.from(connections.values()).map((connection) => {
        const sourceNode = nodes.get(connection.source);
        const targetNode = nodes.get(connection.target);

        if (!sourceNode || !targetNode) return null;

        return (
          <ConnectionRenderer
            key={connection.id}
            connection={connection}
            sourcePosition={sourceNode.position}
            targetPosition={targetNode.position}
          />
        );
      })}
    </>
  );
}

/**
 * Camera controller
 */
function CameraController() {
  const { camera: cameraState } = useVisualizerStore();
  const { camera } = useThree();

  useEffect(() => {
    camera.position.copy(cameraState.position);
    camera.lookAt(cameraState.target);
  }, [camera, cameraState]);

  return null;
}

/**
 * Performance monitor
 */
function PerformanceMonitor() {
  const { updateMetrics } = useVisualizerStore();

  useFrame((state, delta) => {
    const fps = Math.round(1 / delta);
    const renderTime = delta * 1000;

    updateMetrics({
      fps,
      renderTime,
    });
  });

  return null;
}

/**
 * Loading fallback
 */
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3498db" wireframe />
    </mesh>
  );
}

/**
 * Main Canvas3D component
 */
export function Canvas3D() {
  const settings = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="w-full h-full">
      <Canvas
        ref={canvasRef}
        shadows
        camera={{
          position: [0, 500, 1000],
          fov: 60,
          near: 0.1,
          far: 10000,
        }}
        gl={{
          antialias: settings.renderQuality !== 'low',
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={
          settings.renderQuality === 'ultra'
            ? [1, 2]
            : settings.renderQuality === 'high'
            ? [1, 1.5]
            : [1, 1]
        }
      >
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 1000, 5000]} />

        <Suspense fallback={<LoadingFallback />}>
          <SceneContent />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={100}
          maxDistance={5000}
          maxPolarAngle={Math.PI / 1.5}
        />

        <CameraController />
        <PerformanceMonitor />

        {/* Stats overlay */}
        {settings.showStats && <Stats />}
      </Canvas>
    </div>
  );
}
