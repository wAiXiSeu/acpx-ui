import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RoomRouter } from "../../src/matrix/room-router.js";
import { eventBus } from "../../src/shared/event-bus.js";
import { sessionRegistry } from "../../src/shared/session-registry.js";
import type { AcpEvent } from "../../src/shared/types.js";

vi.mock("../../src/services/session.service.js", () => ({
  sessionService: {
    createSession: vi.fn().mockResolvedValue({
      record: { acpxRecordId: "sess-123" },
      handle: { sessionKey: "sess-123" },
    }),
    closeSession: vi.fn().mockResolvedValue({}),
    getHandle: vi.fn(),
    ensureHandleForSession: vi.fn().mockResolvedValue({ sessionKey: "sess-123" }),
    cancelTurn: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({}),
    runTurn: async function* () {
      yield { type: "text_delta", text: "Hello from agent" };
      yield { type: "done", stopReason: "end_turn" };
    },
  },
}));

describe("Matrix Round Trip", () => {
  let mockGateway: any;
  let router: RoomRouter;

  beforeEach(() => {
    mockGateway = {
      createRoom: vi.fn().mockResolvedValue("!session123:server"),
      getMatrixEventLink: vi.fn().mockResolvedValue("https://matrix.to/#!/!session123:server"),
      sendMessage: vi.fn().mockResolvedValue("$event1"),
      sendReply: vi.fn().mockResolvedValue("$event2"),
    };
    router = new RoomRouter(mockGateway);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes /new command to create session and room", async () => {
    await router.handleMessage({
      roomId: "!manager:room",
      session: undefined,
      sender: "@admin:server",
      body: "/new claude test session",
      eventId: "$msg1",
      isManagerRoom: true,
    });

    expect(mockGateway.createRoom).toHaveBeenCalledWith(
      "test session",
      "@admin:server",
      expect.stringContaining("claude"),
    );
    expect(mockGateway.sendReply).toHaveBeenCalled();
    const replyCall = mockGateway.sendReply.mock.calls[0];
    expect(replyCall[2]).toContain("test session");
  });

  it("routes session room message to acpx prompt", async () => {
    sessionRegistry.register({
      id: "sess-123",
      room: "!session123:server",
      name: "test session",
      agent: "claude",
      status: "idle",
      hitlMode: "off",
      permissionMode: "approve-reads",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tokenUsage: { prompt: 0, completion: 0 },
    });

    const events: AcpEvent[] = [];
    eventBus.onSession("sess-123", (e) => events.push(e));

    await router.handleMessage({
      roomId: "!session123:server",
      session: sessionRegistry.getById("sess-123")!,
      sender: "@user:server",
      body: "Hello agent",
      eventId: "$msg1",
      isManagerRoom: false,
    });

    // Verify events were emitted to bus
    expect(events.length).toBeGreaterThan(0);

    // Verify agent responses were sent to Matrix
    expect(mockGateway.sendReply).toHaveBeenCalled();

    // Cleanup
    sessionRegistry.unregister("sess-123");
    eventBus.offSession("sess-123", (e) => events.push(e));
  });

  it("/list command shows registered sessions", async () => {
    sessionRegistry.register({
      id: "sess-list-1",
      room: "!listroom:server",
      name: "list test",
      agent: "claude",
      status: "running",
      hitlMode: "off",
      permissionMode: "approve-reads",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tokenUsage: { prompt: 0, completion: 0 },
    });

    await router.handleMessage({
      roomId: "!manager:room",
      session: undefined,
      sender: "@user:server",
      body: "/list",
      eventId: "$msg2",
      isManagerRoom: true,
    });

    expect(mockGateway.sendReply).toHaveBeenCalled();
    const replyCall = mockGateway.sendReply.mock.calls[0];
    expect(replyCall[2]).toContain("list test");
    expect(replyCall[2]).toContain("running");

    sessionRegistry.unregister("sess-list-1");
  });

  it("/kill command terminates a session", async () => {
    sessionRegistry.register({
      id: "sess-kill-1",
      room: "!killroom:server",
      name: "kill test",
      agent: "claude",
      status: "running",
      hitlMode: "off",
      permissionMode: "approve-reads",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tokenUsage: { prompt: 0, completion: 0 },
    });

    await router.handleMessage({
      roomId: "!manager:room",
      session: undefined,
      sender: "@user:server",
      body: "/kill sess-kill-1",
      eventId: "$msg3",
      isManagerRoom: true,
    });

    expect(mockGateway.sendReply).toHaveBeenCalled();
    const replyCall = mockGateway.sendReply.mock.calls[0];
    expect(replyCall[2]).toContain("terminated");

    // Verify session was unregistered
    expect(sessionRegistry.getById("sess-kill-1")).toBeUndefined();
  });
});
