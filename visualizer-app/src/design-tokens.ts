/**
 * FXD Quantum - Design Tokens
 * Complete design system tokens matching IDEAL-APP-VISION.md
 */

export const colors = {
  dark: {
    bg: '#0a0a0f',           // Deep space background
    surface: '#16161d',       // Elevated cards
    border: '#2a2a35',        // Subtle borders
    textPrimary: '#e4e4e7',   // Bright white text
    textSecondary: '#a1a1aa', // Muted text
    accent: '#6366f1',        // Indigo accent
    success: '#10b981',       // Emerald success
    warning: '#f59e0b',       // Amber warning
    error: '#ef4444',         // Red error
    info: '#3b82f6',          // Blue info

    // Node type colors for 3D graph
    nodeTypes: {
      container: '#6366f1',   // Blue - Container nodes
      data: '#10b981',        // Green - Data nodes
      code: '#fbbf24',        // Yellow - Code snippets
      view: '#ec4899',        // Pink - Views/Computed
      signal: '#fb923c',      // Orange - Signals/Events
      network: '#a855f7',     // Purple - Network/External
    },

    // Connection types
    connections: {
      parent: '#4b5563',      // Gray - Parent/Child
      reference: '#6b7280',   // Light gray - Reference
      entangled: '#8b5cf6',   // Purple glow - Atomics entanglement
      dataFlow: '#3b82f6',    // Blue - Data flow
    }
  },

  light: {
    bg: '#ffffff',
    surface: '#f9fafb',
    border: '#e5e7eb',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    accent: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  }
};

export const borderRadius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  glow: '0 0 20px rgba(99, 102, 241, 0.3)',
  glowStrong: '0 0 40px rgba(99, 102, 241, 0.5)',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: '300ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

export const zIndex = {
  base: 0,
  sidebar: 10,
  header: 20,
  dropdown: 30,
  overlay: 40,
  modal: 50,
  tooltip: 60,
  notification: 70,
};

export const layout = {
  sidebarWidth: {
    collapsed: 60,
    expanded: 240,
  },
  titleBarHeight: 48,
  statusBarHeight: 32,
  bottomPanelHeight: {
    collapsed: 0,
    expanded: 300,
  },
};

export const glassEffect = {
  background: 'rgba(22, 22, 29, 0.8)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

export const animations = {
  // Card hover effect
  cardHover: {
    scale: 1.02,
    transition: transitions.normal,
  },

  // Button press effect
  buttonPress: {
    scale: 0.98,
    transition: transitions.fast,
  },

  // Slide in from right
  slideInRight: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  // Fade in
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
  },

  // Scale in (modal/dialog)
  scaleIn: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

// Export default theme
export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  layout,
  glassEffect,
  animations,
};

export type Theme = typeof theme;
