/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Circuit board theme
        circuit: {
          board: '#1a3a1a',
          trace: '#d4af37',
          copper: '#b87333',
          solder: '#c0c0c0',
          silk: '#ffffff',
        },
        // Node states
        node: {
          idle: '#2c3e50',
          active: '#3498db',
          success: '#2ecc71',
          error: '#e74c3c',
          warning: '#f39c12',
          suspended: '#9b59b6',
          cached: '#1abc9c',
        },
        // Data types
        data: {
          string: '#2ecc71',
          number: '#3498db',
          boolean: '#f39c12',
          object: '#9b59b6',
          array: '#e91e63',
          function: '#00bcd4',
          null: '#95a5a6',
          undefined: '#7f8c8d',
        },
        // Special nodes
        special: {
          component: '#e67e22',
          worker: '#34495e',
          socket: '#16a085',
          http: '#8e44ad',
          wasm: '#c0392b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'particle': 'particle 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        particle: {
          '0%': { transform: 'translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor' },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
