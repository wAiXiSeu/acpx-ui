import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';
import type { SessionMessage } from '../../types/acpx';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionId: null,
      isStreaming: false,
      messages: [],
      activePrompt: '',
      tokenUsage: {},
      connectedSessionIds: [],
    });
  });

  it('should initialize with default state', () => {
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
    expect(state.messages).toEqual([]);
    expect(state.activePrompt).toBe('');
    expect(state.connectedSessionIds).toEqual([]);
  });

  it('should set session and clear messages', () => {
    useSessionStore.getState().setSession('session-1');
    const state = useSessionStore.getState();
    expect(state.sessionId).toBe('session-1');
    expect(state.messages).toEqual([]);
  });

  it('should clear session', () => {
    useSessionStore.getState().setSession('session-1');
    useSessionStore.getState().clearSession();
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
    expect(state.messages).toEqual([]);
  });

  it('should add message', () => {
    const message: SessionMessage = {
      User: {
        id: 'msg-1',
        content: [{ Text: 'Hello' }],
      },
    };
    useSessionStore.getState().addMessage(message);
    expect(useSessionStore.getState().messages).toHaveLength(1);
    expect(useSessionStore.getState().messages[0]).toEqual(message);
  });

  it('should set streaming state', () => {
    useSessionStore.getState().setStreaming(true);
    expect(useSessionStore.getState().isStreaming).toBe(true);
    useSessionStore.getState().setStreaming(false);
    expect(useSessionStore.getState().isStreaming).toBe(false);
  });

  it('should update token usage', () => {
    useSessionStore.getState().updateTokenUsage({ inputTokens: 100 });
    expect(useSessionStore.getState().tokenUsage.inputTokens).toBe(100);
    useSessionStore.getState().updateTokenUsage({ outputTokens: 50 });
    expect(useSessionStore.getState().tokenUsage.outputTokens).toBe(50);
    expect(useSessionStore.getState().tokenUsage.inputTokens).toBe(100);
  });

  it('should set active prompt', () => {
    useSessionStore.getState().setActivePrompt('Test prompt');
    expect(useSessionStore.getState().activePrompt).toBe('Test prompt');
  });

  it('should mark session connected', () => {
    useSessionStore.getState().markSessionConnected('session-1');
    expect(useSessionStore.getState().connectedSessionIds).toContain('session-1');
  });

  it('should not duplicate connected session', () => {
    useSessionStore.getState().markSessionConnected('session-1');
    useSessionStore.getState().markSessionConnected('session-1');
    expect(useSessionStore.getState().connectedSessionIds).toHaveLength(1);
  });

  it('should mark session disconnected', () => {
    useSessionStore.getState().markSessionConnected('session-1');
    useSessionStore.getState().markSessionDisconnected('session-1');
    expect(useSessionStore.getState().connectedSessionIds).not.toContain('session-1');
  });
});
