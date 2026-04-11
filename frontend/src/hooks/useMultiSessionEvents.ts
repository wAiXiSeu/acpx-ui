import { useEffect, useRef } from 'react';
import { useSessionStream } from './useSessionStream';
import { useSessionStore } from '../stores/sessionStore';
import type { AcpEvent } from '../types/acpx';
import type { UseSessionStreamReturn } from './useSessionStream';

interface SessionSubscription {
  stream: UseSessionStreamReturn;
  cleanup: () => void;
}

interface UseMultiSessionEventsReturn {
  subscribeSession: (sessionId: string) => void;
  unsubscribeSession: (sessionId: string) => void;
  getEvents: (sessionId: string) => AcpEvent[];
  isSessionStreaming: (sessionId: string) => boolean;
}

/**
 * Manages a collection of per-session WebSocket stream connections.
 *
 * Each session gets its own useSessionStream instance (1 sessionId = 1 WS connection).
 * Call this hook with the list of session IDs to manage at the component level.
 *
 * @param activeSessionIds - Array of session IDs to maintain stream hooks for.
 *   The hook calls useSessionStream for each entry, so callers should include
 *   every sessionId they may want to subscribe to.
 */
export function useMultiSessionEvents(
  activeSessionIds: string[],
): UseMultiSessionEventsReturn {
  const subscriptionsRef = useRef<Map<string, SessionSubscription>>(new Map());
  const { setSessionStreaming } = useSessionStore();

  // Call useSessionStream for each active session ID (must be unconditional)
  const streams: UseSessionStreamReturn[] = [];
  for (const sessionId of activeSessionIds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const stream = useSessionStream(sessionId);
    streams.push(stream);
  }

  // Sync the subscriptions map with the current stream instances
  useEffect(() => {
    for (let i = 0; i < activeSessionIds.length; i++) {
      const sessionId = activeSessionIds[i];
      const stream = streams[i];

      if (!subscriptionsRef.current.has(sessionId)) {
        subscriptionsRef.current.set(sessionId, {
          stream,
          cleanup: () => {
            stream.unsubscribe(sessionId);
            setSessionStreaming(sessionId, false);
          },
        });
        stream.subscribe(sessionId);
        setSessionStreaming(sessionId, true);
      } else {
        // Update the stream reference (it may have new callback identities)
        const existing = subscriptionsRef.current.get(sessionId)!;
        subscriptionsRef.current.set(sessionId, {
          stream,
          cleanup: existing.cleanup,
        });
      }
    }

    // Unsubscribe from sessions no longer in the active list
    for (const sessionId of subscriptionsRef.current.keys()) {
      if (!activeSessionIds.includes(sessionId)) {
        const sub = subscriptionsRef.current.get(sessionId);
        sub?.cleanup();
        subscriptionsRef.current.delete(sessionId);
      }
    }
  }, [activeSessionIds, streams, setSessionStreaming]);

  // Clean up all subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const [, sub] of subscriptionsRef.current) {
        sub.cleanup();
      }
      subscriptionsRef.current.clear();
    };
  }, []);

  const subscribeSession = (sessionId: string) => {
    const existing = subscriptionsRef.current.get(sessionId);
    if (existing) {
      existing.stream.subscribe(sessionId);
      setSessionStreaming(sessionId, true);
      return;
    }

    // Find the stream for this session from the current render
    const idx = activeSessionIds.indexOf(sessionId);
    if (idx === -1) {
      console.warn(
        `[useMultiSessionEvents] Cannot subscribe to session "${sessionId}" — not in activeSessionIds.`,
      );
      return;
    }

    const stream = streams[idx];
    subscriptionsRef.current.set(sessionId, {
      stream,
      cleanup: () => {
        stream.unsubscribe(sessionId);
        setSessionStreaming(sessionId, false);
      },
    });
    stream.subscribe(sessionId);
    setSessionStreaming(sessionId, true);
  };

  const unsubscribeSession = (sessionId: string) => {
    const sub = subscriptionsRef.current.get(sessionId);
    if (sub) {
      sub.cleanup();
      subscriptionsRef.current.delete(sessionId);
    }
  };

  const getEvents = (sessionId: string): AcpEvent[] => {
    return useSessionStore.getState().eventsBySession[sessionId] ?? [];
  };

  const isSessionStreaming = (sessionId: string): boolean => {
    return useSessionStore.getState().streamingSessions.has(sessionId);
  };

  return {
    subscribeSession,
    unsubscribeSession,
    getEvents,
    isSessionStreaming,
  };
}
