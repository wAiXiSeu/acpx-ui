# ACPX UI 完善建议

## 1. 测试覆盖

### 1.1 前端无测试
前端 `frontend/` 没有任何测试文件。建议补充：
- **组件单元测试**：`ChatView`、`SessionCard`、`CreateSessionModal`、`FlowVisualizer`、`PermissionModal` 等核心组件
- **Store 单元测试**：`sessionStore`、`uiStore`、`flowStore` 的状态变更逻辑
- **Hook 单元测试**：`useSessions`、`useFlows`、`useMutations`、`useSessionStream`、`useWebSocket`

### 1.2 后端测试不完整
后端只有一个 `routes.test.ts` 集成测试文件，且部分用例被 skip（如 `it.skip('should create a new session')`）。建议补充：
- Service 层单元测试（`SessionService`、`PermissionService`）
- WebSocket handler 测试
- 取消 skip 的集成测试

---

## 2. CI/CD

项目没有 CI 配置文件（如 `.github/workflows/`）。建议添加：
- 每次 push/PR 自动运行 `bun run test` + `bun run lint` + `bun run build`
- 可选：自动发布 Docker 镜像

---

## 3. 错误处理与用户体验

### 3.1 前端错误边界
`App.tsx` 没有 React Error Boundary。某个页面崩溃会导致整个应用白屏。建议在根组件或各 page 级别添加 Error Boundary。

### 3.2 全局 Loading / 错误状态
Dashboard（`Home.tsx`）直接读取 `useSessions` / `useFlows` 的 `data`，但没有展示 loading 或 error 状态。建议在 loading 时显示 skeleton，error 时显示提示。

### 3.3 后端错误日志
`index.ts` 的全局 `setErrorHandler` 只记录了 `fastify.log.error(error)`，没有记录 request 上下文（URL、method、body）。建议加入 request 信息便于排查。

### 3.4 Session 删除改为关闭
`sessions.ts` 的 `DELETE /sessions/:id` 实际调用的是 `closeSession`，语义上 "delete" 和 "close" 不一致。建议改为 `POST /sessions/:id/close` 或明确文档说明。

---

## 4. 安全性

### 4.1 CORS 配置过于宽松
`config.ts` 默认 `CORS_ORIGIN` 为 `*`，生产环境应限制为具体域名。

### 4.2 无认证/授权
所有 API 端点完全开放，无鉴权机制。如果部署到公网，任何人都可以创建/操作 session。建议至少支持 API Key 或 Bearer Token 认证。

### 4.3 WebSocket 无鉴权
WebSocket 连接没有认证检查，任何客户端可以连接任意 session。

---

## 5. 类型安全

### 5.1 硬编码的 Agent 列表
`session.service.ts:182` 硬编码了 `validAgents` 数组，但 acpx-fork 的 agent registry 是动态的。建议从 registry 动态获取可用 agent 列表，而非手动维护。

### 5.2 `any` / `unknown` 类型使用
多处使用 `unknown` 类型然后通过 `instanceof Error` 处理（这是好的），但也有 `Record<string, unknown>` 等过于宽泛的类型。关键接口应有更精确的类型定义。

### 5.3 WebSocket 消息类型
`WsMessage` 联合类型中没有 `session_id` 字段，多 session 场景下客户端难以区分消息来源。

---

## 6. 前端功能缺口

### 6.1 History 页面
`History.tsx` 页面存在但功能依赖 `ConversationView`、`ActionLogView`、`TimelineView` 三个组件，需要确认这些组件是否完整实现并与后端数据对接。

### 6.2 无搜索/过滤/排序
Sessions 列表和 Flows 列表缺少搜索、过滤（按状态、agent）、排序功能。当 session 数量增多后，可用性会下降。

### 6.3 无分页
所有 sessions 和 flows 一次性加载，数据量大时会有性能问题。

### 6.4 实时连接状态
侧边栏显示 "Connected" 但这是静态的，没有实际检测后端连接状态。建议结合 WebSocket 连接状态动态显示。

### 6.5 无深色/浅色主题切换
当前只有深色主题（Tailwind class 如 `bg-surface-900`），没有主题切换能力。

---

## 7. 后端架构

### 7.1 SessionService 是单例
`SessionService.getInstance()` 是单例模式，不利于测试和多实例场景。虽然当前够用，但长期来看依赖注入会更灵活。

### 7.2 缺少健康检查端点
`routes.test.ts` 中有 `/health` 测试，但路由代码中未见对应实现。需要确认是否已实现或遗漏。

### 7.3 Flow 执行 API 未实现
`POST /flows/run` 返回 501 not_implemented。如果需要完整的 flow 管理功能，需要实现 flow 创建、触发、停止等 REST 接口。

### 7.4 无 API 版本控制
所有路由无版本前缀（如 `/api/v1/...`）。当前功能简单无所谓，但未来 breaking change 时会导致客户端不兼容。

---

## 8. 文档

### 8.1 缺少 API 文档
没有 OpenAPI/Swagger 文档。建议添加 `@fastify/swagger` 自动生成 API 文档。

### 8.2 缺少开发指南
CLAUDE.md 已存在但面向 AI agent，没有 `CONTRIBUTING.md` 或 `docs/DEVELOPMENT.md` 给人类开发者参考。

---

## 9. 运维/可观测性

### 9.1 无结构化日志
Fastify 使用默认的 pino 日志，但没有配置 request-id、trace-id 等关联字段。

### 9.2 无 Metrics
没有 Prometheus/Grafana metrics 暴露（请求延迟、错误率、活跃 session 数等）。

### 9.3 无 Docker 构建
Docker 部署已被移除（从 git 历史可见）。如需容器化部署，需要重新添加 Dockerfile。

---

## 10. 依赖管理

### 10.1 acpx-fork 耦合
后端直接 import acpx-fork 的打包产物路径（`@local/acpx/dist/runtime.js`、`@local/acpx/dist/session-DwM_3DqC.js`），这些文件名包含 hash（`DwM_3DqC`），acpx-fork 重新构建后 hash 会变化，导致 import 路径失效。建议 acpx-fork 提供稳定的 API 导出入口。

### 10.2 bun + npm lock 共存
仓库同时存在 `bun.lock` 和 `package-lock.json`，应统一包管理器。

---

## 优先级建议

| 优先级 | 项目 | 理由 |
|--------|------|------|
| **P0** | 添加健康检查端点 | 运维基础需求 |
| **P0** | 修复 acpx-fork 耦合的 import 路径 | 构建稳定性风险 |
| **P1** | 前端测试覆盖 | 质量保障 |
| **P1** | CI 配置 | 防止回归 |
| **P1** | 前端 loading/error 状态 | 用户体验 |
| **P1** | 统一包管理器 | 避免依赖混乱 |
| **P2** | 认证/授权 | 公网部署需求 |
| **P2** | API 文档 | 可维护性 |
| **P2** | 搜索/过滤/分页 | 可用性 |
| **P3** | Metrics/结构化日志 | 运维可观测性 |
| **P3** | 主题切换 | 锦上添花 |
