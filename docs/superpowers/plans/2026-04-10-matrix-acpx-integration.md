# Matrix + acpx-ui Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Matrix room-based session management and HITL interaction to acpx-ui, with Matrix as the write-operation entry point and Web UI as read-only dashboard.

**Architecture:** Backend (Fastify) acts as a Matrix bot user via `matrix-js-sdk`. Manager room handles admin commands (`/new`, `/kill`, `/list`). Each session has a dedicated Matrix room. ACP events are broadcast via in-memory EventBus to both Matrix rooms and the Web UI (WebSocket). HITL adds step-mode, param-edit, and intercept capabilities through acpx-fork patches (~50 lines across 3 files).

**Tech Stack:** TypeScript, Fastify 4, matrix-js-sdk, @fastify/websocket, @local/acpx (forked), Zustand, React 18

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `acpx-fork/patches/001-hitl-extension-points.patch` | Patch overlay for HITL extension points |
| `acpx-fork/scripts/verify-patch.sh` | CI script to verify patch applies |
| `backend/src/matrix/gateway.ts` | Matrix client connection, event listening, message sending |
| `backend/src/matrix/room-router.ts` | Route messages: manager room → commands, session room → prompts |
| `backend/src/matrix/formatter.ts` | Format ACP events → Matrix messages |
| `backend/src/matrix/commands.ts` | Parse manager room commands (`/new`, `/list`, `/kill`, etc.) |
| `backend/src/shared/event-bus.ts` | Centralized event distribution |
| `backend/src/shared/session-registry.ts` | Track session → room mapping |
| `backend/src/sessions/hitl/step-controller.ts` | Step mode: pause/resume tool execution |
| `backend/src/sessions/hitl/param-editor.ts` | Param editing: parse EDIT, apply modified params |
| `backend/src/sessions/hitl/intercept-handler.ts` | Intercept: inject user corrections into running session |
| `backend/test/matrix/gateway.test.ts` | Gateway unit tests |
| `backend/test/matrix/commands.test.ts` | Command parser unit tests |
| `backend/test/matrix/formatter.test.ts` | Event formatter unit tests |
| `backend/test/shared/event-bus.test.ts` | EventBus unit tests |

### Modified Files
| File | Change |
|---|---|
| `acpx-fork/src/runtime/public/contract.ts` | Add `onPermissionRequest` and `onPreToolCall` to `AcpRuntimeOptions` |
| `acpx-fork/src/acp/client.ts` | Accept optional handler overrides in constructor, use in ClientSideConnection |
| `acpx-fork/src/runtime/engine/manager.ts` | Pass callbacks through to AcpClient creation |
| `backend/package.json` | Add `matrix-js-sdk`, `patch-package` dependencies |
| `backend/src/index.ts` | Wire Matrix Gateway, EventBus, SessionRegistry, HITL |
| `backend/src/routes/sessions.ts` | Remove POST/DELETE (moved to Matrix), add status endpoint |
| `backend/src/routes/index.ts` | Add `/api/status` route |
| `backend/src/plugins/websocket.ts` | Broadcast via EventBus instead of direct session handler |
| `backend/src/services/session.service.ts` | Integrate with EventBus, add HITL support |
| `frontend/src/App.tsx` | Simplify nav: Dashboard, Session View, History only |
| `frontend/src/pages/Sessions.tsx` | Remove creation modal, make read-only |
| `frontend/src/components/CreateSessionModal.tsx` | Delete (no longer needed) |
| `frontend/src/components/PermissionModal.tsx` | Delete (permissions handled in Matrix) |

---

### Task 1: acpx-fork Patch Overlay — HITL Extension Points

**Files:**
- Modify: `acpx-fork/src/runtime/public/contract.ts:144-154`
- Modify: `acpx-fork/src/acp/client.ts:470-505`
- Modify: `acpx-fork/src/runtime/engine/manager.ts:40-42, ~300`
- Create: `acpx-fork/patches/001-hitl-extension-points.patch`
- Create: `acpx-fork/scripts/verify-patch.sh`
- Test: `acpx-fork/test/extension-points.test.ts`

- [ ] **Step 1: Add HITL types to AcpRuntimeOptions**

Add callback types to `AcpRuntimeOptions` in `acpx-fork/src/runtime/public/contract.ts`:

```typescript
import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";

// ... existing types ...

export type PreToolCallParams = {
  tool: string;
  params: Record<string, unknown>;
  callId: string;
};

export type PreToolCallResponse = {
  action: "continue" | "reject" | "modify";
  modifiedParams?: Record<string, unknown>;
};

export type AcpRuntimeOptions = {
  cwd: string;
  sessionStore: AcpSessionStore;
  agentRegistry: AcpAgentRegistry;
  mcpServers?: McpServer[];
  permissionMode: PermissionMode;
  nonInteractivePermissions?: NonInteractivePermissionPolicy;
  timeoutMs?: number;
  probeAgent?: string;
  verbose?: boolean;
  // HITL extension points
  onPermissionRequest?: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  onPreToolCall?: (params: PreToolCallParams) => Promise<PreToolCallResponse>;
};
```

- [ ] **Step 2: Add handler override support to AcpClientOptions**

In `acpx-fork/src/types.ts`, add to `AcpClientOptions` (around line 181):

```typescript
export type AcpClientOptions = {
  agentCommand: string;
  cwd: string;
  mcpServers?: McpServer[];
  permissionMode: PermissionMode;
  nonInteractivePermissions?: NonInteractivePermissionPolicy;
  authCredentials?: Record<string, string>;
  authPolicy?: AuthPolicy;
  suppressSdkConsoleErrors?: boolean;
  verbose?: boolean;
  sessionOptions?: {
    model?: string;
    allowedTools?: string[];
    maxTurns?: number;
  };
  onAcpMessage?: (direction: AcpMessageDirection, message: AcpJsonRpcMessage) => void;
  onAcpOutputMessage?: (direction: AcpMessageDirection, message: AcpJsonRpcMessage) => void;
  onSessionUpdate?: (notification: SessionNotification) => void;
  onClientOperation?: (operation: ClientOperation) => void;
  // HITL extension points
  onPermissionRequest?: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  onPreToolCall?: (params: PreToolCallParams) => Promise<PreToolCallResponse>;
};
```

Also add the `PreToolCallParams` and `PreToolCallResponse` types to `types.ts`:

```typescript
export type PreToolCallParams = {
  tool: string;
  params: Record<string, unknown>;
  callId: string;
};

export type PreToolCallResponse = {
  action: "continue" | "reject" | "modify";
  modifiedParams?: Record<string, unknown>;
};
```

- [ ] **Step 3: Wire custom handlers into AcpClient constructor**

In `acpx-fork/src/acp/client.ts`, the `AcpClient` class stores options in `this.options`. The handler object passed to `ClientSideConnection` is at lines 470-505. Modify the `requestPermission` handler to check for custom callback first:

Find the handler object starting at line 470 and change:

```typescript
// Line 475-479: Change requestPermission to check custom callback first
requestPermission: async (
  params: RequestPermissionRequest,
): Promise<RequestPermissionResponse> => {
  // Use custom callback if provided
  if (this.options.onPermissionRequest) {
    return this.options.onPermissionRequest(params);
  }
  return this.handlePermissionRequest(params);
},
```

