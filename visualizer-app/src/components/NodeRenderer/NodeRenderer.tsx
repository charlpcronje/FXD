/**
 * NodeRenderer - Renders individual nodes in 3D space
 */

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { VisualizerNode } from '@/types';
import { useVisualizerStore, useSettings, useSelectedNodes, useHoveredNode } from '@/core/store';
import { getStateColor, getDataTypeColor, hexToThreeColor, getGlowIntensity } from '@/utils/colors';

interface NodeRendererProps {
  node: VisualizerNode;
}

export function NodeRenderer({ node }: NodeRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const settings = useSettings();
  const selectedNodes = useSelectedNodes();
  const hoveredNode = useHoveredNode();
  const { selectNode, setHoveredNode, setInspector } = useVisualizerStore();

  const isSelected = selectedNodes.has(node.id);
  const isHovered = hoveredNode === node.id;

  // Determine geometry based on node type
  const geometry = useMemo(() => {
    switch (node.type) {
      case 'effect':
        return <sphereGeometry args={[20, 32, 32]} />;
      case 'component':
        return <octahedronGeometry args={[20]} />;
      case 'event':
        return <coneGeometry args={[20, 30, 3]} />;
      case 'computed':
        return <boxGeometry args={[30, 30, 30]} />;
      case 'worker':
        return <cylinderGeometry args={[15, 15, 30, 6]} />;
      default:
        return <boxGeometry args={[25, 25, 25]} />;
    }
  }, [node.type]);

  // Get colors
  const stateColor = useMemo(() => hexToThreeColor(getStateColor(node.state)), [node.state]);
  const dataTypeColor = useMemo(() => hexToThreeColor(getDataTypeColor(node.dataType)), [node.dataType]);

  // Animate based on state
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Pulsing for active nodes
    if (node.state === 'active' && settings.enableAnimations) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.1;
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(isSelected || isHovered ? 1.2 : 1);
    }

    // Glow effect
    if (glowRef.current) {
      const glowIntensity = getGlowIntensity(node.updateFrequency);
      glowRef.current.visible = glowIntensity > 0 && settings.particleEffects;

      if (glowRef.current.visible) {
        glowRef.current.scale.setScalar(1 + glowIntensity * 0.5);
        const material = glowRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = glowIntensity * 0.3;
      }
    }

    // Error rainbow effect
    if (node.state === 'error' && settings.enableAnimations) {
      const hue = (state.clock.elapsedTime * 0.5) % 1;
      const color = new THREE.Color().setHSL(hue, 1, 0.5);
      (meshRef.current.material as THREE.MeshStandardMaterial).color = color;
    }

    // Rotate slightly
    if (settings.enableAnimations) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  // Click handler
  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    selectNode(node.id, e.nativeEvent.shiftKey);
    setInspector({ node });
  };

  // Pointer handlers
  const handlePointerOver = () => {
    setHoveredNode(node.id);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHoveredNode(null);
    document.body.style.cursor = 'default';
  };

  return (
    <group position={node.position}>
      {/* Main mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        {geometry}
        <meshStandardMaterial
          color={node.state === 'error' ? stateColor : dataTypeColor}
          emissive={stateColor}
          emissiveIntensity={node.state === 'active' ? 0.5 : 0.2}
          metalness={0.5}
          roughness={0.5}
          wireframe={node.isFrozen}
        />
      </mesh>

      {/* Glow effect */}
      <mesh ref={glowRef}>
        {geometry}
        <meshBasicMaterial
          color={dataTypeColor}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Selection indicator */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[40, 32, 32]} />
          <meshBasicMaterial
            color="#3498db"
            transparent
            opacity={0.1}
            wireframe
          />
        </mesh>
      )}

      {/* Label */}
      {settings.showLabels && (isHovered || isSelected) && (
        <Text
          position={[0, 40, 0]}
          fontSize={10}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.id}
        </Text>
      )}

      {/* Watched indicator */}
      {node.isWatched && (
        <mesh position={[0, 35, 0]}>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#2ecc71" />
        </mesh>
      )}
    </group>
  );
}
