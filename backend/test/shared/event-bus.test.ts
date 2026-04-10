import { describe, it, expect } from "vitest";
import { EventBus } from "../../src/shared/event-bus.js";
import type { AcpEvent } from "../../src/shared/types.js";

describe("EventBus", () => {
  it("emits and receives session-specific events", () => {
    const bus = new EventBus();
    const received: AcpEvent[] = [];

    bus.onSession("sess-1", (e) => received.push(e));

    bus.emit({ type: "text_delta", sessionId: "sess-1", timestamp: Date.now(), payload: { text: "hello" } });

    expect(received).toHaveLength(1);
    expect(received[0].sessionId).toBe("sess-1");
  });

  it("does not receive events from other sessions", () => {
    const bus = new EventBus();
    const received: AcpEvent[] = [];

    bus.onSession("sess-1", (e) => received.push(e));
    bus.emit({ type: "text_delta", sessionId: "sess-2", timestamp: Date.now(), payload: { text: "other" } });

    expect(received).toHaveLength(0);
  });

  it("onAll receives all events", () => {
    const bus = new EventBus();
    const received: AcpEvent[] = [];

    bus.onAll((e) => received.push(e));
    bus.emit({ type: "text_delta", sessionId: "sess-1", timestamp: Date.now(), payload: {} });
    bus.emit({ type: "done", sessionId: "sess-2", timestamp: Date.now(), payload: {} });

    expect(received).toHaveLength(2);
  });

  it("offSession removes listener", () => {
    const bus = new EventBus();
    let count = 0;
    const handler = () => { count++; };

    bus.onSession("sess-1", handler);
    bus.emit({ type: "text_delta", sessionId: "sess-1", timestamp: Date.now(), payload: {} });
    expect(count).toBe(1);

    bus.offSession("sess-1", handler);
    bus.emit({ type: "text_delta", sessionId: "sess-1", timestamp: Date.now(), payload: {} });
    expect(count).toBe(1);
  });
});
