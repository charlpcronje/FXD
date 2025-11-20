/**
 * FX Terminal Map - Norton Commander style ASCII visualization
 * Shows FXD disk usage and node states in classic terminal graphics
 */

import { $$ } from '../fx.ts';

type CellState = 'FREE' | 'USED' | 'GOOD' | 'BAD' | 'SYSTEM' | 'SCANNING' | 'SNIPPET' | 'VIEW' | 'NODE' | 'ACTIVE';

const GLYPHS = {
  FREE: { ch: '░', color: '\u001b[37;2m' },     // Light gray
  USED: { ch: '▓', color: '\u001b[37m' },       // Gray
  GOOD: { ch: '█', color: '\u001b[97m' },       // Bright white
  BAD: { ch: '▓°', color: '\u001b[31m' },       // Red
  SYSTEM: { ch: '█', color: '\u001b[36m' },     // Cyan
  SCANNING: { ch: '◙', color: '\u001b[33m' },   // Yellow
  SNIPPET: { ch: '▀', color: '\u001b[32m' },    // Green
  VIEW: { ch: '▄', color: '\u001b[34m' },       // Blue
  NODE: { ch: '♦', color: '\u001b[35m' },       // Magenta
  ACTIVE: { ch: '●', color: '\u001b[93m' }      // Bright yellow
};

const RST = '\u001b[0m';

export class FXTerminalMap {
  private terminal: any;
  private totalCells = 0;
  private cellStates: Map<number, CellState> = new Map();
  private activeNodes: Set<string> = new Set();
  private lastUpdate = 0;

  constructor(terminal: any) {
    this.terminal = terminal;
    this.analyzeFXDisk();
  }

  private analyzeFXDisk(): void {
    // Calculate total "cells" based on FX content
    const snippets = $$('snippets').val() || {};
    const views = $$('views').val() || {};
    const nodes = $$('nodes').val() || {};

    let cellCount = 0;

    // Count snippet cells
    Object.values(snippets).forEach((snippet: any) => {
      const contentSize = snippet.content?.length || 0;
      cellCount += Math.ceil(contentSize / 64); // 64 bytes per cell
    });

    // Count view cells
    Object.values(views).forEach((content: any) => {
      const size = (content as string).length || 0;
      cellCount += Math.ceil(size / 64);
    });

    // Count system cells
    cellCount += 50; // Base system overhead

    this.totalCells = Math.max(1024, cellCount); // Minimum 1024 cells
    this.updateCellStates();
  }

  private updateCellStates(): void {
    this.cellStates.clear();

    const snippets = $$('snippets').val() || {};
    const views = $$('views').val() || {};
    let cellIndex = 0;

    // System cells (first 50)
    for (let i = 0; i < 50; i++) {
      this.cellStates.set(i, 'SYSTEM');
    }
    cellIndex = 50;

    // Snippet cells
    Object.entries(snippets).forEach(([id, snippet]: [string, any]) => {
      const cellCount = Math.ceil((snippet.content?.length || 0) / 64);
      const isActive = this.activeNodes.has(id);

      for (let i = 0; i < cellCount; i++) {
        const state = isActive ? 'ACTIVE' :
                     snippet.error ? 'BAD' :
                     snippet.verified ? 'GOOD' : 'SNIPPET';
        this.cellStates.set(cellIndex++, state);
      }
    });

    // View cells
    Object.entries(views).forEach(([id, content]: [string, any]) => {
      const cellCount = Math.ceil((content as string).length / 64);
      for (let i = 0; i < cellCount; i++) {
        this.cellStates.set(cellIndex++, 'VIEW');
      }
    });

    // Fill remaining as free
    while (cellIndex < this.totalCells) {
      this.cellStates.set(cellIndex++, 'FREE');
    }
  }

  private getCellState(idx: number): CellState {
    return this.cellStates.get(idx) || 'FREE';
  }

  private termSize() {
    const cols = this.terminal.cols || 80;
    const rows = this.terminal.rows || 24;
    return {
      cols: Math.max(40, cols),
      rows: Math.max(20, rows)
    };
  }

