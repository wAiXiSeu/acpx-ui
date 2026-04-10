# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ACPX UI is a web dashboard for managing and visualizing ACPX (Agent Client Protocol) sessions and flows. It provides a React frontend with a Fastify backend that wraps the `acpx` CLI tool via a forked copy in `acpx-fork/`.

## Monorepo Structure

- **`frontend/`** — React 18 + Vite + TypeScript app (port 3000 dev)
- **`backend/`** — Fastify 4 + TypeScript API server (port 3001 dev)
- **`acpx-fork/`** — Modified `acpx` package with custom permission callback support, consumed as `@local/acpx` via `file:` workspace link

## Key Commands

All run from the repo root with Bun:

```bash
# Install all workspace dependencies
bun install

# Development (both frontend + backend concurrently)
bun run dev

# Individual dev servers
bun run dev:frontend    # Vite on :3000
bun run dev:backend     # tsx watch on :3001

# Production build
bun run build           # builds frontend then backend
bun run build:frontend
bun run build:backend

# Tests (Vitest in each workspace)
bun run test
bun run test:frontend
bun run test:backend

# Lint
bun run lint

# Start production server (backend serves frontend static files)
cd backend && NODE_ENV=production node dist/index.js

# Clean all artifacts
bun run clean
```

## Architecture

### Backend (`backend/src/`)

- **Entry**: `index.ts` — creates Fastify server, registers CORS, WebSocket plugin, routes, and optionally serves frontend static files in production via `@fastify/static`.
- **Routes**: `routes/` — REST endpoints for sessions (`/api/sessions/*`) and flows (`/api/flows/*`). Route index at `routes/index.ts` registers them.
- **Services**: `services/` — `SessionService` (singleton) wraps the acpx-fork runtime (`createAcpRuntime`) for session CRUD, streaming turns, mode/config changes. `PermissionService` manages permission request callbacks with 120s timeout.
- **WebSocket**: `plugins/websocket.ts` registers `@fastify/websocket`. `websocket/session-handler.ts` streams ACP runtime events to connected clients.
- **Config**: `config.ts` — reads `PORT`, `HOST`, `CORS_ORIGIN` from env, detects production via `NODE_ENV`.
- **Types**: `types/acpx.ts` and `types/acpx-bundled.d.ts` — TypeScript types for ACPX runtime and bundled modules.

The backend integrates directly with `acpx-fork` by importing from `@local/acpx/dist/runtime.js` and internal bundled modules (`session-DwM_3DqC.js`, `prompt-turn-Di3t13Tw.js`). The `SessionService` initializes an `AcpxRuntime` with a file session store (`~/.acpx/`) and agent registry.

### Frontend (`frontend/src/`)

- **Entry**: `main.tsx` — mounts React app with React Router.
- **App**: `App.tsx` — sidebar layout with routes: `/` (Home), `/sessions`, `/flows`, `/history`.
- **Pages**: `pages/` — `Home.tsx`, `Sessions.tsx`, `Flows.tsx`, `History.tsx`.
- **Components**: `components/` — `ChatView.tsx`, `SessionCard.tsx`, `CreateSessionModal.tsx`, `FlowVisualizer.tsx`, `FlowNode.tsx`, `PermissionModal.tsx`, `history/` (ConversationView, ActionLogView, TimelineView).
- **State**: `stores/` — Zustand stores: `sessionStore.ts` (per-session messages/streaming), `uiStore.ts` (UI state), `flowStore.ts` (flow data). `index.ts` re-exports.
- **Hooks**: `hooks/` — `useSessions.ts`, `useFlows.ts`, `useMutations.ts`, `useSessionStream.ts` (WebSocket streaming), `useWebSocket.ts`.
- **API**: `api/` — `client.ts` (base HTTP client), `sessions.ts`, `flows.ts`.
- **Types**: `types/acpx.ts`, `types/websocket.ts`.
- **Utils**: `utils/elkLayout.ts` — ELK.js auto-layout for React Flow diagrams.

### Data Flow

1. User action → frontend component → API client (`api/`) → backend route → `SessionService` → acpx-fork runtime → ACP agent.
2. ACP agent events stream back through WebSocket (`/ws`) → `useSessionStream` hook → Zustand store → React re-render.

## Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, React Flow (`@xyflow/react`), ELK.js, Zustand, React Query, React Router
- **Backend**: Fastify 4, `@fastify/websocket`, `@fastify/cors`, `@fastify/static`, `tsx` for dev, `@agentclientprotocol/sdk` for permission types
- **Package manager**: Bun (workspaces), pnpm in acpx-fork

## Environment Variables

- `PORT` (backend, default 3001)
- `HOST` (backend, default 0.0.0.0)
- `CORS_ORIGIN` (backend, default http://localhost:3000)
- `NODE_ENV` — set to `production` for prod mode
- `VITE_API_URL` (frontend, default http://localhost:3001)
- `VITE_WS_URL` (frontend, for WebSocket URL)