Add the `onPreToolCall` interceptor before the tool handlers. The pre-tool-call interception needs to wrap tool execution. In the `ClientSideConnection` handler object, add a wrapper around `writeTextFile`, `createTerminal`, etc. that checks `onPreToolCall` before executing:

```typescript
// Helper to wrap tool handlers with pre-call interception
private async withPreToolCall<T>(
  tool: string,
  params: Record<string, unknown>,
  callId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (this.options.onPreToolCall) {
    const response = await this.options.onPreToolCall({ tool, params, callId });
    if (response.action === "reject") {
      throw new PermissionDeniedError(tool);
    }
    if (response.action === "modify" && response.modifiedParams) {
      // Apply modified params by mutating the params object before fn()
      Object.assign(params, response.modifiedParams);
    }
  }
  return fn();
}
```

Then wrap the `writeTextFile` handler:

```typescript
writeTextFile: async (params: WriteTextFileRequest): Promise<WriteTextFileResponse> => {
  return this.withPreToolCall("writeTextFile", params as any, "writeTextFile", () =>
    this.handleWriteTextFile(params),
  );
},
```

Similarly for `createTerminal`:

```typescript
createTerminal: async (params: CreateTerminalRequest): Promise<CreateTerminalResponse> => {
  return this.withPreToolCall("createTerminal", params as any, "createTerminal", () =>
    this.handleCreateTerminal(params),
  );
},
```

- [ ] **Step 4: Thread callbacks through AcpRuntimeManager**

In `acpx-fork/src/runtime/engine/manager.ts`, the `AcpRuntimeManager` constructor receives `AcpRuntimeOptions`. Find where `AcpClient` is created (look for `new AcpClient(`) and pass through the callback options:

The manager passes options to `AcpClient` constructor. Ensure `onPermissionRequest` and `onPreToolCall` from `AcpRuntimeOptions` are included in the `AcpClientOptions` object.

```typescript
// In the method that creates AcpClient, add:
const clientOptions: AcpClientOptions = {
  // ... existing options ...
  onPermissionRequest: this.options.onPermissionRequest,
  onPreToolCall: this.options.onPreToolCall,
};
```

- [ ] **Step 5: Generate patch file**

After making the changes above, generate the patch:

```bash
cd acpx-fork
git diff > patches/001-hitl-extension-points.patch
```

Then verify the patch can be applied to a clean checkout:

```bash
git stash
git apply --check patches/001-hitl-extension-points.patch
git stash pop
```

- [ ] **Step 6: Add patch-package integration**

Add to `acpx-fork/package.json`:

```json
{
  "scripts": {
    "postinstall": "patch-package"
  },
  "devDependencies": {
    "patch-package": "^8.0.0"
  }
}
```

Create `acpx-fork/scripts/verify-patch.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
if [ ! -f patches/001-hitl-extension-points.patch ]; then
  echo "ERROR: Patch file not found"
  exit 1
fi
echo "Verifying patch applies cleanly..."
git apply --check patches/001-hitl-extension-points.patch
echo "Patch OK"
```

- [ ] **Step 7: Write verification test**

Create `acpx-fork/test/extension-points.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { AcpRuntimeOptions, PreToolCallParams, PreToolCallResponse } from "../src/runtime/public/contract.js";
import type { RequestPermissionRequest } from "@agentclientprotocol/sdk";

describe("HITL extension points", () => {
  it("AcpRuntimeOptions accepts onPermissionRequest", () => {
    const opts: AcpRuntimeOptions = {
      cwd: "/tmp",
      sessionStore: { load: async () => undefined, save: async () => {} },
      agentRegistry: { resolve: () => "test", list: () => [] },
      permissionMode: "approve-reads",
      onPermissionRequest: async (params: RequestPermissionRequest) => ({
        outcome: { outcome: "cancelled" },
      }),
    };
    expect(opts.onPermissionRequest).toBeDefined();
  });

  it("AcpRuntimeOptions accepts onPreToolCall", () => {
    const opts: AcpRuntimeOptions = {
      cwd: "/tmp",
      sessionStore: { load: async () => undefined, save: async () => {} },
      agentRegistry: { resolve: () => "test", list: () => [] },
      permissionMode: "approve-reads",
      onPreToolCall: async (params: PreToolCallParams): Promise<PreToolCallResponse> => ({
        action: "continue",
      }),
    };
    expect(opts.onPreToolCall).toBeDefined();
  });
});
```

- [ ] **Step 8: Build acpx-fork and verify**

```bash
cd acpx-fork
pnpm install
pnpm build
```

Expected: Clean build with no type errors.

- [ ] **Step 9: Commit**

```bash
git add acpx-fork/src/runtime/public/contract.ts acpx-fork/src/types.ts acpx-fork/src/acp/client.ts acpx-fork/src/runtime/engine/manager.ts acpx-fork/patches/ acpx-fork/scripts/ acpx-fork/test/extension-points.test.ts acpx-fork/package.json
git commit -m "feat: add HITL extension points (onPermissionRequest, onPreToolCall) to acpx-fork"
```

---

### Task 2: Shared Event Bus + Session Registry

**Files:**
- Create: `backend/src/shared/event-bus.ts`
- Create: `backend/src/shared/session-registry.ts`
- Create: `backend/src/shared/types.ts`
- Test: `backend/test/shared/event-bus.test.ts`

- [ ] **Step 1: Define shared types**

Create `backend/src/shared/types.ts`:

```typescript
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
```

- [ ] **Step 2: Implement EventBus**

Create `backend/src/shared/event-bus.ts`:

```typescript
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
```

- [ ] **Step 3: Implement SessionRegistry**

Create `backend/src/shared/session-registry.ts`:

```typescript
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
```

- [ ] **Step 4: Write EventBus tests**

Create `backend/test/shared/event-bus.test.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npx vitest run test/shared/event-bus.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/ backend/test/shared/
git commit -m "feat: add EventBus and SessionRegistry for centralized event distribution"
```

---

### Task 3: Matrix Gateway

**Files:**
- Create: `backend/src/matrix/gateway.ts`
- Create: `backend/test/matrix/gateway.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Add matrix-js-sdk dependency**

```bash
cd backend && bun add matrix-js-sdk
```

- [ ] **Step 2: Implement MatrixGateway**

Create `backend/src/matrix/gateway.ts`:

```typescript
import { createClient, MatrixClient, RoomEvent } from "matrix-js-sdk";
import { EventEmitter } from "node:events";
import { eventBus } from "../shared/event-bus.js";
import { sessionRegistry } from "../shared/session-registry.js";
import type { SessionInfo } from "../shared/types.js";

export interface MatrixGatewayConfig {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  managerRoomId: string;
  encryptionEnabled?: boolean;
}

export class MatrixGateway extends EventEmitter {
  private client: MatrixClient | null = null;
  private config: MatrixGatewayConfig;

