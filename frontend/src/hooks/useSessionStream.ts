import { useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionStore } from '../stores/sessionStore';
import type { AcpEvent } from '../types/acpx';

export interface UseSessionStreamReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  subscribe: (sessionId: string) => void;
  unsubscribe: (sessionId: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useSessionStream(sessionId: string | null): UseSessionStreamReturn {
  const {
    isConnected,
    isReconnecting,
    error: wsError,
    send,
    disconnect,
    reconnect,
    lastMessage,
  } = useWebSocket(sessionId);

  const { addEvent, setStreaming } = useSessionStore();

  const streamingTextRef = useRef<string>('');
  const streamingThoughtRef = useRef<string>('');

  const flushBuffer = useCallback(() => {
    const outputText = streamingTextRef.current;
    const thoughtText = streamingThoughtRef.current;
    if (outputText || thoughtText) {
      addEvent({
        type: 'text_delta',
        sessionId: sessionId || '',
        timestamp: Date.now(),
        payload: { text: outputText, thought: thoughtText || undefined },
      });
      streamingTextRef.current = '';
      streamingThoughtRef.current = '';
    }
  }, [addEvent, sessionId]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'event': {
        const event = lastMessage.data as AcpEvent;
        addEvent(event);

        if (event.type === 'text_delta') {
          const text = (event.payload as any)?.text || '';
          if (text) {
            streamingTextRef.current += text;
          }
        }
        break;
      }

      case 'session_done':
        setStreaming(false);
        flushBuffer();
        break;

      case 'session_update':
        break;

      case 'pong':
        break;

      case 'error':
        console.error('WS error:', lastMessage.message);
        setStreaming(false);
        flushBuffer();
        break;
    }
  }, [lastMessage, addEvent, setStreaming, flushBuffer]);

  const subscribe = useCallback((sid: string) => {
    send({ type: 'subscribe', sessionId: sid });
    setStreaming(true);
    streamingTextRef.current = '';
    streamingThoughtRef.current = '';
  }, [send, setStreaming]);

  const unsubscribe = useCallback((sid: string) => {
    send({ type: 'unsubscribe', sessionId: sid });
    flushBuffer();
  }, [send, flushBuffer]);

  return {
    isConnected,
    isReconnecting,
    error: wsError,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
  };
}
