# Chat Page Design

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Add a `/chat` page to acpx-ui that provides a direct browser-based interface for conversing with ACP agents, similar to ChatGPT. Uses the existing acpx-fork runtime and backend session service — no Matrix or direct API calls.

## Goals

- Users can create, manage, and chat with agent sessions directly in the browser
- Multiple sessions can run in parallel with independent event streams
- Maintains consistency with existing state management (sessionStore, React Query, WebSocket)
- Backward compatible with existing Sessions and History pages

## Non-Goals

- File/image upload (deferred to future phase)
- Matrix room integration
- Direct Claude API calls

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Zustand sessionStore (single source of truth)                   │
│  - eventsBySession: Record<string, AcpEvent[]>                   │
│  - streamingSessions: Set<string>                                │
│  - connectedSessionIds: string[]                                 │
│  ← Shared across Chat, Sessions, and History pages               │
├─────────────────────────────────────────────────────────────────┤
│  React Query (session list)                                       │
│  - fetchSessions() cached query                                   │
│  - createSession() / closeSession() mutations                     │
│  ← Auto-cache and auto-invalidate on mutations                    │
├─────────────────────────────────────────────────────────────────┤
│  Chat page-specific state                                         │
│  - Selected sessionId from URL params                             │
│  - Input text (local state)                                       │
│  - Open tabs (local state)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Session Parallel Model

- Each session has its own WebSocket connection (1 sessionId → 1 WS connection, unchanged from current)
- Each ChatThread tab manages its own `useSessionStream(sessionId)` instance
- Events from session X write to `eventsBySession[X]`, session Y to `eventsBySession[Y]`
- No interference between parallel sessions

### Routing

```
App.tsx changes:
  - Add nav item: { path: "/chat", label: "Chat", icon: "◆" }
  - Add route: <Route path="/chat" element={<Chat />} />
  - Add route: <Route path="/chat/:sessionId" element={<Chat />} />
```

## Components

### Chat (pages/Chat.tsx)

Main page container. Left-right split layout:
- Left: ChatSidebar (session list + new button)
- Right: ChatThread (tab bar + message area + input)

```
┌─────────────────────────────────────────────────────┐
│              Chat Page                               │
│  ┌──────────┬───────────────────────────────────┐   │
│  │          │  [Tab A] [Tab B ×] [Tab C ×] [+]  │   │
│  │ Session  │  ┌─────────────────────────────┐  │   │
│  │ List     │  │ Session Header (name, status)│  │   │
│  │          │  ├─────────────────────────────┤  │   │
│  │ • New    │  │                              │  │   │
│  │ • A      │  │  Messages (scrollable)       │  │   │
│  │ • B      │  │                              │  │   │
│  │ • C      │  │                              │  │   │
│  │          │  ├─────────────────────────────┤  │   │
│  │          │  │  Textarea        [Send]      │  │   │
│  │          │  └─────────────────────────────┘  │   │
│  └──────────┴───────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### ChatSidebar (components/ChatSidebar.tsx)

- Lists sessions from `useSessions()` (React Query, shared with Sessions page)
- "New Session" button → calls `createSession` mutation, auto-switches to it
- Click session → opens new tab or focuses existing tab
- Shows session status indicator (idle/running/error)

### ChatThread (components/ChatThread.tsx)

- Tab bar: each tab represents an open session
- Tab close → unsubscribe WS + clear streaming state for that session
- Active tab: renders ChatMessage list + ChatInput
- Uses `eventsBySession[sessionId]` from sessionStore for message data
- Each tab independently manages its `useSessionStream(sessionId)`

### ChatMessage (components/ChatMessage.tsx)

- Renders a single message bubble
- Message types are NOT stored in sessionStore — they are derived from events:
  - **User messages**: Stored locally in ChatThread component state as `ChatMessage { role: "user", text, timestamp }`
  - **Agent messages**: Derived from `eventsBySession[sessionId]` — `text_delta` events are concatenated into agent responses
- User messages: right-aligned, distinct background
- Agent responses: left-aligned, Markdown rendering via `react-markdown`
- Code blocks highlighted with `react-syntax-highlighter`
- Shows event type labels for non-text events (tool_use, etc.)
- Streaming indicator (pulsing "..." or typing animation)

**Rationale**: User prompt text is not part of the ACP event stream. The backend's `runTurn` receives it as a parameter but doesn't echo it back as an event. Storing user messages locally in the ChatThread component keeps sessionStore clean and avoids polluting `AcpEvent` with synthetic types.

### ChatInput (components/ChatInput.tsx)

- Textarea with auto-resize
- Enter to send, Shift+Enter for newline
- Send button
- Disabled state: while session is streaming or not connected
- Empty state: placeholder text

## State Changes

### sessionStore.ts

```typescript
// Current → New
sessionId: string | null           → activeSessionId: string | null
events: AcpEvent[]                 → eventsBySession: Record<string, AcpEvent[]>
isStreaming: boolean               → streamingSessions: Set<string>
connectedSessionIds: string[]      → (unchanged, still string[])

// New actions
addSessionEvent: (sessionId, event) => void
clearSessionEvents: (sessionId) => void
setSessionStreaming: (sessionId, isStreaming) => void
```

### Backward Compatibility

```typescript
// Derived getters for existing consumers
get events(): AcpEvent[] { return eventsBySession[activeSessionId] || []; }
get isStreaming(): boolean { return streamingSessions.size > 0; }
```

This ensures Sessions.tsx and History.tsx continue to work without changes.

## Message Sending

```
User types message → POST prompt to backend
  → ChatThread local state: add user message bubble
  → subscribe(sessionId) to establish WS if not connected
  → backend: sessionService.runTurn(handle, text)
  → WS streams ACP events back
  → sessionStore: addSessionEvent(sessionId, acpEvent) for each event
  → ChatMessage re-renders agent response from eventsBySession[sessionId]
```

User messages are stored in ChatThread component state, not in sessionStore. Agent responses come from the ACP event stream via sessionStore.

The existing `sessionService.runTurn` is used — no backend changes needed for Phase 1 (pure text).

## File Changes Summary

### New Files
- `frontend/src/pages/Chat.tsx`
- `frontend/src/components/ChatSidebar.tsx`
- `frontend/src/components/ChatThread.tsx`
- `frontend/src/components/ChatMessage.tsx`
- `frontend/src/components/ChatInput.tsx`
- `frontend/src/hooks/useMultiSessionEvents.ts`

### Modified Files
- `frontend/src/App.tsx` — add /chat route and sidebar nav entry
- `frontend/src/stores/sessionStore.ts` — eventsBySession, streamingSessions, backward-compat getters

## Future Phases

### Phase 2: File Upload
- `POST /api/sessions/:id/upload` endpoint
- Store files in `~/.acpx/sessions/{id}/uploads/`
- ChatInput with file attachment UI
- Files referenced by path in prompt text

### Phase 2b: Image Support
- Image files rendered inline in ChatMessage (markdown image syntax)
- Agent reads images from local filesystem path
