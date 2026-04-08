import type WebSocket from 'ws';
import type { AcpRuntimeEvent, AcpRuntimeHandle } from '@local/acpx/dist/runtime.js';
import { sessionService } from '../services/session.service.js';

export interface WsPermissionParams {
  requestId: string;
  sessionId: string;
  toolName: string;
  toolTitle?: string;
  toolKind?: string;
  input: unknown;
  options: Array<{
    id: string;
    kind: 'allow_once' | 'allow_always' | 'deny_once' | 'deny_always';
    label: string;
    detail?: string;
  }>;
  message?: string;
}

export type WsMessage =
  | { type: 'text_delta'; text: string; stream?: 'output' | 'thought' }
  | { type: 'status'; text: string; used?: number; size?: number }
  | { type: 'tool_call'; text: string; toolCallId?: string; status?: string; title?: string }
  | { type: 'permission_request'; requestId: string; params: WsPermissionParams }
  | { type: 'error'; message: string; code?: string; retryable?: boolean }
  | { type: 'done'; stopReason?: string };

const MAX_BUFFER_LINES = 1000;
const BACKPRESSURE_THRESHOLD = 64 * 1024;

class OutputBuffer {
  private lines: string[] = [];
  private totalSize = 0;

  add(line: string): void {
    const lineSize = Buffer.byteLength(line, 'utf-8');
    this.lines.push(line);
    this.totalSize += lineSize;

    while (this.lines.length > MAX_BUFFER_LINES) {
      const removed = this.lines.shift();
      if (removed) {
        this.totalSize -= Buffer.byteLength(removed, 'utf-8');
      }
    }
  }

  getSize(): number {
    return this.totalSize;
  }

  getLines(): string[] {
    return this.lines;
  }

  clear(): void {
    this.lines = [];
    this.totalSize = 0;
  }

  isOverThreshold(): boolean {
    return this.totalSize > BACKPRESSURE_THRESHOLD;
  }
}

export interface PermissionParams {
  requestId?: string;
  sessionId?: string;
  toolName: string;
  toolTitle?: string;
  toolKind?: string;
  input: unknown;
  options?: Array<{
    id: string;
    kind: 'allow_once' | 'allow_always' | 'deny_once' | 'deny_always';
    label: string;
    detail?: string;
  }>;
  message?: string;
}

export class SessionWebSocketHandler {
  private socket: WebSocket;
  private sessionId: string;
  private buffer: OutputBuffer;
  private isPaused = false;
  private handle: AcpRuntimeHandle | null = null;
  private abortController: AbortController | null = null;

  constructor(socket: WebSocket, sessionId: string) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.buffer = new OutputBuffer();
    this.attachHandlers();
  }

  private attachHandlers(): void {
    this.socket.on('drain', () => {
      this.isPaused = false;
      this.flushBuffer();
    });

    this.socket.on('close', () => {
      this.cleanup();
    });

    this.socket.on('error', (error: Error) => {
      console.error(`WebSocket error for session ${this.sessionId}:`, error);
      this.cleanup();
    });
  }

  private send(message: WsMessage): void {
    const serialized = JSON.stringify(message);
    this.buffer.add(serialized);

    if (this.isPaused || this.buffer.isOverThreshold()) {
      this.isPaused = true;
      return;
    }

    this.flushBuffer();
  }

  private flushBuffer(): void {
    if (this.isPaused) {
      return;
    }

    const lines = this.buffer.getLines();
    
    for (const line of lines) {
      this.socket.send(line);
      
      if (this.socket.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        this.isPaused = true;
        return;
      }
    }

    this.buffer.clear();
  }

  private transformEvent(event: AcpRuntimeEvent): WsMessage {
    switch (event.type) {
      case 'text_delta':
        return {
          type: 'text_delta',
          text: event.text,
          stream: event.stream,
        };
      
      case 'status':
        return {
          type: 'status',
          text: event.text,
          used: event.used,
          size: event.size,
        };
      
      case 'tool_call':
        return {
          type: 'tool_call',
          text: event.text,
          toolCallId: event.toolCallId,
          status: event.status,
          title: event.title,
        };
      
      case 'done':
        return {
          type: 'done',
          stopReason: event.stopReason,
        };
      
      case 'error':
        return {
          type: 'error',
          message: event.message,
          code: event.code,
          retryable: event.retryable,
        };
      
      default:
        return {
          type: 'error',
          message: `Unknown event type: ${JSON.stringify(event)}`,
          code: 'UNKNOWN_EVENT',
        };
    }
  }

  async runTurn(handleOrSessionId: AcpRuntimeHandle | string, text: string): Promise<void> {
    this.abortController = new AbortController();

    try {
      let handle: AcpRuntimeHandle;
      
      if (typeof handleOrSessionId === 'string') {
        console.log(`[WebSocket] Ensuring handle for session: ${handleOrSessionId}`);
        handle = await sessionService.ensureHandleForSession(handleOrSessionId);
        console.log(`[WebSocket] Handle obtained:`, handle?.acpxRecordId);
      } else {
        handle = handleOrSessionId;
      }
      
      this.handle = handle;

      console.log(`[WebSocket] Running turn with text: "${text.substring(0, 50)}..."`);
      const eventStream = sessionService.runTurn(handle, text, undefined, this.abortController.signal);

      for await (const event of eventStream) {
        const message = this.transformEvent(event);
        console.log(`[WebSocket] Sending event: ${event.type}`);
        this.send(message);

        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }
    } catch (error) {
      console.error('[WebSocket] Turn error:', error);
      this.send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        code: 'TURN_FAILED',
        retryable: true,
      });
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.handle) {
      sessionService.cancelTurn(this.handle, 'User cancelled').catch((error: unknown) => {
        console.error('Failed to cancel turn:', error);
      });
    }
  }

  handlePermissionRequest(params: PermissionParams): void {
    this.send({
      type: 'permission_request',
      requestId: params.requestId || crypto.randomUUID(),
      params: {
        requestId: params.requestId || crypto.randomUUID(),
        sessionId: this.sessionId,
        toolName: params.toolName,
        toolTitle: params.toolTitle,
        toolKind: params.toolKind,
        input: params.input,
        options: params.options || [],
        message: params.message,
      },
    });
  }

  private cleanup(): void {
    this.cancel();
    this.buffer.clear();
    this.handle = null;
    this.abortController = null;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isStreaming(): boolean {
    return this.handle !== null && this.abortController !== null;
  }
}

export function createSessionHandler(
  socket: WebSocket,
  sessionId: string,
): SessionWebSocketHandler {
  return new SessionWebSocketHandler(socket, sessionId);
}