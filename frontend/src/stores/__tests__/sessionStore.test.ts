import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';
import type { AcpEvent } from '../../types/acpx';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionId: null,
      isStreaming: false,
      events: [],
      connectedSessionIds: [],
      lastError: null,
    });
  });

  it('should initialize with default state', () => {
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
    expect(state.events).toEqual([]);
    expect(state.connectedSessionIds).toEqual([]);
    expect(state.lastError).toBeNull();
  });

  it('should set session and clear events', () => {
    useSessionStore.getState().setSession('session-1');
    const state = useSessionStore.getState();
    expect(state.sessionId).toBe('session-1');
    expect(state.events).toEqual([]);
    expect(state.lastError).toBeNull();
  });

  it('should clear session', () => {
    useSessionStore.getState().setSession('session-1');
    useSessionStore.getState().clearSession();
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
    expect(state.events).toEqual([]);
    expect(state.connectedSessionIds).toEqual([]);
  });

  it('should add event', () => {
    const event: AcpEvent = {
      type: 'text_delta',
      sessionId: 'session-1',
      timestamp: Date.now(),
      payload: { text: 'Hello' },
    };
    useSessionStore.getState().addEvent(event);
    expect(useSessionStore.getState().events).toHaveLength(1);
    expect(useSessionStore.getState().events[0]).toEqual(event);
  });

  it('should set streaming state', () => {
    useSessionStore.getState().setStreaming(true);
    expect(useSessionStore.getState().isStreaming).toBe(true);
    useSessionStore.getState().setStreaming(false);
    expect(useSessionStore.getState().isStreaming).toBe(false);
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

  it('should set error', () => {
    useSessionStore.getState().setError('Connection failed');
    expect(useSessionStore.getState().lastError).toBe('Connection failed');
    useSessionStore.getState().setError(null);
    expect(useSessionStore.getState().lastError).toBeNull();
  });
});
