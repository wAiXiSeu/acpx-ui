# Matrix + acpx-ui 交互设计

**Date:** 2026-04-10
**Status:** Draft

## 1. 概述

为 acpx-ui 设计一套基于 Matrix room 的 UI 交互形态。Matrix 作为 session 管理和交互的入口（写操作），acpx-ui Web UI 作为只读仪表盘（监控/审计）。两者共享同一后端服务，天然共享状态。

### 角色分工

| 平台 | 角色 | 能力 |
|---|---|---|
| Matrix Rooms | 写操作入口 | 创建/销毁 session、对话、权限审批、HITL 交互 |
| acpx-ui Web UI | 只读仪表盘 | Session 状态总览、实时事件流查看、历史回放、Token 统计 |
| Backend (Fastify) | 统一桥接 | Matrix Gateway + acpx Runtime + REST API + WebSocket |

### 架构模式

acpx-ui Backend 作为 Matrix bot 用户（`@acpx:server`）直接连接 Homeserver，通过 `matrix-js-sdk` 实现 Matrix 通信。所有 session 由 Backend 统一管理，通过 in-memory EventBus 同时分发给 Matrix 和 Web UI。

## 2. 架构

```
┌─────────────────────────────────────────────────────────┐
│                   acpx-ui Backend (Fastify)             │
│                                                         │
│  ┌──────────────┐  ┌───────────────────┐               │
│  │  Matrix      │  │   SessionManager  │               │
│  │  Gateway     │  │   (acpx Runtime)  │               │
│  │              │  │                   │               │
│  │ matrix-js-sdk│◄─┤  ┌─────────────┐  │               │
│  │ (bot user)   │  │  │ acpx child  │  │               │
│  └──┬───────▲───┘  │  │ process     │  │               │
│     │       │      │  └─────────────┘  │               │
│     │ HTTP  │      └────────┬──────────┘               │
│     │REST   │               │                            │
│  ┌──┴───────▼───┐  ┌───────┴──────────┐               │
│  │  Room Router │  │  PermissionEngine│               │
│  │              │  │  + HITL Handler  │               │
│  └──────────────┘  └──────────────────┘               │
│     │                     │                            │
│  ┌──▼─────────────────────▼──────┐                    │
│  │       EventBus (in-memory)    │                    │
│  └──┬──────────────────────▲─────┘                    │
│     │                      │                          │
│  ┌──▼──────┐         ┌─────┴────────┐                │
│  │  HTTP   │         │  WebSocket   │                │
│  │  REST   │         │  Server      │                │
│  └─────────┘         └──────────────┘                │
└─────────────────────────────────────────────────────────┘
         ▲                     ▲
         │                     │
  ┌──────┴──────┐       ┌──────┴──────┐
  │  Matrix     │       │  acpx-ui    │
  │  Rooms      │       │  Frontend   │
  │             │       │  (React)    │
  └─────────────┘       └─────────────┘
```

## 3. 组件

### 3.1 Matrix Gateway

- 使用 `matrix-js-sdk` 作为 bot 用户登录 homeserver
- 监听房间消息事件（`RoomEvent.Timeline`）
- 提供 `sendMessage()`, `sendReply()` 方法
- 处理 E2EE 解密
- 管理房间发现和维护

### 3.2 Room Router

区分 manager room 和 session room：
- **Manager room**: 路由到 `CommandParser` 解析管理命令
- **Session room**: 路由到 `SessionManager.prompt()` 转发为 acpx prompt
- **权限待处理**: 路由到 `PermissionEngine.apply()` 处理审批响应

### 3.3 SessionManager

封装 acpx Runtime API：
- `createSession(opts)` — 创建 session + Matrix room
- `killSession(id)` — 终止 session
- `prompt(id, text)` — 发送 prompt
- `getSessions()`, `getSession(id)` — 查询 session 信息
- 每个 session 对应一个 `SessionHandle` 实例

### 3.4 SessionHandle

每个 session 一个实例：
```typescript
class SessionHandle {
  async start(agent: string, cwd: string): Promise<void>
  async prompt(text: string): Promise<void>
  async respondPermission(requestId: string, optionId: string): Promise<void>
  async cancel(): Promise<void>
  async close(): Promise<void>
  *events(): AsyncIterable<AcpRuntimeEvent>
}
```

### 3.5 PermissionEngine + HITL

