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
