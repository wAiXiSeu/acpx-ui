/**
 * WebSocket Message Types
 *
 * Types for WebSocket communication between frontend and backend.
 */

/**
 * Messages sent from backend to frontend (EventBus-driven).
 */
export type WsServerMessage =
  | { type: 'event'; data: unknown }
  | { type: 'session_done' }
  | { type: 'session_update' }
  | { type: 'error'; message: string; code?: string; retryable?: boolean }
  | { type: 'pong' };

/**
 * Messages sent from frontend to backend.
 */
export type WsClientMessage =
  | { type: 'subscribe'; sessionId: string }
  | { type: 'unsubscribe'; sessionId: string }
  | { type: 'ping' };
