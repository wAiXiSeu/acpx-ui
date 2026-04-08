# ACPX UI

A web-based user interface for managing and visualizing ACPX (Agent Client Protocol) sessions and flows. Built with React, Vite, and Fastify.

## Overview

ACPX UI provides a graphical interface for interacting with ACPX, a headless CLI client for AI agent communication based on the Agent Client Protocol (ACP). This application enables users to:

- Create and manage multiple agent sessions
- Visualize flow execution with interactive diagrams
- Browse session history (timeline, conversations, action logs)
- Handle permission requests with a modal interface
- Stream real-time updates via WebSocket

### Key Features

| Feature | Description |
|---------|-------------|
| **Session Management** | Create, close, and resume agent sessions |
| **Flow Visualization** | Interactive flow diagrams using React Flow and ELK.js layout |
| **History Browser** | Timeline view, conversation history, and action logs |
| **Permission Modal** | 120-second timeout for permission requests |
| **WebSocket Streaming** | Real-time updates for session state and messages |

## Prerequisites

- **Node.js**: v20 or higher
- **Bun**: v1.0 or higher (recommended package manager)
- **acpx**: The ACPX CLI tool must be installed globally

### Installing acpx

```bash
npm install -g acpx@latest
```

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd acpx-ui
```

2. Install dependencies:

```bash
bun install
```

This installs dependencies for all workspaces (frontend, backend, and acpx-fork).

## Running the Application

### Development Mode

Start both frontend and backend in development mode:

```bash
bun run dev
```

Or start them separately:

```bash
# Frontend only (port 3000)
bun run dev:frontend

# Backend only (port 3001)
bun run dev:backend
```

### Production Build

Build all workspaces:

```bash
bun run build
```

Build individually:

```bash
bun run build:frontend
bun run build:backend
```

### Other Commands

```bash
# Run tests
bun run test

# Run linting
bun run lint

# Clean all dependencies and build artifacts
bun run clean
```

## Project Structure

```
acpx-ui/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # React components
│   │   │   ├── CreateSessionModal.tsx
│   │   │   ├── FlowNode.tsx
│   │   │   ├── FlowVisualizer.tsx
│   │   │   ├── PermissionModal.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── history/     # History components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   │   ├── Flows.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Home.tsx
│   │   │   └── Sessions.tsx
│   │   ├── stores/          # Zustand state stores
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                  # Fastify backend
│   ├── src/
│   │   ├── routes/          # API routes
│   │   │   ├── sessions.ts  # Session endpoints
│   │   │   └── flows.ts     # Flow endpoints
│   │   ├── services/        # Business logic
│   │   │   ├── session.service.ts
│   │   │   └── permission.service.ts
│   │   ├── websocket/       # WebSocket handlers
│   │   ├── plugins/         # Fastify plugins
│   │   ├── types/           # TypeScript types
│   │   └── index.ts         # Entry point
│   └── tsconfig.json
│
├── acpx-fork/               # Modified acpx with permission callback
│   └── ...                  # ACPX source with custom modifications
│
└── package.json             # Root workspace config
```

## API Documentation

### Base URL

- Development: `http://localhost:3001`
- Production: Configured via `VITE_API_URL` environment variable

### Endpoints

#### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Sessions

##### List All Sessions

```
GET /api/sessions/sessions
```

Response:
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "agent": "codex",
      "cwd": "/path/to/project",
      "status": "active",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

##### Get Session by ID

```
GET /api/sessions/sessions/:id
```

Response:
```json
{
  "session": {
    "id": "session-uuid",
    "agent": "codex",
    "cwd": "/path/to/project",
    "status": "active",
    "messages": []
  }
}
```

##### Create Session

```
POST /api/sessions/sessions
```

Body:
```json
{
  "agent": "codex",
  "cwd": "/path/to/project",
  "name": "optional-session-name"
}
```

Response:
```json
{
  "handle": "acpx-record-id",
  "record": {
    "id": "session-uuid",
    "agent": "codex",
    "cwd": "/path/to/project"
  }
}
```

##### Close Session

```
DELETE /api/sessions/sessions/:id
```

Response:
```json
{
  "session": {
    "id": "session-uuid",
    "status": "closed"
  }
}
```

##### Get Session History

```
GET /api/sessions/sessions/:id/history
```