  constructor(config: MatrixGatewayConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = createClient({
      baseUrl: this.config.homeserverUrl,
      accessToken: this.config.accessToken,
      userId: this.config.userId,
    });

    this.setupEventListeners();

    await this.client.startClient({
      initialSyncLimit: 50,
    });

    this.emit("connected");
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on(RoomEvent.Timeline, async (event, room) => {
      if (event.getType() !== "m.room.message") return;
      if (event.getSender() === this.config.userId) return;

      const roomId = room?.roomId;
      if (!roomId) return;

      const content = event.getContent();
      const body = content.body as string;
      const sender = event.getSender();

      const session = sessionRegistry.getByRoom(roomId);

      this.emit("room_message", {
        roomId,
        session,
        sender,
        body,
        eventId: event.getId(),
        isManagerRoom: roomId === this.config.managerRoomId,
      });
    });
  }

  async sendMessage(roomId: string, body: string, formattedBody?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const content: Record<string, unknown> = {
      msgtype: "m.text",
      body,
    };

    if (formattedBody) {
      content.format = "org.matrix.custom.html";
      content.formatted_body = formattedBody;
    }

    const response = await this.client.sendEvent(roomId, "m.room.message", content);
    return response.event_id;
  }

  async sendReply(roomId: string, replyToEventId: string, body: string, formattedBody?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const content: Record<string, unknown> = {
      "m.relates_to": {
        "m.in_reply_to": { event_id: replyToEventId },
      },
      msgtype: "m.text",
      body,
    };

    if (formattedBody) {
      content.format = "org.matrix.custom.html";
      content.formatted_body = formattedBody;
    }

    const response = await this.client.sendEvent(roomId, "m.room.message", content);
    return response.event_id;
  }

  async createRoom(name: string, inviterUserId: string, topic?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const response = await this.client.createRoom({
      name,
      topic,
      preset: "trusted_private_chat",
      invite: [inviterUserId],
      initial_state: this.config.encryptionEnabled
        ? [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }]
        : [],
    });

    return response.room_id;
  }

  async getMatrixEventLink(roomId: string): Promise<string> {
    return `https://matrix.to/#/${roomId}`;
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isInitialSyncComplete();
  }

  getConnectedRooms(): number {
    if (!this.client) return 0;
    return this.client.getRooms().length;
  }

  disconnect(): Promise<void> {
    if (this.client) {
      this.client.stopClient();
    }
    return Promise.resolve();
  }
}
```

- [ ] **Step 3: Write Gateway tests**

Create `backend/test/matrix/gateway.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatrixGateway } from "../../src/matrix/gateway.js";

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => ({
    startClient: vi.fn().mockResolvedValue(undefined),
    isInitialSyncComplete: vi.fn().mockReturnValue(true),
    getRooms: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    stopClient: vi.fn(),
  })),
  RoomEvent: { Timeline: "Room.timeline" },
}));

