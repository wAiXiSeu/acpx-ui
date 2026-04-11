import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AcpEvent } from '../types/acpx';

interface SessionState {
  /** @deprecated Use activeSessionId instead. Kept for backward compatibility. */
  sessionId: string | null;
  activeSessionId: string | null;
  /** @deprecated Use streamingSessions instead. Kept for backward compatibility. */
  isStreaming: boolean;
  streamingSessions: Set<string>;
  /** @deprecated Use eventsBySession instead. Kept for backward compatibility. */
  events: AcpEvent[];
  eventsBySession: Record<string, AcpEvent[]>;
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
  // New multi-session actions
  addSessionEvent: (sessionId: string, event: AcpEvent) => void;
  clearSessionEvents: (sessionId: string) => void;
  setSessionStreaming: (sessionId: string, isStreaming: boolean) => void;
}

type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  sessionId: null,
  activeSessionId: null,
  isStreaming: false,
  streamingSessions: new Set(),
  events: [],
  eventsBySession: {},
  connectedSessionIds: [],
  lastError: null,
};

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setSession: (sessionId) => {
      const sessionEvents = sessionId ? (get().eventsBySession[sessionId] ?? []) : [];
      set({
        sessionId,
        activeSessionId: sessionId,
        events: sessionEvents,
        lastError: null,
      });
    },

    clearSession: () => set({
      sessionId: null,
      activeSessionId: null,
      isStreaming: false,
      streamingSessions: new Set(),
      events: [],
      eventsBySession: {},
      lastError: null,
      // Note: connectedSessionIds is intentionally NOT cleared — other sessions may still be active
    }),

    addEvent: (event) => {
      const sid = event.sessionId;
      set((state) => {
        const existing = state.eventsBySession[sid] ?? [];
        const updated = { ...state.eventsBySession, [sid]: [...existing, event] };
        // Update flat events: always when no active session (backward compat),
        // or when the event's sessionId matches the active session
        const events =
          state.activeSessionId === null || sid === state.activeSessionId
            ? [...state.events, event]
            : state.events;
        return { eventsBySession: updated, events };
      });
    },

    setStreaming: (isStreaming) =>
      set((state) => {
        // Old API: update streamingSessions based on activeSessionId
        const nextSessions = new Set(state.streamingSessions);
        if (state.activeSessionId) {
          if (isStreaming) {
            nextSessions.add(state.activeSessionId);
          } else {
            nextSessions.delete(state.activeSessionId);
          }
        }
        return { isStreaming, streamingSessions: nextSessions };
      }),

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

    // New multi-session actions
    addSessionEvent: (sessionId, event) =>
      set((state) => {
        const existing = state.eventsBySession[sessionId] ?? [];
        const updated = { ...state.eventsBySession, [sessionId]: [...existing, event] };
        // Update flat events: always when no active session,
        // or when the sessionId matches the active session
        const events =
          state.activeSessionId === null || sessionId === state.activeSessionId
            ? [...state.events, event]
            : state.events;
        return { eventsBySession: updated, events };
      }),

    clearSessionEvents: (sessionId) =>
      set((state) => {
        const { [sessionId]: _, ...rest } = state.eventsBySession;
        const events = sessionId === state.activeSessionId ? [] : state.events;
        return { eventsBySession: rest, events };
      }),

    setSessionStreaming: (sessionId, isStreaming) =>
      set((state) => {
        const next = new Set(state.streamingSessions);
        if (isStreaming) {
          next.add(sessionId);
        } else {
          next.delete(sessionId);
        }
        return {
          streamingSessions: next,
          isStreaming: next.size > 0,
        };
      }),
  }))
);
