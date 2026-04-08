/**
 * WebSocket Message Types
 * 
 * Types for WebSocket communication between frontend and backend.
 * Mirrors the backend's WsMessage types from session-handler.ts
 */

/**
 * Permission request parameters sent from backend when a tool needs permission.
 */
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

/**
 * Messages sent from backend to frontend.
 */
export type WsServerMessage =
  | { type: 'text_delta'; text: string; stream?: 'output' | 'thought' }
  | { type: 'status'; text: string; used?: number; size?: number }
  | { type: 'tool_call'; text: string; toolCallId?: string; status?: string; title?: string }
  | { type: 'permission_request'; requestId: string; params: WsPermissionParams }
  | { type: 'error'; message: string; code?: string; retryable?: boolean }
  | { type: 'done'; stopReason?: string }
  | { type: 'pong' };

/**
 * Messages sent from frontend to backend.
 */
export type WsClientMessage =
  | { type: 'prompt'; text: string; handle?: unknown; sessionId?: string }
  | { type: 'cancel' }
  | { type: 'permission_response'; requestId: string; response: string }
  | { type: 'ping' };

/**
 * Permission response option kinds.
 */
export type PermissionResponseKind = 'allow_once' | 'allow_always' | 'deny_once' | 'deny_always';

/**
 * Permission response sent to backend.
 */
export interface PermissionResponse {
  requestId: string;
  kind: PermissionResponseKind;
}