三种权限模式：
- `approve-all` — 自动批准
- `approve-reads` — read/search 自动批准，write/terminal 需审批
- `deny-all` — 全部拒绝

三种 HITL 交互：
- **Step Mode** — 每个 tool call 执行前暂停等待确认 (`/step on/off`)
- **Edit-Params** — 权限请求时可修改参数后执行 (回复 `EDIT` + 修改后的 JSON)
- **Intercept** — 运行中发送修正消息 (`/intercept <message>`)

权限命令匹配: `^(approve|allow|yes|y|deny|reject|no|n|edit)$` (不区分大小写)
权限请求超时: 120s，超时自动 DENY

### 3.6 EventBus

in-memory 事件总线（Node.js EventEmitter）：
- 接收 SessionManager 发出的 ACP 事件
- 分发给 Matrix Gateway（推送到 Matrix 房间）
- 分发给 WebSocket Server（推送给 Web UI）
- 分发给 Store（持久化到磁盘 NDJSON 事件日志）

### 3.7 Event Formatter

acpx 事件 → Matrix 消息格式化规则：

| acpx Event | Matrix Message 格式 |
|---|---|
| `text_delta` | 合并后发一条 `m.text`, 用 `\n\n---\n\n` 分段 |
| `pre_tool_call` | `🔧 About to call: <tool>(<params>)` + `[APPROVE] [DENY] [EDIT]` |
| `tool_call` start | `🔧 Calling: <tool>(<args>)` |
| `tool_call` result | `✅ <tool> completed` / `❌ <tool> failed: <reason>` |
| `permission_request` | `[Permission] <description>? Reply APPROVE or DENY` |
| `done` | `✓ Completed in <duration>s` |
| `error` | `❌ Error: <message>` |
| `params_modified` | `✏️ Parameters modified. Executing with updated values.` |

## 4. 房间模型

### Manager Room

管理员与 bot 的 DM 或指定群聊。支持的管理命令：

| 命令 | 格式 | 示例 |
|---|---|---|
| `/new` | `/new <agent> [name]` | `/new claude refactor auth` |
| `/list` | `/list` | 列出所有活跃 session |
| `/kill` | `/kill <session-id|name>` | `/kill abc1` |
| `/use` | `/use <agent>` | `/use codex` |
| `/mode` | `/mode <approve-all\|approve-reads\|deny-all>` | `/mode approve-reads` |
| `/step` | `/step on\|off` | `/step on` |
| `/intercept` | `/intercept <message>` | `/intercept use git rm instead` |
| `/help` | `/help` | 显示可用命令 |

创建 session 时：
- 预设: `trusted_private_chat`
- 初始成员: bot (`@acpx:server`) + 发起者
- 房间名: session name
- 初始 topic: agent 名称 + 创建时间
- E2EE: 通过 `m.room.encryption` state event 启用
- `room_id` 存入 `SessionRecord`, 用于路由

### Session Room

每个 session 一个独立 room。用户直接发消息 → 转发为 acpx prompt。

| 用户输入 | 系统响应 |
|---|---|
| 普通文本消息 | 转发为 acpx prompt, 流式返回 agent 响应 |
| `APPROVE` / `YES` / `Y` | 同意待执行的 tool call |
| `DENY` / `NO` / `N` | 拒绝待执行的 tool call |
| `EDIT` | 进入参数编辑模式, 返回可修改的 JSON |
| (修改后的 JSON) | 应用修改参数, 执行 tool call |
| `/cancel` | 取消当前 prompt |
| `/status` | 显示当前 session 状态 |

## 5. 数据流

### 5.1 创建 Session

```
Manager Room: /new claude "refactor auth"
  → RoomRouter.createSession()
    → SessionManager: 1. generate id  2. create Matrix room (SDK)  3. store record
  → 返回 room link 到 Manager Room
  → EventBus emit session_created → Web UI
```

### 5.2 Session 对话

```
Session Room: "help me refactor X"
  → RoomRouter.prompt(sessionId, text)
    → SessionHandle.stdio.write() → acpx child process
    → SessionHandle.events() 迭代 ACP 事件
      → EventBus emit(event)
        → Matrix Gateway: format & send to room
        → WS Server: broadcast to Web UI
        → Store: append to event log
```

### 5.3 Web UI 只读数据流

