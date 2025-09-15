/**
 * FX Terminal Server - Real PTY terminal with WebSocket
 * Provides actual shell access through xterm.js
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

interface TerminalSession {
  id: string;
  socket: WebSocket;
  process?: Deno.ChildProcess;
  created: number;
  lastActivity: number;
}

export class FXTerminalServer {
  private sessions = new Map<string, TerminalSession>();
  private port: number;

  constructor(port = 3001) {
    this.port = port;
  }

  async start(): Promise<void> {
    console.log(`🖥️ Starting FX Terminal Server on port ${this.port}`);

    await serve((req) => {
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 400 });
      }

      const { socket, response } = Deno.upgradeWebSocket(req);
      const sessionId = crypto.randomUUID();

      socket.onopen = () => this.handleConnection(sessionId, socket);
      socket.onmessage = (event) => this.handleMessage(sessionId, event);
      socket.onclose = () => this.handleDisconnection(sessionId);
      socket.onerror = (error) => this.handleError(sessionId, error);

      return response;
    }, { port: this.port });
  }

  private async handleConnection(sessionId: string, socket: WebSocket): Promise<void> {
    console.log(`🔌 Terminal session connected: ${sessionId}`);

    try {
      // Start shell process based on platform
      const shell = this.getShellCommand();
      const process = new Deno.Command(shell.cmd, {
        args: shell.args,
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
        env: {
          ...Deno.env.toObject(),
          TERM: "xterm-256color",
          PATH: Deno.env.get("PATH") + ";C:\\dev\\fxd", // Add FXD to PATH
        }
      }).spawn();

      // Create session
      const session: TerminalSession = {
        id: sessionId,
        socket,
        process,
        created: Date.now(),
        lastActivity: Date.now()
      };

      this.sessions.set(sessionId, session);

      // Setup data pipes
      this.setupDataPipes(session);

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        sessionId,
        shell: shell.name
      }));

    } catch (error) {
      console.error(`Failed to start shell for session ${sessionId}:`, error);
      socket.close(1011, 'Failed to start shell');
    }
  }

  private getShellCommand(): { cmd: string; args: string[]; name: string } {
    if (Deno.build.os === 'windows') {
      return {
        cmd: 'cmd.exe',
        args: ['/k', 'echo Welcome to FXD Terminal && cd /d C:\\dev\\fxd'],
        name: 'Windows Command Prompt'
      };
    } else if (Deno.build.os === 'darwin') {
      return {
        cmd: '/bin/zsh',
        args: ['-l'],
        name: 'Zsh'
      };
    } else {
      return {
        cmd: '/bin/bash',
        args: ['-l'],
        name: 'Bash'
      };
    }
  }

  private async setupDataPipes(session: TerminalSession): Promise<void> {
    if (!session.process) return;

    // Pipe stdout to WebSocket
    this.pipeReaderToSocket(session.process.stdout, session, 'stdout');

    // Pipe stderr to WebSocket
    this.pipeReaderToSocket(session.process.stderr, session, 'stderr');

    // Handle process exit
    session.process.status.then(() => {
      console.log(`🔚 Shell process ended for session ${session.id}`);
      session.socket.close(1000, 'Shell process ended');
      this.sessions.delete(session.id);
    });
  }

  private async pipeReaderToSocket(
    reader: ReadableStream<Uint8Array>,
    session: TerminalSession,
    type: 'stdout' | 'stderr'
  ): Promise<void> {
    const decoder = new TextDecoder();

    try {
      for await (const chunk of reader) {
        if (session.socket.readyState === WebSocket.OPEN) {
          const text = decoder.decode(chunk);
          session.socket.send(JSON.stringify({
            type: 'data',
            data: text
          }));
          session.lastActivity = Date.now();
        }
      }
    } catch (error) {
      console.error(`Error reading ${type} for session ${session.id}:`, error);
    }
  }

  private handleMessage(sessionId: string, event: MessageEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process) return;

    try {
      const message = JSON.parse(event.data);
      session.lastActivity = Date.now();

      switch (message.type) {
        case 'input':
          // Send input to shell stdin
          if (session.process.stdin) {
            const writer = session.process.stdin.getWriter();
            const encoder = new TextEncoder();
            writer.write(encoder.encode(message.data));
            writer.releaseLock();
          }
          break;

        case 'resize':
          // Handle terminal resize (PTY would handle this)
          console.log(`Terminal resize: ${message.cols}x${message.rows}`);
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }

    } catch (error) {
      console.error(`Error handling message for session ${sessionId}:`, error);
    }
  }

  private handleDisconnection(sessionId: string): void {
    console.log(`🔌 Terminal session disconnected: ${sessionId}`);

    const session = this.sessions.get(sessionId);
    if (session) {
      // Kill shell process
      if (session.process) {
        try {
          session.process.kill();
        } catch (error) {
          console.warn(`Failed to kill process for session ${sessionId}:`, error);
        }
      }

      this.sessions.delete(sessionId);
    }
  }

  private handleError(sessionId: string, error: Event | ErrorEvent): void {
    console.error(`Terminal session error ${sessionId}:`, error);
  }

  // Cleanup stale sessions
  startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      const staleTimeout = 30 * 60 * 1000; // 30 minutes

      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivity > staleTimeout) {
          console.log(`🧹 Cleaning up stale session: ${sessionId}`);
          this.handleDisconnection(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }
}