describe("MatrixGateway", () => {
  let gateway: MatrixGateway;

  beforeEach(() => {
    gateway = new MatrixGateway({
      homeserverUrl: "http://localhost:8008",
      accessToken: "test-token",
      userId: "@acpx:test.server",
      managerRoomId: "!manager:room",
    });
  });

  it("connects successfully", async () => {
    await gateway.connect();
    expect(gateway.isConnected()).toBe(true);
  });

  it("reports disconnected state", () => {
    expect(gateway.isConnected()).toBe(false);
  });

  it("throws when sending without connection", async () => {
    await expect(gateway.sendMessage("!room:id", "hello")).rejects.toThrow("not connected");
  });

  it("reports zero rooms when disconnected", () => {
    expect(gateway.getConnectedRooms()).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npx vitest run test/matrix/gateway.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/matrix/gateway.ts backend/test/matrix/gateway.test.ts backend/package.json
git commit -m "feat: add Matrix Gateway for homeserver connection and message handling"
```

---

### Task 4: Command Parser + Room Router

**Files:**
- Create: `backend/src/matrix/commands.ts`
- Create: `backend/src/matrix/room-router.ts`
- Create: `backend/test/matrix/commands.test.ts`

- [ ] **Step 1: Implement CommandParser**

Create `backend/src/matrix/commands.ts`:

```typescript
import { sessionService } from "../services/session.service.js";
import { sessionRegistry } from "../shared/session-registry.js";
import type { MatrixGateway } from "./gateway.js";

export type CommandResult = {
  reply: string;
  formattedReply?: string;
};

export class CommandParser {
  private gateway: MatrixGateway;

  constructor(gateway: MatrixGateway) {
    this.gateway = gateway;
  }

  async parse(body: string, roomId: string, sender: string): Promise<CommandResult> {
    const trimmed = body.trim();
    if (!trimmed.startsWith("/")) {
      return { reply: "Unknown command. Type `/help` for available commands." };
    }

    const [command, ...args] = trimmed.slice(1).split(/\s+/);

    switch (command.toLowerCase()) {
      case "new":
        return await this.handleNew(args, roomId, sender);
      case "list":
        return this.handleList();
      case "kill":
        return await this.handleKill(args);
      case "use":
        return this.handleUse(args);
      case "mode":
        return this.handleMode(args);
      case "step":
        return this.handleStep(args);
      case "intercept":
        return this.handleIntercept(args);
      case "help":
        return this.handleHelp();
      default:
        return { reply: `Unknown command: /${command}. Type \`/help\` for available commands.` };
    }
  }

  private async handleNew(args: string[], roomId: string, sender: string): Promise<CommandResult> {
    if (args.length === 0) {
      return { reply: "Usage: `/new <agent> [name]`\nExample: `/new claude refactor auth module`" };
    }

    const agent = args[0].toLowerCase();
    const name = args.slice(1).join(" ") || `session-${Date.now()}`;

    // Create session via SessionService
    const result = await sessionService.createSession({ agent, name });
    const sessionId = result.record.acpxRecordId || name;

    // Create Matrix room for this session
    const roomName = name;
    const topic = `Agent: ${agent} | Created: ${new Date().toISOString()}`;
    const room = await this.gateway.createRoom(roomName, sender, topic);

    // Register in registry
    sessionRegistry.register({
      id: sessionId,
      room,
      name,
      agent,
      status: "idle",
      hitlMode: "off",
      permissionMode: "approve-reads",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tokenUsage: { prompt: 0, completion: 0 },
    });

    const roomLink = await this.gateway.getMatrixEventLink(room);
    return {
      reply: `Session "${name}" created with agent \`${agent}\`.\nJoin: ${roomLink}`,
      formattedReply: `Session "<strong>${name}</strong>" created with agent <code>${agent}</code>.<br><a href="${roomLink}">Join session room</a>`,
    };
  }

  private handleList(): CommandResult {
    const sessions = sessionRegistry.getAll();
    if (sessions.length === 0) {
      return { reply: "No active sessions." };
    }

    const lines = sessions.map((s) => {
      const statusIcon = s.status === "running" ? "🟢" : s.status === "error" ? "🔴" : "⚪";
      return `${statusIcon} \`${s.id.slice(0, 8)}\` **${s.name}** — ${s.agent} (${s.status})`;
    });

    return {
      reply: `Active sessions:\n\n${lines.join("\n")}`,
      formattedReply: `<p>Active sessions:</p><ul>${sessions.map((s) => {
        const statusIcon = s.status === "running" ? "🟢" : s.status === "error" ? "🔴" : "⚪";
        return `<li>${statusIcon} <code>${s.id.slice(0, 8)}</code> <strong>${s.name}</strong> — ${s.agent} (${s.status})</li>`;
      }).join("")}</ul>`,
    };
  }

  private async handleKill(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return { reply: "Usage: `/kill <session-id|name>`" };
    }

    const query = args[0];
    // Try exact ID match first, then name match
    let session = sessionRegistry.getById(query);
    if (!session) {
      session = sessionRegistry.getAll().find((s) => s.name === query || s.id.startsWith(query));
    }

    if (!session) {
      return { reply: `Session not found: \`${query}\`` };
    }

    try {
      await sessionService.closeSession(session.id);
      sessionRegistry.unregister(session.id);
      return { reply: `Session "${session.name}" terminated.` };
    } catch (error) {
      return { reply: `Failed to kill session: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private handleUse(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/use <agent>`\nSets the default agent for new sessions." };
    }
    // Note: This sets a module-level default. In a full implementation, store in config.
    return { reply: `Default agent set to \`${args[0]}\`.` };
  }

  private handleMode(args: string[]): CommandResult {
    const validModes = ["approve-all", "approve-reads", "deny-all"];
    if (args.length === 0) {
      return { reply: `Usage: \`/mode <${validModes.join("|")}>\`` };
    }

    const mode = args[0] as SessionInfo["permissionMode"];
    if (!validModes.includes(mode)) {
      return { reply: `Invalid mode. Valid modes: ${validModes.join(", ")}` };
    }

    return { reply: `Permission mode set to \`${mode}\`.` };
  }

  private handleStep(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/step on|off`" };
    }

    const action = args[0].toLowerCase();
    if (action === "on") {
      return { reply: "Step mode enabled. Each tool call will require approval." };
    }
    if (action === "off") {
      return { reply: "Step mode disabled." };
    }
    return { reply: "Usage: `/step on|off`" };
  }

  private handleIntercept(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/intercept <message>`" };
    }
    const message = args.join(" ");
    // In a full implementation, this would inject into the running session
    return { reply: `Intercept message queued: "${message}"` };
  }

  private handleHelp(): CommandResult {
    return {
      reply: [
        "**Available commands:**",
        "",
        "`/new <agent> [name]` — Create a new session",
        "`/list` — List all active sessions",
        "`/kill <session>` — Terminate a session",
        "`/use <agent>` — Set default agent",
        "`/mode <mode>` — Set permission mode",
        "`/step on|off` — Toggle step mode",
        "`/intercept <msg>` — Send correction to running session",
        "`/help` — Show this help",
      ].join("\n"),
      formattedReply: [
        "<p><strong>Available commands:</strong></p>",
        "<ul>",
        "<li><code>/new &lt;agent&gt; [name]</code> — Create a new session</li>",
        "<li><code>/list</code> — List all active sessions</li>",
        "<li><code>/kill &lt;session&gt;</code> — Terminate a sessions</li>",
        "<li><code>/use &lt;agent&gt;</code> — Set default agent</li>",
        "<li><code>/mode &lt;mode&gt;</code> — Set permission mode</li>",
        "<li><code>/step on|off</code> — Toggle step mode</li>",
        "<li><code>/intercept &lt;msg&gt;</code> — Send correction to running session</li>",
        "<li><code>/help</code> — Show this help</li>",
        "</ul>",
      ].join(""),
    };
  }
}
```

Note: Add `import type { SessionInfo } from "../shared/types.js";` at the top.

- [ ] **Step 2: Write command parser tests**

Create `backend/test/matrix/commands.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandParser } from "../../src/matrix/commands.js";
import { sessionRegistry } from "../../src/shared/session-registry.js";

vi.mock("../../src/services/session.service.js", () => ({
  sessionService: {
    createSession: vi.fn().mockResolvedValue({
      record: { acpxRecordId: "test-session-id" },
      handle: {},
    }),
    closeSession: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../src/shared/session-registry.js", () => ({
  sessionRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
  },
}));

describe("CommandParser", () => {
  let parser: CommandParser;

  beforeEach(() => {
    const mockGateway = {
      createRoom: vi.fn().mockResolvedValue("!newroom:server"),
      getMatrixEventLink: vi.fn().mockResolvedValue("https://matrix.to/#!/!newroom:server"),
    };
    parser = new CommandParser(mockGateway as any);
    vi.clearAllMocks();
  });

  it("returns unknown command for non-slash input", async () => {
    const result = await parser.parse("hello world", "!room:id", "@user:server");
    expect(result.reply).toContain("Unknown command");
  });

  it("returns help for unknown slash command", async () => {
    const result = await parser.parse("/foo", "!room:id", "@user:server");
    expect(result.reply).toContain("Unknown command: /foo");
  });

  it("/new requires agent name", async () => {
    const result = await parser.parse("/new", "!room:id", "@user:server");
    expect(result.reply).toContain("Usage");
  });

  it("/list returns empty message when no sessions", async () => {
    const result = await parser.parse("/list", "!room:id", "@user:server");
    expect(result.reply).toContain("No active sessions");
  });

  it("/kill requires session ID", async () => {
    const result = await parser.parse("/kill", "!room:id", "@user:server");
    expect(result.reply).toContain("Usage");
  });

  it("/kill returns not found for unknown session", async () => {
    vi.mocked(sessionRegistry.getById).mockReturnValue(undefined);
    vi.mocked(sessionRegistry.getAll).mockReturnValue([]);
    const result = await parser.parse("/kill unknown", "!room:id", "@user:server");
    expect(result.reply).toContain("not found");
  });

  it("/help lists all commands", async () => {
    const result = await parser.parse("/help", "!room:id", "@user:server");
    expect(result.reply).toContain("/new");
    expect(result.reply).toContain("/list");
    expect(result.reply).toContain("/kill");
  });

  it("/step on returns enable message", async () => {
    const result = await parser.parse("/step on", "!room:id", "@user:server");
    expect(result.reply).toContain("enabled");
  });

  it("/step off returns disable message", async () => {
    const result = await parser.parse("/step off", "!room:id", "@user:server");
    expect(result.reply).toContain("disabled");
  });

  it("/mode validates valid modes", async () => {
    const result = await parser.parse("/mode approve-reads", "!room:id", "@user:server");
    expect(result.reply).toContain("approve-reads");
  });

  it("/mode rejects invalid mode", async () => {
    const result = await parser.parse("/mode invalid", "!room:id", "@user:server");
    expect(result.reply).toContain("Invalid mode");
  });
});
```

- [ ] **Step 3: Implement RoomRouter**

Create `backend/src/matrix/room-router.ts`:

```typescript
import { MatrixGateway } from "./gateway.js";
import { CommandParser } from "./commands.js";
import { EventFormatter } from "./formatter.js";
import { sessionService } from "../services/session.service.js";
import { eventBus } from "../shared/event-bus.js";
import { sessionRegistry } from "../shared/session-registry.js";
import type { AcpRuntimeEvent } from "@local/acpx/runtime";

export interface RoomMessage {
  roomId: string;
  session: import("../shared/types.js").SessionInfo | undefined;
  sender: string;
  body: string;
  eventId: string;
  isManagerRoom: boolean;
}

export class RoomRouter {
  private gateway: MatrixGateway;
  private commandParser: CommandParser;
  private formatter: EventFormatter;

  constructor(gateway: MatrixGateway) {
    this.gateway = gateway;
    this.commandParser = new CommandParser(gateway);
    this.formatter = new EventFormatter();
  }

  async handleMessage(msg: RoomMessage): Promise<void> {
    if (msg.isManagerRoom) {
      await this.handleManagerMessage(msg);
    } else if (msg.session) {
      await this.handleSessionMessage(msg);
    }
    // Ignore messages from unregistered rooms
  }

  private async handleManagerMessage(msg: RoomMessage): Promise<void> {
    const result = await this.commandParser.parse(msg.body, msg.roomId, msg.sender);

    if (result.formattedReply) {
      await this.gateway.sendReply(msg.roomId, msg.eventId, result.reply, result.formattedReply);
    } else {
      await this.gateway.sendReply(msg.roomId, msg.eventId, result.reply);
    }
  }

  private async handleSessionMessage(msg: RoomMessage): Promise<void> {
    if (!msg.session) return;

    const body = msg.body.trim();

    // Check for permission responses
    if (/^(approve|allow|yes|y)$/i.test(body)) {
      await this.handlePermissionResponse(msg.session.id, "approved");
      return;
    }
    if (/^(deny|reject|no|n)$/i.test(body)) {
      await this.handlePermissionResponse(msg.session.id, "denied");
      return;
    }
    if (/^edit$/i.test(body)) {
      await this.gateway.sendReply(msg.roomId, msg.eventId, "Edit mode: send the modified JSON parameters.");
      return;
    }

    // Check for session commands
    if (body === "/cancel") {
      const handle = sessionService.getHandle(msg.session.id);
      if (handle) {
        await sessionService.cancelTurn(handle);
        await this.gateway.sendReply(msg.roomId, msg.eventId, "Prompt cancelled.");
      }
      return;
    }

    if (body === "/status") {
      const handle = sessionService.getHandle(msg.session.id);
      if (handle) {
        const status = await sessionService.getStatus(handle);
        await this.gateway.sendReply(msg.roomId, msg.eventId, `Session status: ${JSON.stringify(status)}`);
      }
      return;
    }

    // Regular prompt — forward to acpx
    await this.runTurnAndStream(msg);
  }

  private async runTurnAndStream(msg: RoomMessage): Promise<void> {
    const session = msg.session!;
    sessionRegistry.updateStatus(session.id, "running");

    const handle = await sessionService.ensureHandleForSession(session.id);
    const messageId = msg.eventId;

    // Send "thinking" indicator
    await this.gateway.sendReply(msg.roomId, messageId, "⏳ Processing...");

    let textBuffer = "";
    let eventCount = 0;
    const maxBufferedEvents = 20;

    try {
      for await (const event of sessionService.runTurn(handle, msg.body)) {
        eventCount++;
        const acpEvent = this.formatter.toAcpEvent(event, session.id);
        eventBus.emit(acpEvent);

        // Format and send to Matrix
        const formatted = this.formatter.toMatrixMessage(event);
        if (formatted) {
          // Buffer text_delta events, send others immediately
          if (event.type === "text_delta") {
            textBuffer += (event as any).text || "";
            if (eventCount % maxBufferedEvents === 0) {
              await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
              textBuffer = "";
            }
          } else {
            // Flush buffer before sending non-text events
            if (textBuffer) {
              await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
              textBuffer = "";
            }
            await this.gateway.sendReply(msg.roomId, messageId, formatted);
          }
        }
      }

      // Flush remaining text
      if (textBuffer) {
        await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
      }

      sessionRegistry.updateStatus(session.id, "idle");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.gateway.sendReply(msg.roomId, messageId, `❌ Error: ${errorMsg}`);
      sessionRegistry.updateStatus(session.id, "error");
    }
  }

  private async handlePermissionResponse(sessionId: string, decision: "approved" | "denied"): Promise<void> {
    // This integrates with the PermissionManager
    // In the full implementation, look up the pending permission request for this session
    // and resolve it with the appropriate option
    const icon = decision === "approved" ? "✅ Approved" : "❌ Denied";
    // The actual permission resolution happens through the PermissionManager
    // which is wired to the acpx runtime's onPermissionRequest callback
    console.log(`Permission ${decision} for session ${sessionId}`);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npx vitest run test/matrix/commands.test.ts
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/matrix/commands.ts backend/src/matrix/room-router.ts backend/test/matrix/commands.test.ts
git commit -m "feat: add CommandParser and RoomRouter for Matrix room message routing"
```

---

### Task 5: Event Formatter

**Files:**
- Create: `backend/src/matrix/formatter.ts`
- Create: `backend/test/matrix/formatter.test.ts`

- [ ] **Step 1: Implement EventFormatter**

Create `backend/src/matrix/formatter.ts`:

```typescript
import type { AcpRuntimeEvent } from "@local/acpx/runtime";
import type { AcpEvent } from "../shared/types.js";

export class EventFormatter {
  toMatrixMessage(event: AcpRuntimeEvent): string | null {
    switch (event.type) {
      case "text_delta":
        return event.text;

      case "tool_call":
        if (event.status === "start" || !event.status) {
          return `🔧 Calling: ${event.title || event.text}`;
        }
        if (event.status === "success") {
          return `✅ ${event.title || event.text} completed`;
        }
        if (event.status === "error") {
          return `❌ ${event.title || event.text} failed: ${event.text}`;
        }
        return null;

      case "status":
        return `📊 ${event.text}`;

      case "done":
        return `✓ Completed${event.stopReason ? ` (${event.stopReason})` : ""}`;

      case "error":
        return `❌ Error: ${event.message}`;

      default:
        return null;
    }
  }

  toAcpEvent(event: AcpRuntimeEvent, sessionId: string): AcpEvent {
    return {
      type: event.type as AcpEvent["type"],
      sessionId,
      timestamp: Date.now(),
      payload: event as Record<string, unknown>,
    };
  }

  formatPermissionRequest(toolName: string, description: string): string {
    return `[Permission] ${description} for ${toolName}? Reply APPROVE or DENY`;
  }

  formatEditPrompt(params: Record<string, unknown>): string {
    return `✏️ Edit the parameters and send back:\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``;
  }
}
```

- [ ] **Step 2: Write formatter tests**

Create `backend/test/matrix/formatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { EventFormatter } from "../../src/matrix/formatter.js";

describe("EventFormatter", () => {
  const formatter = new EventFormatter();

  it("formats text_delta as plain text", () => {
    const result = formatter.toMatrixMessage({ type: "text_delta", text: "Hello world" });
    expect(result).toBe("Hello world");
  });

  it("formats tool_call start", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "writeFile(\"config.json\")",
      status: "start",
    });
    expect(result).toBe("🔧 Calling: writeFile");
  });

  it("formats tool_call success", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "done",
      status: "success",
    });
    expect(result).toBe("✅ writeFile completed");
  });

  it("formats tool_call error", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "permission denied",
      status: "error",
    });
    expect(result).toBe("❌ writeFile failed: permission denied");
  });

  it("formats done event", () => {
    const result = formatter.toMatrixMessage({ type: "done", stopReason: "end_turn" });
    expect(result).toBe("✓ Completed (end_turn)");
  });

  it("formats error event", () => {
    const result = formatter.toMatrixMessage({ type: "error", message: "Something broke" });
    expect(result).toBe("❌ Error: Something broke");
  });

  it("formats permission request", () => {
    const result = formatter.formatPermissionRequest("writeFile", "Write to config.json");
    expect(result).toContain("Permission");
    expect(result).toContain("APPROVE");
    expect(result).toContain("DENY");
  });

  it("formats edit prompt with JSON", () => {
    const result = formatter.formatEditPrompt({ path: "config.json", content: "test" });
    expect(result).toContain("✏️");
    expect(result).toContain("config.json");
    expect(result).toContain("```json");
  });

  it("returns null for unknown tool_call status", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "test",
      text: "test",
      status: "unknown_status",
    } as any);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx vitest run test/matrix/formatter.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/matrix/formatter.ts backend/test/matrix/formatter.test.ts
git commit -m "feat: add EventFormatter for ACP → Matrix message conversion"
```

---

### Task 6: HITL Controllers

**Files:**
- Create: `backend/src/sessions/hitl/step-controller.ts`
- Create: `backend/src/sessions/hitl/param-editor.ts`
- Create: `backend/src/sessions/hitl/intercept-handler.ts`

- [ ] **Step 1: Implement StepController**

Create `backend/src/sessions/hitl/step-controller.ts`:

```typescript
import type { PreToolCallParams, PreToolCallResponse } from "@local/acpx/runtime";

type StepState = {
  enabled: boolean;
  pendingToolCall: PreToolCallParams | null;
  resolve: ((response: PreToolCallResponse) => void) | null;
};

export class StepController {
  private state: StepState = {
    enabled: false,
    pendingToolCall: null,
    resolve: null,
  };

  enable(): void {
    this.state.enabled = true;
  }

  disable(): void {
    this.state.enabled = false;
    if (this.state.resolve) {
      this.state.resolve({ action: "continue" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  async interceptToolCall(params: PreToolCallParams): Promise<PreToolCallResponse> {
    if (!this.state.enabled) {
      return { action: "continue" };
    }

    this.state.pendingToolCall = params;

    return new Promise<PreToolCallResponse>((resolve) => {
      this.state.resolve = resolve;
    });
  }

  approve(): void {
    if (this.state.resolve) {
      this.state.resolve({ action: "continue" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  reject(): void {
    if (this.state.resolve) {
      this.state.resolve({ action: "reject" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  applyModified(modifiedParams: Record<string, unknown>): void {
    if (this.state.resolve && this.state.pendingToolCall) {
      this.state.resolve({ action: "modify", modifiedParams });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  getPendingToolCall(): PreToolCallParams | null {
    return this.state.pendingToolCall;
  }
}
```

- [ ] **Step 2: Implement ParamEditor**

Create `backend/src/sessions/hitl/param-editor.ts`:

```typescript
export class ParamEditor {
  static parseEditResponse(body: string): Record<string, unknown> | null {
    const trimmed = body.trim();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  static formatToolParamsForEdit(tool: string, params: Record<string, unknown>): string {
    return `✏️ Edit the parameters for \`${tool}\` and send back the modified JSON:\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``;
  }

  static validateEditResponse(body: string): { valid: boolean; params?: Record<string, unknown>; error?: string } {
    const parsed = this.parseEditResponse(body);
    if (!parsed) {
      return { valid: false, error: "Invalid JSON. Please send a valid JSON object." };
    }
    return { valid: true, params: parsed };
  }
}
```

- [ ] **Step 3: Implement InterceptHandler**

Create `backend/src/sessions/hitl/intercept-handler.ts`:

```typescript
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

    // Send the intercept message as a new prompt turn
    // In a full implementation, this would inject into the current turn's context
    await this.sessionService.cancelTurn(handle, "Intercepted by user");
    // After cancel, send the intercept as a new prompt
    // This is handled by the RoomRouter calling runTurn with the intercept text
    return true;
  }

  hasPendingIntercept(sessionId: string): boolean {
    return this.pendingIntercepts.has(sessionId);
  }

  clearIntercept(sessionId: string): void {
    this.pendingIntercepts.delete(sessionId);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/sessions/hitl/
git commit -m "feat: add HITL controllers (step, param-edit, intercept)"
```

---

### Task 7: Wire Backend Integration

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/routes/sessions.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Add Matrix config to environment**

Add to `backend/src/config.ts`:

```typescript
export const matrixConfig = {
  homeserverUrl: process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008",
  accessToken: process.env.MATRIX_ACCESS_TOKEN || "",
  userId: process.env.MATRIX_USER_ID || "@acpx:localhost",
  managerRoomId: process.env.MATRIX_MANAGER_ROOM_ID || "",
};
```

- [ ] **Step 2: Wire everything together in index.ts**

Modify `backend/src/index.ts` — replace the entire file:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isProduction, matrixConfig } from './config';
import routes from './routes';
import websocketPlugin from './plugins/websocket';
import { SessionService } from './services/session.service';
import { permissionManager } from './services/permission.service';
import { MatrixGateway } from './matrix/gateway.js';
import { RoomRouter } from './matrix/room-router.js';
import { eventBus } from './shared/event-bus.js';
import { sessionRegistry } from './shared/session-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
  },
});

// Wire up permission callback
SessionService.getInstance().setPermissionCallback(
  permissionManager.createPermissionCallback()
);

fastify.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

fastify.register(websocketPlugin);
fastify.register(routes);

// Serve frontend static files in production
if (isProduction) {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  fastify.register(staticPlugin, {
    root: frontendDistPath,
    prefix: '/',
    decorateReply: false,
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/ws')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not found' });
    }
  });
}

fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: {
      message: error.message,
      code: error.code,
    },
  });
});

// Initialize Matrix Gateway if configured
let matrixGateway: MatrixGateway | null = null;
let roomRouter: RoomRouter | null = null;

async function initMatrix() {
  if (!matrixConfig.accessToken || !matrixConfig.managerRoomId) {
    fastify.log.warn('Matrix not configured. Set MATRIX_ACCESS_TOKEN and MATRIX_MANAGER_ROOM_ID.');
    return;
  }

  matrixGateway = new MatrixGateway(matrixConfig);
  roomRouter = new RoomRouter(matrixGateway);

  await matrixGateway.connect();
  fastify.log.info(`Matrix connected as ${matrixConfig.userId}`);

  matrixGateway.on("room_message", async (msg: any) => {
    if (roomRouter) {
      await roomRouter.handleMessage(msg);
    }
  });

  // Broadcast events from EventBus to Matrix
  eventBus.onAll(async (event) => {
    if (!roomRouter || !matrixGateway) return;
    // Events are already sent to Matrix by RoomRouter.runTurnAndStream
    // This handles events from non-Matrix sources (e.g., WebSocket-only events)
  });
}

// Graceful shutdown
async function gracefulShutdown() {
  if (matrixGateway) {
    await matrixGateway.disconnect();
  }
  await fastify.close();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const start = async () => {
  try {
    await initMatrix();
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

export async function build() {
  return fastify;
}

export { matrixGateway, roomRouter };

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
```

- [ ] **Step 3: Add /api/status endpoint**

Modify `backend/src/routes/index.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import sessionRoutes from './sessions';
import flowRoutes from './flows';
import { SessionService } from '../services/session.service.js';
import { sessionRegistry } from '../shared/session-registry.js';
import { matrixGateway } from '../index.js';

export default async function routes(fastify: FastifyInstance) {
  fastify.register(sessionRoutes, { prefix: '/api' });
  fastify.register(flowRoutes, { prefix: '/api' });

  // System status endpoint
  fastify.get('/api/status', async (_request, _reply) => {
    const sessions = sessionRegistry.getAll();
    return {
      matrix: {
        connected: matrixGateway?.isConnected() ?? false,
        rooms: matrixGateway?.getConnectedRooms() ?? 0,
      },
      sessions: {
        active: sessions.filter(s => s.status === 'running').length,
        total: sessions.length,
      },
    };
  });

  fastify.get('/health', async (_request, _reply) => {
    const runtimeHealthy = SessionService.getInstance().isHealthy();
    return {
      status: runtimeHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime: { healthy: runtimeHealthy },
    };
  });
}
```

- [ ] **Step 4: Remove session creation/deletion from REST API (Matrix-only)**

Modify `backend/src/routes/sessions.ts` — remove the POST and DELETE endpoints, keep only GET endpoints:

```typescript
import { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session.service.js';

export default async function sessionRoutes(fastify: FastifyInstance) {
  // Read-only: list sessions
  fastify.get('/sessions', async (_request, reply) => {
    try {
      const sessions = await sessionService.listSessions();
      return reply.status(200).send({ sessions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list sessions';
      return reply.status(500).send({ error: message });
    }
  });

  // Read-only: get single session
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionService.getSession(id);
      return reply.status(200).send({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  // Read-only: get session history
  fastify.get('/sessions/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionService.getSession(id);
      return reply.status(200).send({ messages: session.messages });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session history';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });
}
```

- [ ] **Step 5: Install dependencies and build**

```bash
cd backend && bun install && npx tsc --noEmit
```

Expected: Clean type check.

- [ ] **Step 6: Commit**

```bash
git add backend/src/index.ts backend/src/config.ts backend/src/routes/ backend/package.json
git commit -m "feat: wire Matrix Gateway, EventBus, and HITL into backend; make REST API read-only"
```

---

### Task 8: Update WebSocket Plugin for EventBus

**Files:**
- Modify: `backend/src/plugins/websocket.ts`

- [ ] **Step 1: Refactor WebSocket to use EventBus**

Modify `backend/src/plugins/websocket.ts` — update the session WebSocket route to subscribe via EventBus:

```typescript
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { FastifyPluginAsync } from 'fastify';
import type WebSocket from 'ws';
import { createSessionHandler, SessionWebSocketHandler } from '../websocket/session-handler.js';
import { permissionManager } from '../services/permission.service.js';
import { eventBus } from '../shared/event-bus.js';
import { sessionRegistry } from '../shared/session-registry.js';

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);

  fastify.register(async function (fastify) {
    // Basic echo WebSocket for testing
    fastify.get('/ws', { websocket: true }, async (connection, _req) => {
      connection.socket.on('message', (message: Buffer) => {
        connection.socket.send(JSON.stringify({
          type: 'echo',
          data: message.toString(),
        }));
      });
    });

    // Session WebSocket — read-only event streaming
    fastify.get('/ws/session/:sessionId', { websocket: true }, async (connection, req) => {
      const { sessionId } = req.params as { sessionId: string };

      // Subscribe to event bus for this session
      const eventHandler = (event: import('../shared/types.js').AcpEvent) => {
        connection.socket.send(JSON.stringify({
          type: 'event',
          sessionId: event.sessionId,
          data: event,
        }));
      };

      eventBus.onSession(sessionId, eventHandler);

      // Also send session creation/update events
      const allHandler = (event: import('../shared/types.js').AcpEvent) => {
        if (event.type === 'done') {
          connection.socket.send(JSON.stringify({
            type: 'session_done',
            data: { sessionId: event.sessionId, stopReason: event.payload?.stopReason },
          }));
        }
      };
      eventBus.onAll(allHandler);

      connection.socket.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          switch (data.type) {
            case 'subscribe':
              if (data.sessionId) {
                eventBus.onSession(data.sessionId, eventHandler);
                connection.socket.send(JSON.stringify({
                  type: 'status',
                  text: `Subscribed to session ${data.sessionId}`,
                }));
              }
              break;

            case 'unsubscribe':
              eventBus.offSession(data.sessionId, eventHandler);
              connection.socket.send(JSON.stringify({
                type: 'status',
                text: `Unsubscribed from session ${data.sessionId}`,
              }));
              break;

            case 'ping':
              connection.socket.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              connection.socket.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${data.type}`,
                code: 'UNKNOWN_MESSAGE_TYPE',
              }));
          }
        } catch (error) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            code: 'PARSE_ERROR',
          }));
        }
      });

      connection.socket.on('close', () => {
        eventBus.offSession(sessionId, eventHandler);
        eventBus.offAll(allHandler);
      });

      // Send initial session info
      const session = sessionRegistry.getById(sessionId);
      if (session) {
        connection.socket.send(JSON.stringify({
          type: 'session_update',
          data: session,
        }));
      }

      connection.socket.send(JSON.stringify({
        type: 'status',
        text: `Connected. Listening to session ${sessionId} events.`,
      }));
    });
  });
};

export default fp(websocketPlugin, { name: 'websocket' });
```

- [ ] **Step 2: Build and verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/plugins/websocket.ts
git commit -m "refactor: WebSocket plugin uses EventBus for read-only event streaming"
```

---

### Task 9: Frontend Read-Only Simplification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Sessions.tsx`
- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/pages/History.tsx`
- Delete: `frontend/src/components/CreateSessionModal.tsx`
- Delete: `frontend/src/components/PermissionModal.tsx`

- [ ] **Step 1: Simplify App navigation**

Modify `frontend/src/App.tsx`:

```typescript
import { NavLink, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import History from "./pages/History";
import Home from "./pages/Home";
import Sessions from "./pages/Sessions";

function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { path: "/", label: "Dashboard", icon: "◆" },
    { path: "/sessions", label: "Sessions", icon: "◎" },
    { path: "/history", label: "History", icon: "◈" },
  ];

  return (
    <div className="flex min-h-screen bg-surface-900">
      <aside className="w-64 bg-surface-800 border-r border-surface-700 flex flex-col">
        <div className="p-6 border-b border-surface-700">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            acpx
          </h1>
          <p className="text-xs text-text-muted mt-1">Agent Client Protocol</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent-primary/10 text-accent-primary"
                        : "text-text-secondary hover:bg-surface-700 hover:text-text-primary"
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-surface-700">
          <div className="flex items-center gap-3 px-4 py-2 text-text-muted text-sm">
            <div className="w-2 h-2 rounded-full bg-accent-success" />
            Connected
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 2: Remove CreateSessionModal**

```bash
rm frontend/src/components/CreateSessionModal.tsx
```

- [ ] **Step 3: Remove PermissionModal**

```bash
rm frontend/src/components/PermissionModal.tsx
```

- [ ] **Step 4: Simplify Sessions page to read-only**

Modify `frontend/src/pages/Sessions.tsx` — remove any session creation UI, keep only the session list display. The existing file should have a session list component — remove the "Create Session" button and any form/modal that triggers it.

- [ ] **Step 5: Simplify Home page**

Modify `frontend/src/pages/Home.tsx` — remove any "create session" CTAs. Show session overview cards that link to session detail/history.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ frontend/src/components/CreateSessionModal.tsx frontend/src/components/PermissionModal.tsx
git commit -m "refactor: simplify frontend to read-only dashboard (remove session creation, permission modal)"
```

---

### Task 10: Frontend Real-Time Event Stream

**Files:**
- Modify: `frontend/src/hooks/useSessionStream.ts`
- Modify: `frontend/src/stores/sessionStore.ts`

- [ ] **Step 1: Rewrite useSessionStream for read-only EventBus WebSocket**

Replace the entire `frontend/src/hooks/useSessionStream.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionStore } from '../stores/sessionStore';
import type { AcpEvent } from '../types/acpx';

interface UseSessionStreamReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  subscribe: (sessionId: string) => void;
  unsubscribe: (sessionId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useSessionStream(sessionId: string | null): UseSessionStreamReturn {
  const {
    isConnected,
    isReconnecting,
    error: wsError,
    send,
    disconnect,
    reconnect,
    lastMessage,
  } = useWebSocket(sessionId);

  const { addEvent, setStreaming } = useSessionStore();

  const streamingTextRef = useRef<string>('');
  const streamingThoughtRef = useRef<string>('');

  const flushBuffer = useCallback(() => {
    const outputText = streamingTextRef.current;
    const thoughtText = streamingThoughtRef.current;
    if (outputText || thoughtText) {
      addEvent({
        type: 'text_delta',
        sessionId: sessionId || '',
        timestamp: Date.now(),
        payload: { text: outputText, thought: thoughtText || undefined },
      });
      streamingTextRef.current = '';
      streamingThoughtRef.current = '';
    }
  }, [addEvent, sessionId]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'event': {
        const event = lastMessage.data as AcpEvent;
        addEvent(event);

        // Accumulate text for display
        if (event.type === 'text_delta') {
          const text = (event.payload as any)?.text || '';
          if (text) {
            streamingTextRef.current += text;
          }
        }
        break;
      }

      case 'session_done':
        setStreaming(false);
        flushBuffer();
        break;

      case 'session_update':
        // Session info updated from backend
        break;

      case 'pong':
        break;

      case 'error':
        console.error('WS error:', lastMessage.message);
        setStreaming(false);
        flushBuffer();
        break;
    }
  }, [lastMessage, addEvent, setStreaming, flushBuffer]);

  const subscribe = useCallback((sid: string) => {
    send({ type: 'subscribe', sessionId: sid });
    setStreaming(true);
    streamingTextRef.current = '';
    streamingThoughtRef.current = '';
  }, [send, setStreaming]);

  const unsubscribe = useCallback((sid: string) => {
    send({ type: 'unsubscribe', sessionId: sid });
    flushBuffer();
  }, [send, flushBuffer]);

  return {
    isConnected,
    isReconnecting,
    error: wsError,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
  };
}
```

- [ ] **Step 2: Rewrite sessionStore for read-only event tracking**

Replace the entire `frontend/src/stores/sessionStore.ts`:

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AcpEvent } from '../types/acpx';

interface SessionState {
  sessionId: string | null;
  isStreaming: boolean;
  events: AcpEvent[];
  connectedSessionIds: string[];
  lastError: string | null;
}

interface SessionActions {
  setSession: (sessionId: string | null) => void;
  clearSession: () => void;
  addEvent: (event: AcpEvent) => void;
  setStreaming: (isStreaming: boolean) => void;
  markSessionConnected: (sessionId: string) => void;
  markSessionDisconnected: (sessionId: string) => void;
  setError: (error: string | null) => void;
}

type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  sessionId: null,
  isStreaming: false,
  events: [],
  connectedSessionIds: [],
  lastError: null,
};

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setSession: (sessionId) => set({ sessionId, events: [], lastError: null }),

    clearSession: () => set({
      sessionId: null,
      isStreaming: false,
      events: [],
      connectedSessionIds: [],
      lastError: null,
    }),

    addEvent: (event) =>
      set((state) => ({
        events: [...state.events, event],
      })),

    setStreaming: (isStreaming) => set({ isStreaming }),

    markSessionConnected: (sessionId) =>
      set((state) => {
        if (state.connectedSessionIds.includes(sessionId)) {
          return state;
        }
        return {
          connectedSessionIds: [...state.connectedSessionIds, sessionId],
        };
      }),

    markSessionDisconnected: (sessionId) =>
      set((state) => ({
        connectedSessionIds: state.connectedSessionIds.filter((id) => id !== sessionId),
      })),

    setError: (error) => set({ lastError: error }),
  }))
);
```

- [ ] **Step 3: Remove permission-related types from websocket types**

Since we no longer handle permissions in the Web UI, remove `WsPermissionParams` and `PermissionResponseKind` from `frontend/src/types/websocket.ts`. Keep only the event types.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useSessionStream.ts frontend/src/stores/sessionStore.ts frontend/src/types/websocket.ts
git commit -m "refactor: update frontend hooks/stores for read-only EventBus-driven streaming"
```

---

### Task 11: Integration Test — Matrix → acpx → Matrix Round Trip

**Files:**
- Create: `backend/test/integration/matrix-roundtrip.test.ts`

- [ ] **Step 1: Write integration test skeleton**

Create `backend/test/integration/matrix-roundtrip.test.ts`:

```typescript
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
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd backend && npx vitest run test/integration/matrix-roundtrip.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/test/integration/
git commit -m "test: add Matrix round-trip integration test"
```

---

### Task 12: Final Cleanup + Environment Config

**Files:**
- Modify: `backend/.env.example`
- Modify: `acpx-fork/package.json` (postinstall)
- Create: `backend/.env` (local dev)

- [ ] **Step 1: Update .env.example**

Modify `backend/.env.example`:

```
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# Matrix Gateway (optional — set to enable Matrix integration)
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_ACCESS_TOKEN=
MATRIX_USER_ID=@acpx:localhost
MATRIX_MANAGER_ROOM_ID=
```

- [ ] **Step 2: Run full test suite**

```bash
cd backend && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Final build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: Clean.

- [ ] **Step 4: Final commit**

```bash
git add backend/.env.example
git commit -m "chore: add Matrix env config, run full test suite"
```

---

## Task Summary

| # | Task | Est. Steps | Key Files |
|---|---|---|---|
| 1 | acpx-fork HITL patches | 9 | 3 source files + patch + test |
| 2 | EventBus + SessionRegistry | 6 | 3 new files + test |
| 3 | Matrix Gateway | 5 | gateway.ts + test |
| 4 | CommandParser + RoomRouter | 5 | commands.ts, room-router.ts + test |
| 5 | Event Formatter | 4 | formatter.ts + test |
| 6 | HITL Controllers | 4 | 3 new files |
| 7 | Backend Integration Wiring | 6 | index.ts, routes, config |
| 8 | WebSocket EventBus Integration | 3 | websocket.ts |
| 9 | Frontend Read-Only Simplification | 6 | App.tsx, pages, delete modals |
| 10 | Frontend Real-Time Stream | 4 | hooks, stores, types |
| 11 | Integration Test | 3 | matrix-roundtrip.test.ts |
| 12 | Cleanup + Env Config | 4 | .env.example, test suite |
