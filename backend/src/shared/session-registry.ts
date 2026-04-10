import type { SessionInfo } from "./types.js";

export class SessionRegistry {
  private sessions: Map<string, SessionInfo> = new Map();
  private roomToSession: Map<string, string> = new Map();

  register(info: SessionInfo): void {
    this.sessions.set(info.id, info);
    this.roomToSession.set(info.room, info.id);
  }

  unregister(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.roomToSession.delete(session.room);
      this.sessions.delete(sessionId);
    }
  }

  getById(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getByRoom(roomId: string): SessionInfo | undefined {
    const id = this.roomToSession.get(roomId);
    return id ? this.sessions.get(id) : undefined;
  }

  getAll(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  updateStatus(sessionId: string, status: SessionInfo["status"]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastUsedAt = Date.now();
    }
  }

  updateHitlMode(sessionId: string, mode: SessionInfo["hitlMode"]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.hitlMode = mode;
    }
  }

  updatePermissionMode(sessionId: string, mode: SessionInfo["permissionMode"]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.permissionMode = mode;
    }
  }
}

export const sessionRegistry = new SessionRegistry();