```
GET /api/sessions          → initial session list
WS /ws                     → real-time event stream
  → SessionCard 更新状态
  → EventStream 追加事件

GET /api/sessions/:id/events  → history replay
  → 从 NDJSON 事件日志重建对话历史
```

### 5.4 权限交互

```
acpx emits permission_request
  → SessionHandle emit("permission_request")
    → EventBus forward
      → RoomRouter + PermissionEngine
        → Format: "[Permission] Write to config.json? Reply APPROVE or DENY"
        → Matrix Gateway send to session room
          → User replies: "APPROVE"
            → PermissionEngine.parse() → resolve()
              → SessionHandle.respondPermission(requestId, "allow_once")
```

## 6. API 定义

### 6.1 REST API (只读)

```
GET /api/status
→ { matrix: { connected: boolean, rooms: number }, sessions: { active: number, total: number } }

GET /api/sessions
→ SessionInfo[]

GET /api/sessions/:id
→ SessionInfo

GET /api/sessions/:id/events?from=<timestamp>&limit=<n>
→ EventLogEntry[]

GET /api/sessions/:id/history
→ { messages: { role: "user" | "agent"; content: string; timestamp: number }[] }
```

### 6.2 WebSocket Protocol

```
Client → Server:
  { "type": "subscribe", "sessionId": "abc-123" }
  { "type": "unsubscribe", "sessionId": "abc-123" }
  { "type": "ping" }

Server → Client:
  { "type": "session_created", "data": SessionInfo }
  { "type": "session_update", "data": SessionInfo }
  { "type": "session_done", "data": { sessionId, stopReason } }
  { "type": "event", "data": AcpEvent }
  { "type": "pong" }
```

## 7. 核心类型

```typescript
interface SessionInfo {
  id: string;              // session UUID
  room: string;            // Matrix room_id
  name: string;            // 用户可读名称
  agent: string;           // agent 命令 (e.g. "claude", "codex")
  status: "idle" | "running" | "error" | "done";
  hitlMode: "off" | "step" | "intercept";
  permissionMode: "approve-all" | "approve-reads" | "deny-all";
  createdAt: number;
  lastUsedAt: number;
  tokenUsage: { prompt: number; completion: number };
}

interface AcpEvent {
  type: "text_delta" | "tool_call" | "pre_tool_call" | "status" | "done" | "error"
      | "permission_request" | "intercepted" | "step_paused" | "step_resumed"
      | "params_modified";
  sessionId: string;
  timestamp: number;
  payload: object;
}

interface EventLogEntry {
  timestamp: number;
  direction: "in" | "out";  // 用户输入 vs agent 输出
  event: AcpEvent;
}
```

## 8. 错误处理

### 错误码

```typescript
enum ErrorCode {
  // Matrix
  MATRIX_DISCONNECT = "matrix_disconnect",
  MATRIX_AUTH_FAILED = "matrix_auth_failed",
  ROOM_CREATE_FAILED = "room_create_failed",
  ROOM_NOT_FOUND = "room_not_found",

  // Session
  AGENT_START_FAILED = "agent_start_failed",
  AGENT_CRASHED = "agent_crashed",
  PROMPT_TIMEOUT = "prompt_timeout",
  SESSION_NOT_FOUND = "session_not_found",

  // HITL
  PERMISSION_TIMEOUT = "permission_timeout",
  INVALID_EDIT_FORMAT = "invalid_edit_format",
  INTERCEPT_NOT_APPLICABLE = "intercept_not_applicable",

  // System
  STORE_CORRUPTED = "store_corrupted",
  EVENT_BUS_FULL = "event_bus_full",
}
```

### 恢复策略

| 错误 | 恢复动作 |
|---|---|
| Matrix 断线 | 自动重连 (exponential backoff, max 5 次), 重连后重新 sync rooms, 发送断线期间的缓存事件 |
| Agent 崩溃 | 记录事件日志, 发送错误通知到 session room, session 状态变为 `error`, 保留 event log 供调试 |
| 权限请求超时 (120s) | 自动 `DENY`, 通知 agent "权限请求超时, 已拒绝", 继续或完成 prompt |
| 命令解析失败 | 发送 "Unknown command. Type `/help` for available commands." |
| EDIT 参数格式错误 | 发送 "Invalid JSON. Please send a valid JSON object:" |
| Session store 损坏 | 发送告警到 Web UI, 不影响正在运行的 session, 下次创建 session 时自动重建 store |

