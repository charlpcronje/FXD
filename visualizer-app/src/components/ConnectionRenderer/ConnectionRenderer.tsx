/**
 * ConnectionRenderer - Renders connections between nodes
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualizerConnection } from '@/types';
import { useSettings } from '@/core/store';
import { hexToThreeColor } from '@/utils/colors';

interface ConnectionRendererProps {
  connection: VisualizerConnection;
  sourcePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

export function ConnectionRenderer({
  connection,
  sourcePosition,
  targetPosition,
}: ConnectionRendererProps) {
  const lineRef = useRef<THREE.Line>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const settings = useSettings();

  // Create curve for connection
  const curve = useMemo(() => {
    const start = sourcePosition.clone();
    const end = targetPosition.clone();
    const mid = start.clone().lerp(end, 0.5);
    mid.y += Math.abs(start.y - end.y) * 0.3; // Add arc

    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [sourcePosition, targetPosition]);

  // Create line geometry
  const lineGeometry = useMemo(() => {
    const points = curve.getPoints(50);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve]);

  // Create particles for data flow
  const particleGeometry = useMemo(() => {
    if (!settings.particleEffects) return null;

    const particleCount = 20;
    const positions = new Float32Array(particleCount * 3);
    const points = curve.getPoints(particleCount);

    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [curve, settings.particleEffects]);

  // Animate particles
  useFrame((state, delta) => {
    if (!particlesRef.current || !particleGeometry) return;

    const positions = particleGeometry.attributes.position.array as Float32Array;
    const points = curve.getPoints(20);

    for (let i = 0; i < points.length; i++) {
      const t = (state.clock.elapsedTime * 0.3 + i / points.length) % 1;
      const point = curve.getPoint(t);

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }

    particleGeometry.attributes.position.needsUpdate = true;
  });

  const color = hexToThreeColor(connection.color);

  return (
    <group>
      {/* Connection line */}
      <line ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial
          color={color}
          linewidth={2}
          opacity={0.6}
          transparent
        />
      </line>

      {/* Animated particles */}
      {settings.particleEffects && particleGeometry && (
        <points ref={particlesRef} geometry={particleGeometry}>
          <pointsMaterial
            color={color}
            size={4}
            transparent
            opacity={0.8}
            sizeAttenuation={true}
          />
        </points>
      )}
    </group>
  );
}