Response:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Fix the tests",
      "timestamp": "2024-01-15T10:05:00.000Z"
    }
  ]
}
```

#### Flows

##### List All Flow Runs

```
GET /api/flows/flows
```

Response:
```json
{
  "runs": [
    {
      "runId": "flow-run-id",
      "manifest": {
        "name": "Flow Name",
        "steps": []
      }
    }
  ]
}
```

##### Get Flow Run by ID

```
GET /api/flows/flows/:runId
```

Response:
```json
{
  "runId": "flow-run-id",
  "manifest": {
    "name": "Flow Name",
    "steps": []
  }
}
```

##### Run Flow (Not Implemented)

```
POST /api/flows/flows/run
```

Response:
```json
{
  "status": "not_implemented",
  "message": "Flow execution is not yet implemented via the REST API"
}
```

### WebSocket

Connect to `ws://localhost:3001/ws` for real-time updates.

Events:
- `session:created` - New session created
- `session:updated` - Session state changed
- `session:closed` - Session closed
- `permission:request` - Permission request pending
- `permission:response` - Permission response submitted

## Development Guide

### Technology Stack

**Frontend:**
- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- React Flow (flow visualization)
- ELK.js (automatic layout)
- Zustand (state management)
- React Query (data fetching)
- React Router (routing)

**Backend:**
- Fastify 4
- TypeScript
- WebSocket (@fastify/websocket)
- CORS (@fastify/cors)

### Environment Variables

**Backend (`backend/.env`):**
```
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**Frontend (`frontend/.env`):**
```
VITE_API_URL=http://localhost:3001
```

### Adding New Features

1. **New API Endpoint:**
   - Add route handler in `backend/src/routes/`
   - Add service logic in `backend/src/services/`
   - Update TypeScript types in `backend/src/types/`

2. **New UI Component:**
   - Create component in `frontend/src/components/`
   - Add state management in `frontend/src/stores/` if needed
   - Update types in `frontend/src/types/`

3. **New Page:**
   - Create page in `frontend/src/pages/`
   - Add route in `frontend/src/App.tsx`

### Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use functional components with hooks
- Prefer composition over inheritance

### Testing

```bash
# Run all tests
bun run test

# Run frontend tests only
bun run test:frontend

# Run backend tests only
bun run test:backend
```

## Architecture

### Session Management Flow

```
User Action → Frontend Component → API Client → Backend Route
    → SessionService → acpx-fork → ACPX CLI → Agent
    → WebSocket → Frontend Update
```

### Permission Handling

```
Agent requests permission → acpx-fork callback
    → PermissionService → WebSocket event
    → PermissionModal (120s timeout)
    → User response → PermissionService
    → acpx-fork → Agent continues
```

### Flow Visualization

```
Flow Run → Backend reads manifest.json
    → Frontend fetches via API
    → React Flow renders nodes
    → ELK.js calculates layout
    → Interactive diagram
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :3001
   ```

2. **acpx not found:**
   ```bash
   npm install -g acpx@latest
   ```

3. **WebSocket connection failed:**
   - Ensure backend is running on port 3001
   - Check CORS configuration
   - Verify `VITE_API_URL` is set correctly

4. **Build errors:**
   ```bash
   # Clean and reinstall
   bun run clean
   bun install
   ```

## License

MIT

## Production Deployment

### Quick Start

```bash
# 1. Build
bun install
bun run build

# 2. Start backend (serves frontend static files)
cd backend
NODE_ENV=production PORT=3001 HOST=0.0.0.0 node dist/index.js
```

### Environment Variables

**Backend (`backend/.env.production`):**
```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.com
```

**Frontend (build time):**
```bash
# frontend/.env.production
VITE_API_URL=https://your-domain.com
VITE_WS_URL=wss://your-domain.com
```

### Option 1: Standalone Backend (Recommended)

The backend can serve the frontend static files directly:

```bash
# Build frontend (outputs to frontend/dist)
bun run build:frontend

# Build backend
bun run build:backend

# Start - backend serves both API and static files
cd backend
NODE_ENV=production node dist/index.js
```

### Option 2: Docker

Create `Dockerfile` in project root:

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/frontend/dist ./public
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t acpx-ui .
docker run -p 3001:3001 acpx-ui
```

### Option 3: Reverse Proxy (Nginx)

Backend on port 3001, Nginx in front:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        root /var/www/acpx-ui/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start backend/dist/index.js --name acpx-ui-backend

# Save and enable startup
pm2 save
pm2 startup
```

### Health Check

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Set `VITE_API_URL` and `VITE_WS_URL` before building frontend
- [ ] Ensure acpx is installed: `npm install -g acpx@latest`
- [ ] Configure firewall to allow port 3001 (or your chosen port)
- [ ] Set up SSL/TLS (Let's Encrypt recommended)
- [ ] Configure log rotation for backend logs