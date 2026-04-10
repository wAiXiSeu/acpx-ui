import type { AcpRuntimeHandle } from "@local/acpx/runtime";
import type { SessionService } from "../../services/session.service.js";

export class InterceptHandler {
  private sessionService: SessionService;
  private pendingIntercepts: Map<string, string> = new Map();

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  queueIntercept(sessionId: string, message: string): void {
    this.pendingIntercepts.set(sessionId, message);
  }

  async applyIntercept(handle: AcpRuntimeHandle, sessionId: string): Promise<boolean> {
    const message = this.pendingIntercepts.get(sessionId);
    if (!message) {
      return false;
    }

    this.pendingIntercepts.delete(sessionId);

    await this.sessionService.cancelTurn(handle, "Intercepted by user");
    return true;
  }

  hasPendingIntercept(sessionId: string): boolean {
    return this.pendingIntercepts.has(sessionId);
  }

  clearIntercept(sessionId: string): void {
    this.pendingIntercepts.delete(sessionId);
  }
}
