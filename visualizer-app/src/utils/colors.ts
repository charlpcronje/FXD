/**
 * Color Utilities for FX Visualizer
 * Provides color manipulation, generation, and theming utilities
 */

import { NodeType, NodeState, DataType, LayerType, COLOR_SCHEME } from '@/types';
import * as THREE from 'three';

/**
 * Get color for node state
 */
export function getStateColor(state: NodeState): string {
  return COLOR_SCHEME[state] || COLOR_SCHEME.idle;
}

/**
 * Get color for data type
 */
export function getDataTypeColor(dataType: DataType): string {
  return COLOR_SCHEME[dataType] || COLOR_SCHEME.undefined;
}

/**
 * Get color for node type
 */
export function getNodeTypeColor(type: NodeType): string {
  const typeColorMap: Record<NodeType, string> = {
    data: COLOR_SCHEME.idle,
    effect: COLOR_SCHEME.active,
    component: COLOR_SCHEME.component,
    event: COLOR_SCHEME.warning,
    computed: COLOR_SCHEME.cached,
    async: COLOR_SCHEME.suspended,
    worker: COLOR_SCHEME.worker,
    http: COLOR_SCHEME.http,
    websocket: COLOR_SCHEME.socket,
    wasm: COLOR_SCHEME.wasm,
  };

  return typeColorMap[type] || COLOR_SCHEME.idle;
}

/**
 * Get color for layer
 */
export function getLayerColor(layer: LayerType): string {
  const layerColorMap: Record<LayerType, string> = {
    core: '#2c3e50',
    dom: '#3498db',
    component: '#e67e22',
    worker: '#34495e',
    network: '#8e44ad',
    server: '#16a085',
    wasm: '#c0392b',
    timetravel: '#9b59b6',
  };

  return layerColorMap[layer] || '#2c3e50';
}

/**
 * Convert hex color to THREE.Color
 */
export function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Lighten color by percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const amount = Math.round(2.55 * percent);
  return rgbToHex(
    Math.min(255, rgb.r + amount),
    Math.min(255, rgb.g + amount),
    Math.min(255, rgb.b + amount)
  );
}

/**
 * Darken color by percentage
 */
export function darkenColor(hex: string, percent: number): string {
  return lightenColor(hex, -percent);
}

/**
 * Get opacity for update frequency
 * More frequent updates = higher opacity
 */
export function getFrequencyOpacity(updatesPerSecond: number): number {
  if (updatesPerSecond < 1) return 0.3;
  if (updatesPerSecond < 5) return 0.6;
  if (updatesPerSecond < 10) return 0.9;
  return 1.0;
}

/**
 * Get glow intensity for update frequency
 */
export function getGlowIntensity(updatesPerSecond: number): number {
  if (updatesPerSecond < 10) return 0;
  if (updatesPerSecond < 50) return 0.3;
  if (updatesPerSecond < 100) return 0.6;
  return 1.0;
}

/**
 * Generate color palette
 */
export function generatePalette(count: number, baseHue: number = 200): string[] {
  const palette: string[] = [];
  const step = 360 / count;

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + i * step) % 360;
    palette.push(hslToHex(hue, 70, 50));
  }

  return palette;
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;

  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };

  return rgbToHex(f(0), f(8), f(4));
}

/**
 * Interpolate between two colors
 */
export function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return color1;

  const r = c1.r + factor * (c2.r - c1.r);
  const g = c1.g + factor * (c2.g - c1.g);
  const b = c1.b + factor * (c2.b - c1.b);

  return rgbToHex(r, g, b);
}

/**
 * Get gradient colors for connections
 */
export function getConnectionGradient(
  sourceType: DataType,
  targetType: DataType,
  steps: number = 10
): string[] {
  const sourceColor = getDataTypeColor(sourceType);
  const targetColor = getDataTypeColor(targetType);

  const gradient: string[] = [];
  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1);
    gradient.push(interpolateColor(sourceColor, targetColor, factor));
  }

  return gradient;
}

/**
 * Get particle color based on data flow
 */
export function getParticleColor(data: any): string {
  const type = typeof data;

  switch (type) {
    case 'string':
      return COLOR_SCHEME.string;
    case 'number':
      return COLOR_SCHEME.number;
    case 'boolean':
      return COLOR_SCHEME.boolean;
    case 'function':
      return COLOR_SCHEME.function;
    case 'object':
      if (data === null) return COLOR_SCHEME.null;
      if (Array.isArray(data)) return COLOR_SCHEME.array;
      return COLOR_SCHEME.object;
    default:
      return COLOR_SCHEME.undefined;
  }
}

/**
 * Get heat map color based on activity
 * 0 = cold (blue), 1 = hot (red)
 */
export function getHeatMapColor(intensity: number): string {
  // Clamp intensity between 0 and 1
  const t = Math.max(0, Math.min(1, intensity));

  // Blue -> Cyan -> Green -> Yellow -> Red
  if (t < 0.25) {
    // Blue to Cyan
    const factor = t / 0.25;
    return interpolateColor('#3498db', '#00bcd4', factor);
  } else if (t < 0.5) {
    // Cyan to Green
    const factor = (t - 0.25) / 0.25;
    return interpolateColor('#00bcd4', '#2ecc71', factor);
  } else if (t < 0.75) {
    // Green to Yellow
    const factor = (t - 0.5) / 0.25;
    return interpolateColor('#2ecc71', '#f39c12', factor);
  } else {
    // Yellow to Red
    const factor = (t - 0.75) / 0.25;
    return interpolateColor('#f39c12', '#e74c3c', factor);
  }
}

/**
 * Get rainbow color for errors
 */
export function getRainbowColor(offset: number = 0): string {
  const hue = (Date.now() / 20 + offset) % 360;
  return hslToHex(hue, 100, 50);
}

/**
 * Generate pulsing color effect
 */
export function getPulsingColor(
  baseColor: string,
  pulseSpeed: number = 1,
  pulseIntensity: number = 0.3
): string {
  const time = Date.now() / 1000;
  const pulse = Math.sin(time * pulseSpeed) * 0.5 + 0.5;
  const factor = pulseIntensity * pulse;

  return lightenColor(baseColor, factor * 50);
}

/**
 * Get color with alpha
 */
export function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * Check if color is dark
 */
export function isColorDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

/**
 * Get contrasting text color for background
 */
export function getContrastColor(bgColor: string): string {
  return isColorDark(bgColor) ? '#ffffff' : '#000000';
}