## 9. Fork 同步策略

### 现状

acpx-fork 几乎没有可扩展点。`AcpRuntimeOptions` 不支持注入自定义处理器，tool handlers 和 permission resolution 硬编码在 `AcpClient` 内部。需要 fork 的部分约 50 行，集中在 3 个文件：

| 文件 | 改动 | 行数 |
|---|---|---|
| `src/runtime/public/contract.ts` | 增加 `onPermissionRequest`, `onPreToolCall` 可选字段 | ~10 行 |
| `src/acp/client.ts` | 构造函数接受可选 handler overrides | ~35 行 |
| `src/runtime/engine/manager.ts` | 将 options 中的 callbacks 传给 `createClient()` | ~5 行 |

### 三阶段推进

**阶段 1: 最小 Fork + Patch Overlay（现在）**
- 修改提取为 patch 文件，`acpx-fork/` 通过 `postinstall: patch-package` 注入
- 升级时: `git pull upstream main` → `git apply patches/*.patch` → 重新生成

**阶段 2: Upstream Contribution（中期）**
- 向 openclaw/acpx 提 PR，合并 `onPermissionRequest` 和 `onPreToolCall` 扩展点

**阶段 3: Fork Elimination（目标状态）**
- 上游接受后删除 acpx-fork, 直接用 `npm install acpx`

## 10. 测试策略

```
┌─────────────────────────────────────────┐
│  E2E Tests                              │
│  - Matrix room → Backend → acpx child   │
│  - Full session lifecycle               │
│  - HITL step/intercept flows            │
├─────────────────────────────────────────┤
│  Integration Tests                      │
│  - RoomRouter → SessionManager routing  │
│  - EventBus → WS broadcast              │
│  - REST API endpoints                   │
│  - PermissionEngine command parsing     │
├─────────────────────────────────────────┤
│  Unit Tests                             │
│  - Matrix formatter                     │
│  - CommandParser                        │
│  - acpx event → Matrix message mapping  │
│  - SessionRecord persistence            │
│  - EventLogEntry parsing                │
└─────────────────────────────────────────┘
```

### acpx-fork patch 验证

- `test-patch-applies.sh` — CI 中验证 patch 可应用
- `test-api-surface.ts` — 验证扩展点存在
- `test-upstream-sync.sh` — 脚本: pull upstream → apply patch → build → smoke test

## 11. 目录结构

```
acpx-ui/
├── acpx-fork/                    # acpx 运行时库 (with patches/)
├── backend/
│   └── src/
│       ├── index.ts              # 服务启动
│       ├── server.ts             # Fastify 实例配置
│       ├── matrix/
│       │   ├── gateway.ts        # Matrix 客户端连接
│       │   ├── room-router.ts    # manager vs session room 分发
│       │   ├── formatter.ts      # acpx events → Matrix messages
│       │   └── commands.ts       # manager room 命令解析
│       ├── sessions/
│       │   ├── manager.ts        # 创建/销毁/查找 session
│       │   ├── handle.ts         # 单个 session 的 acpx Runtime 封装
│       │   ├── events.ts         # acpx 事件流处理
│       │   └── hitl/
│       │       ├── intercept-handler.ts
│       │       ├── param-editor.ts
│       │       └── step-controller.ts
│       ├── http/
│       │   ├── routes.ts
│       │   ├── sessions.ts
│       │   ├── events.ts
│       │   └── status.ts
│       ├── ws/
│       │   ├── server.ts
│       │   └── handlers.ts
│       └── shared/
│           ├── event-bus.ts
│           ├── store.ts
│           └── types.ts
├── frontend/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx     # Session 总览 + 状态
│       │   ├── SessionView.tsx   # 单个 session 实时事件流
│       │   └── History.tsx       # 历史 session 回放
│       ├── components/
│       │   ├── SessionCard.tsx
│       │   ├── EventStream.tsx
│       │   ├── ToolCallViewer.tsx
│       │   └── TokenStats.tsx
│       ├── hooks/
│       │   └── useSessionStream.ts
│       ├── stores/
│       │   ├── sessionStore.ts
│       │   └── uiStore.ts
│       └── lib/
│           ├── api.ts
│           └── ws.ts
└── package.json
```