  render(): void {
    const { cols, rows } = this.termSize();
    const usableCols = cols - 4;
    const gridCols = Math.max(16, Math.min(usableCols, 64));
    const gridRows = Math.min(rows - 6, Math.ceil(this.totalCells / gridCols));

    this.terminal.clear();

    // Header with FXD info
    const diskName = $$('disk.name').val() || 'FXD-DISK';
    const header = `FXD: ${diskName} `.padEnd(cols - 2);
    this.terminal.writeln('┌' + header.substring(0, cols - 2) + '┐');

    // Column headers (hex digits)
    const colHeader = '0123456789ABCDEF'.repeat(Math.ceil(gridCols/16)).slice(0, gridCols);
    this.terminal.writeln('│ ' + colHeader + ' │');
    this.terminal.writeln('├─' + '─'.repeat(gridCols) + '─┤');

    // Grid visualization
    let idx = 0;
    for (let r = 0; r < gridRows; r++) {
      const rowLabel = r.toString(16).toUpperCase().padStart(1, '0');
      let line = `│${rowLabel}│`;

      for (let c = 0; c < gridCols; c++) {
        const state = idx < this.totalCells ? this.getCellState(idx) : 'FREE';
        const { ch, color } = GLYPHS[state];
        line += color + ch + RST;
        idx++;
      }
      line += '│';
      this.terminal.writeln(line);
    }

    // Stats and legend
    this.terminal.writeln('├─' + '─'.repeat(gridCols) + '─┤');

    const stats = this.calculateStats();
    const statsLine = `│ ${stats.used}/${stats.total} used (${stats.percentage}%) │`;
    this.terminal.writeln(statsLine.padEnd(cols - 1) + '│');

    this.terminal.writeln('└' + '─'.repeat(cols - 2) + '┘');

    // Legend
    const legend = [
      `${GLYPHS.FREE.color}░${RST}free`,
      `${GLYPHS.SNIPPET.color}▀${RST}snippet`,
      `${GLYPHS.VIEW.color}▄${RST}view`,
      `${GLYPHS.NODE.color}♦${RST}node`,
      `${GLYPHS.ACTIVE.color}●${RST}active`,
      `${GLYPHS.BAD.color}▓°${RST}error`,
      `${GLYPHS.SYSTEM.color}█${RST}system`
    ].join(' ');
    this.terminal.writeln(`Legend: ${legend}`);
  }

  private calculateStats(): { used: number; total: number; percentage: number } {
    let used = 0;
    for (let i = 0; i < this.totalCells; i++) {
      const state = this.getCellState(i);
      if (state !== 'FREE') used++;
    }

    return {
      used,
      total: this.totalCells,
      percentage: Math.round((used / this.totalCells) * 100)
    };
  }

  // Update active nodes (called when snippets execute)
  markNodeActive(nodeId: string): void {
    this.activeNodes.add(nodeId);
    this.updateCellStates();

    // Auto-deactivate after 2 seconds
    setTimeout(() => {
      this.activeNodes.delete(nodeId);
      this.updateCellStates();
    }, 2000);
  }

  // Real-time updates
  startRealTimeUpdates(): void {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastUpdate > 1000) { // Update every second
        this.analyzeFXDisk();
        this.render();
        this.lastUpdate = now;
      }
    }, 1000);
  }

  // Integration with FXD execution tracking
  setupExecutionTracking(): void {
    // Watch for snippet executions
    $$('execution.**').watch((value: any, path: string) => {
      const snippetId = path.split('.')[1];
      if (snippetId && value === 'running') {
        this.markNodeActive(snippetId);
      }
    });
  }
}

// Norton Commander style disk analysis
export function showDiskAnalysis(terminal: any): void {
  const map = new FXTerminalMap(terminal);

  terminal.writeln('🔍 FXD Disk Analysis - Norton Commander Style');
  terminal.writeln('');

  map.render();

  terminal.writeln('');
  terminal.writeln('Press R to refresh, ESC to exit');

  // Handle input for disk analysis
  terminal.onData((data: string) => {
    if (data === 'r' || data === 'R') {
      map.render();
    } else if (data.charCodeAt(0) === 27) { // Escape
      terminal.clear();
      terminal.write('🗂️ Disk analysis closed\r\nfxd /c/dev/fxd $ ');
    }
  });
}