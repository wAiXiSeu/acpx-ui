import { apiClient } from "./client";
import type { SessionRecord, SessionMessage } from "../types/acpx";

export interface CreateSessionOptions {
  agent: string;
  cwd?: string;
  name?: string;
}

export interface CreateSessionResponse {
  handle: string;
  record: SessionRecord;
}

export async function fetchSessions(): Promise<{ sessions: SessionRecord[] }> {
  return apiClient.get<{ sessions: SessionRecord[] }>("/api/sessions");
}

export async function fetchSession(id: string): Promise<{ session: SessionRecord }> {
  return apiClient.get<{ session: SessionRecord }>(`/api/sessions/${id}`);
}

export async function createSession(
  options: CreateSessionOptions
): Promise<CreateSessionResponse> {
  return apiClient.post<CreateSessionResponse>("/api/sessions", options);
}

export async function closeSession(id: string): Promise<{ session: SessionRecord }> {
  return apiClient.del<{ session: SessionRecord }>(`/api/sessions/${id}`);
}

export async function fetchHistory(id: string): Promise<{ messages: SessionMessage[] }> {
  return apiClient.get<{ messages: SessionMessage[] }>(`/api/sessions/${id}/history`);
}