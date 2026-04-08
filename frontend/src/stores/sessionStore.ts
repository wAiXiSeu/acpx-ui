import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SessionMessage, SessionTokenUsage } from '../types/acpx';

interface SessionState {
  sessionId: string | null;
  isStreaming: boolean;
  messages: SessionMessage[];
  activePrompt: string;
  tokenUsage: SessionTokenUsage;
  connectedSessionIds: string[];
}

interface SessionActions {
  setSession: (sessionId: string | null) => void;
  clearSession: () => void;
  clearMessages: () => void;
  addMessage: (message: SessionMessage) => void;
  setStreaming: (isStreaming: boolean) => void;
  updateTokenUsage: (usage: Partial<SessionTokenUsage>) => void;
  setActivePrompt: (prompt: string) => void;
  markSessionConnected: (sessionId: string) => void;
  markSessionDisconnected: (sessionId: string) => void;
}

type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  sessionId: null,
  isStreaming: false,
  messages: [],
  activePrompt: '',
  tokenUsage: {},
  connectedSessionIds: [],
};

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setSession: (sessionId) => set({ sessionId, messages: [] }),

    clearSession: () =>
      set({
        sessionId: null,
        isStreaming: false,
        messages: [],
        activePrompt: '',
        tokenUsage: {},
      }),

    clearMessages: () => set({ messages: [] }),

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),

    setStreaming: (isStreaming) => set({ isStreaming }),

    updateTokenUsage: (usage) =>
      set((state) => ({
        tokenUsage: { ...state.tokenUsage, ...usage },
      })),

    setActivePrompt: (activePrompt) => set({ activePrompt }),

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
  }))
);