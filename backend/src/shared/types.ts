import type { RequestPermissionRequest } from "@agentclientprotocol/sdk";

export interface SessionInfo {
  id: string;
  room: string;           // Matrix room_id
  name: string;
  agent: string;
  status: "idle" | "running" | "error" | "done";
  hitlMode: "off" | "step" | "intercept";
  permissionMode: "approve-all" | "approve-reads" | "deny-all";
  createdAt: number;
  lastUsedAt: number;
  tokenUsage: { prompt: number; completion: number };
}

export interface AcpEvent {
  type: "text_delta" | "tool_call" | "status" | "done" | "error"
      | "pre_tool_call" | "permission_request"
      | "intercepted" | "step_paused" | "step_resumed"
      | "params_modified";
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface EventLogEntry {
  timestamp: number;
  direction: "in" | "out";
  event: AcpEvent;
}

export interface PermissionRequestPayload {
  requestId: string;
  sessionId: string;
  params: RequestPermissionRequest;
}
