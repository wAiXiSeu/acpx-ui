import { EventEmitter } from "node:events";
import type { AcpEvent } from "./types.js";

type EventBusListener = (event: AcpEvent) => void;

export class EventBus {
  private emitter = new EventEmitter();

  emit(event: AcpEvent): void {
    this.emitter.emit("event", event);
    this.emitter.emit(`event:${event.sessionId}`, event);
  }

  onSession(sessionId: string, listener: EventBusListener): void {
    this.emitter.on(`event:${sessionId}`, listener);
  }

  onAll(listener: EventBusListener): void {
    this.emitter.on("event", listener);
  }

  offSession(sessionId: string, listener: EventBusListener): void {
    this.emitter.off(`event:${sessionId}`, listener);
  }

  offAll(listener: EventBusListener): void {
    this.emitter.off("event", listener);
  }

  listenerCount(sessionId?: string): number {
    if (sessionId) {
      return this.emitter.listenerCount(`event:${sessionId}`);
    }
    return this.emitter.listenerCount("event");
  }
}

export const eventBus = new EventBus();
