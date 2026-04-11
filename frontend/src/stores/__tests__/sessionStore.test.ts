import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';
import type { AcpEvent } from '../../types/acpx';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionId: null,
      activeSessionId: null,
      isStreaming: false,
      streamingSessions: new Set(),
      events: [],
      eventsBySession: {},
      connectedSessionIds: [],
      lastError: null,
    });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.activeSessionId).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.streamingSessions).toEqual(new Set());
      expect(state.events).toEqual([]);
      expect(state.eventsBySession).toEqual({});
      expect(state.connectedSessionIds).toEqual([]);
      expect(state.lastError).toBeNull();
    });
  });

  describe('setSession / clearSession', () => {
    it('should set session and clear events', () => {
      useSessionStore.getState().setSession('session-1');
      const state = useSessionStore.getState();
      expect(state.sessionId).toBe('session-1');
      expect(state.activeSessionId).toBe('session-1');
      expect(state.events).toEqual([]);
      expect(state.lastError).toBeNull();
    });

    it('should set activeSessionId alongside sessionId for backward compat', () => {
      useSessionStore.getState().setSession('session-1');
      const state = useSessionStore.getState();
      expect(state.sessionId).toBe(state.activeSessionId);
    });

    it('should clear session', () => {
      useSessionStore.getState().setSession('session-1');
      useSessionStore.getState().clearSession();
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.activeSessionId).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.events).toEqual([]);
      // Note: connectedSessionIds is not checked here because beforeEach resets it to []
    });

    it('should preserve connectedSessionIds when clearing session', () => {
      useSessionStore.getState().markSessionConnected('session-1');
      useSessionStore.getState().markSessionConnected('session-2');
      useSessionStore.getState().setSession('session-1');
      useSessionStore.getState().clearSession();
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.activeSessionId).toBeNull();
      expect(state.connectedSessionIds).toContain('session-1');
      expect(state.connectedSessionIds).toContain('session-2');
    });

    it('should populate events when setting session to a session with existing events', () => {
      // Add events for session-1 via the new multi-session action
      useSessionStore.getState().addSessionEvent('session-1', {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'hello' },
      });
      // Now set session to session-1
      useSessionStore.getState().setSession('session-1');
      const state = useSessionStore.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0].payload).toEqual({ text: 'hello' });
    });
  });

  describe('addEvent (backward compat)', () => {
    it('should add event to events array', () => {
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

    it('should also store event in eventsBySession', () => {
      const event: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: Date.now(),
        payload: { text: 'Hello' },
      };
      useSessionStore.getState().addEvent(event);
      const eventsBySession = useSessionStore.getState().eventsBySession;
      expect(eventsBySession['session-1']).toHaveLength(1);
      expect(eventsBySession['session-1'][0]).toEqual(event);
    });

    it('should update flat events only when event sessionId matches activeSessionId', () => {
      useSessionStore.getState().setSession('session-1');
      const event1: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'active' },
      };
      const event2: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-2',
        timestamp: 2,
        payload: { text: 'other' },
      };
      useSessionStore.getState().addEvent(event1);
      useSessionStore.getState().addEvent(event2);
      const state = useSessionStore.getState();
      // Flat events should only contain event1 (active session)
      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toEqual(event1);
      // But eventsBySession should have both
      expect(state.eventsBySession['session-1']).toHaveLength(1);
      expect(state.eventsBySession['session-2']).toHaveLength(1);
    });
  });

  describe('setStreaming (backward compat)', () => {
    it('should set streaming state', () => {
      useSessionStore.getState().setStreaming(true);
      expect(useSessionStore.getState().isStreaming).toBe(true);
      useSessionStore.getState().setStreaming(false);
      expect(useSessionStore.getState().isStreaming).toBe(false);
    });
  });

  describe('connected sessions', () => {
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

  describe('error', () => {
    it('should set error', () => {
      useSessionStore.getState().setError('Connection failed');
      expect(useSessionStore.getState().lastError).toBe('Connection failed');
      useSessionStore.getState().setError(null);
      expect(useSessionStore.getState().lastError).toBeNull();
    });
  });

  describe('multi-session: addSessionEvent', () => {
    it('should add event to the correct session', () => {
      const event: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: Date.now(),
        payload: { text: 'Hello' },
      };
      useSessionStore.getState().addSessionEvent('session-1', event);
      const eventsBySession = useSessionStore.getState().eventsBySession;
      expect(eventsBySession['session-1']).toHaveLength(1);
      expect(eventsBySession['session-1'][0]).toEqual(event);
    });

    it('should add events to different sessions independently', () => {
      const event1: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'Hello from 1' },
      };
      const event2: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-2',
        timestamp: 2,
        payload: { text: 'Hello from 2' },
      };
      useSessionStore.getState().addSessionEvent('session-1', event1);
      useSessionStore.getState().addSessionEvent('session-2', event2);
      const state = useSessionStore.getState();
      expect(state.eventsBySession['session-1']).toEqual([event1]);
      expect(state.eventsBySession['session-2']).toEqual([event2]);
    });

    it('should update flat events when adding to active session', () => {
      useSessionStore.getState().setSession('session-1');
      const event: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'Hello' },
      };
      useSessionStore.getState().addSessionEvent('session-1', event);
      expect(useSessionStore.getState().events).toEqual([event]);
    });

    it('should not update flat events when adding to non-active session', () => {
      useSessionStore.getState().setSession('session-1');
      const event: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-2',
        timestamp: 1,
        payload: { text: 'Hello' },
      };
      useSessionStore.getState().addSessionEvent('session-2', event);
      expect(useSessionStore.getState().events).toEqual([]);
    });
  });

  describe('multi-session: clearSessionEvents', () => {
    it('should clear events for a specific session', () => {
      const event1: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'Hello' },
      };
      const event2: AcpEvent = {
        type: 'text_delta',
        sessionId: 'session-2',
        timestamp: 2,
        payload: { text: 'World' },
      };
      useSessionStore.getState().addSessionEvent('session-1', event1);
      useSessionStore.getState().addSessionEvent('session-2', event2);
      useSessionStore.getState().clearSessionEvents('session-1');
      const state = useSessionStore.getState();
      expect(state.eventsBySession['session-1']).toBeUndefined();
      expect(state.eventsBySession['session-2']).toEqual([event2]);
    });

    it('should clear flat events when clearing active session events', () => {
      useSessionStore.getState().setSession('session-1');
      useSessionStore.getState().addSessionEvent('session-1', {
        type: 'text_delta',
        sessionId: 'session-1',
        timestamp: 1,
        payload: { text: 'Hello' },
      });
      useSessionStore.getState().clearSessionEvents('session-1');
      expect(useSessionStore.getState().events).toEqual([]);
    });
  });

  describe('multi-session: setSessionStreaming', () => {
    it('should add session to streaming set', () => {
      useSessionStore.getState().setSessionStreaming('session-1', true);
      expect(useSessionStore.getState().streamingSessions).toContain('session-1');
    });

    it('should remove session from streaming set', () => {
      useSessionStore.getState().setSessionStreaming('session-1', true);
      useSessionStore.getState().setSessionStreaming('session-1', false);
      expect(useSessionStore.getState().streamingSessions).not.toContain('session-1');
    });

    it('should set isStreaming to true when any session is streaming', () => {
      useSessionStore.getState().setSessionStreaming('session-1', true);
      expect(useSessionStore.getState().isStreaming).toBe(true);
    });

    it('should set isStreaming to false when no sessions are streaming', () => {
      useSessionStore.getState().setSessionStreaming('session-1', true);
      useSessionStore.getState().setSessionStreaming('session-2', true);
      useSessionStore.getState().setSessionStreaming('session-1', false);
      useSessionStore.getState().setSessionStreaming('session-2', false);
      expect(useSessionStore.getState().isStreaming).toBe(false);
    });

    it('should support multiple sessions streaming in parallel', () => {
      useSessionStore.getState().setSessionStreaming('session-1', true);
      useSessionStore.getState().setSessionStreaming('session-2', true);
      useSessionStore.getState().setSessionStreaming('session-3', true);
      const streaming = useSessionStore.getState().streamingSessions;
      expect(streaming.size).toBe(3);
      expect(streaming.has('session-1')).toBe(true);
      expect(streaming.has('session-2')).toBe(true);
      expect(streaming.has('session-3')).toBe(true);
    });
  });
});
