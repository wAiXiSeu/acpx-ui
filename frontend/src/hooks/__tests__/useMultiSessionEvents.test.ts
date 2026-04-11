import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AcpEvent } from '../../types/acpx';

// ---- Mock useSessionStore (must be before any imports that use it) ----
const mockStreamingSessions = new Set<string>();
const mockEventsBySession: Record<string, AcpEvent[]> = {};
const mockSetSessionStreaming = vi.fn((sessionId: string, isStreaming: boolean) => {
  if (isStreaming) {
    mockStreamingSessions.add(sessionId);
  } else {
    mockStreamingSessions.delete(sessionId);
  }
});

vi.mock('../../stores/sessionStore', () => {
  const fn = () => ({
    setSessionStreaming: mockSetSessionStreaming,
  });
  (fn as any).getState = () => ({
    eventsBySession: { ...mockEventsBySession },
    streamingSessions: new Set(mockStreamingSessions),
  });
  return { useSessionStore: fn };
});

// ---- Mock useSessionStream ----
const mockStreamFns = new Map<string, {
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  reconnect: ReturnType<typeof vi.fn>;
}>();

vi.mock('../useSessionStream', () => ({
  useSessionStream: (sessionId: string | null) => {
    if (!sessionId || !mockStreamFns.has(sessionId)) {
      return {
        isConnected: false,
        isReconnecting: false,
        error: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        disconnect: vi.fn(),
        reconnect: vi.fn(),
      };
    }
    const m = mockStreamFns.get(sessionId)!;
    return {
      isConnected: true,
      isReconnecting: false,
      error: null,
      subscribe: m.subscribe,
      unsubscribe: m.unsubscribe,
      disconnect: m.disconnect,
      reconnect: m.reconnect,
    };
  },
}));

function setupMockStream(sessionId: string) {
  const mocks = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  };
  mockStreamFns.set(sessionId, mocks);
  return mocks;
}

function resetState() {
  mockStreamFns.clear();
  mockStreamingSessions.clear();
  Object.keys(mockEventsBySession).forEach(k => delete mockEventsBySession[k]);
  mockSetSessionStreaming.mockClear();
}

// Import the hook AFTER mocks are set up
import { useMultiSessionEvents } from '../useMultiSessionEvents';

describe('useMultiSessionEvents', () => {
  beforeEach(() => {
    resetState();
  });

  it('should subscribe to all active sessions on mount', () => {
    const m1 = setupMockStream('s1');
    const m2 = setupMockStream('s2');

    renderHook(() => useMultiSessionEvents(['s1', 's2']));

    expect(m1.subscribe).toHaveBeenCalledWith('s1');
    expect(m2.subscribe).toHaveBeenCalledWith('s2');
  });

  it('should set session streaming state on mount', () => {
    setupMockStream('s1');
    setupMockStream('s2');

    renderHook(() => useMultiSessionEvents(['s1', 's2']));

    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s1', true);
    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s2', true);
  });

  it('should unsubscribe and clean up when session is removed from active list', () => {
    const m1 = setupMockStream('s1');
    const m2 = setupMockStream('s2');

    const { rerender } = renderHook(
      ({ sessions }: { sessions: string[] }) => useMultiSessionEvents(sessions),
      { initialProps: { sessions: ['s1', 's2'] } },
    );

    expect(m1.subscribe).toHaveBeenCalledTimes(1);
    expect(m2.subscribe).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ sessions: ['s1'] });
    });

    expect(m2.unsubscribe).toHaveBeenCalledWith('s2');
    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s2', false);
  });

  it('should subscribe to new sessions added to active list', () => {
    const m1 = setupMockStream('s1');
    const m3 = setupMockStream('s3');

    const { rerender } = renderHook(
      ({ sessions }: { sessions: string[] }) => useMultiSessionEvents(sessions),
      { initialProps: { sessions: ['s1'] } },
    );

    expect(m1.subscribe).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ sessions: ['s1', 's3'] });
    });

    expect(m3.subscribe).toHaveBeenCalledWith('s3');
    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s3', true);
  });

  it('should clean up all subscriptions on unmount', () => {
    const m1 = setupMockStream('s1');
    const m2 = setupMockStream('s2');

    const { unmount } = renderHook(() => useMultiSessionEvents(['s1', 's2']));

    unmount();

    expect(m1.unsubscribe).toHaveBeenCalledWith('s1');
    expect(m2.unsubscribe).toHaveBeenCalledWith('s2');
    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s1', false);
    expect(mockSetSessionStreaming).toHaveBeenCalledWith('s2', false);
  });

  it('getEvents should return events for a session', () => {
    const event: AcpEvent = {
      type: 'text_delta',
      sessionId: 's1',
      timestamp: 1,
      payload: { text: 'hello' },
    };
    mockEventsBySession['s1'] = [event];

    setupMockStream('s1');
    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    const events = result.current.getEvents('s1');
    expect(events).toEqual([event]);
  });

  it('getEvents should return empty array for unknown session', () => {
    setupMockStream('s1');
    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    expect(result.current.getEvents('unknown')).toEqual([]);
  });

  it('isSessionStreaming should reflect store state', () => {
    mockStreamingSessions.add('s1');

    setupMockStream('s1');
    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    expect(result.current.isSessionStreaming('s1')).toBe(true);
    expect(result.current.isSessionStreaming('unknown')).toBe(false);
  });

  it('subscribeSession should subscribe an already-subscribed session', () => {
    const m1 = setupMockStream('s1');

    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    m1.subscribe.mockClear();

    act(() => {
      result.current.subscribeSession('s1');
    });

    expect(m1.subscribe).toHaveBeenCalledWith('s1');
  });

  it('subscribeSession should warn for session not in active list', () => {
    setupMockStream('s1');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    act(() => {
      result.current.subscribeSession('s2');
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('unsubscribeSession should clean up a subscribed session', () => {
    const m1 = setupMockStream('s1');

    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    act(() => {
      result.current.unsubscribeSession('s1');
    });

    expect(m1.unsubscribe).toHaveBeenCalledWith('s1');
  });

  it('unsubscribeSession should be idempotent for unknown session', () => {
    setupMockStream('s1');

    const { result } = renderHook(() => useMultiSessionEvents(['s1']));

    expect(() => {
      act(() => {
        result.current.unsubscribeSession('unknown');
      });
    }).not.toThrow();
  });

  it('should handle empty activeSessionIds', () => {
    const { result } = renderHook(() => useMultiSessionEvents([]));

    expect(result.current.getEvents('any')).toEqual([]);
    expect(result.current.isSessionStreaming('any')).toBe(false);
  });

  it('should manage events for multiple sessions independently', () => {
    const e1: AcpEvent = {
      type: 'text_delta',
      sessionId: 's1',
      timestamp: 1,
      payload: { text: 'from s1' },
    };
    const e2: AcpEvent = {
      type: 'text_delta',
      sessionId: 's2',
      timestamp: 2,
      payload: { text: 'from s2' },
    };
    mockEventsBySession['s1'] = [e1];
    mockEventsBySession['s2'] = [e2];

    setupMockStream('s1');
    setupMockStream('s2');

    const { result } = renderHook(() => useMultiSessionEvents(['s1', 's2']));

    expect(result.current.getEvents('s1')).toEqual([e1]);
    expect(result.current.getEvents('s2')).toEqual([e2]);
  });
});
