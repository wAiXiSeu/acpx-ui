import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsServerMessage, WsClientMessage } from '../types/websocket';
import { useSessionStore } from '../stores/sessionStore';

const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const currentPort = window.location.port;
    const backendPort = currentPort === '3000' ? '3001' : '3001';
    return `${protocol}//${host}:${backendPort}`;
  }
  return 'ws://localhost:3001';
};

const WS_URL = getWsUrl();

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000];
const MAX_RECONNECT_ATTEMPTS = 10;

interface UseWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  error: string | null;
  send: (message: WsClientMessage) => void;
  disconnect: () => void;
  reconnect: () => void;
  lastMessage: WsServerMessage | null;
}

export function useWebSocket(sessionId: string | null): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WsServerMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
  const sessionIdRef = useRef(sessionId);
  const reconnectAttemptRef = useRef(0);

  const markSessionConnected = useSessionStore((state) => state.markSessionConnected);
  const markSessionDisconnected = useSessionStore((state) => state.markSessionDisconnected);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    reconnectAttemptRef.current = reconnectAttempt;
  }, [reconnectAttempt]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || !shouldReconnectRef.current) {
      return;
    }

    const wsUrl = `${WS_URL}/ws/session/${currentSessionId}`;
    console.log('[WebSocket] Connecting to:', wsUrl);

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setIsReconnecting(false);
        setReconnectAttempt(0);
        setError(null);
        const currentSessionId = sessionIdRef.current;
        if (currentSessionId) {
          markSessionConnected(currentSessionId);
        }
      };

      socket.onmessage = (event) => {
        try {
          const message: WsServerMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch {
          setError('Failed to parse WebSocket message');
        }
      };

      socket.onclose = (event) => {
        console.log('[WebSocket] Closed:', event.code, event.reason);
        setIsConnected(false);
        socketRef.current = null;
        const currentSessionId = sessionIdRef.current;
        if (currentSessionId) {
          markSessionDisconnected(currentSessionId);
        }

        const currentAttempt = reconnectAttemptRef.current;
        if (!event.wasClean && shouldReconnectRef.current && currentAttempt < MAX_RECONNECT_ATTEMPTS) {
          setIsReconnecting(true);
          const delay = BACKOFF_DELAYS[Math.min(currentAttempt, BACKOFF_DELAYS.length - 1)];
          setReconnectAttempt((prev) => prev + 1);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          setIsReconnecting(false);
          if (!event.wasClean && currentAttempt >= MAX_RECONNECT_ATTEMPTS) {
            setError('Connection failed. Backend may not be running. Please restart the backend server.');
          }
        }
      };

      socket.onerror = (e) => {
        console.error('[WebSocket] Error:', e);
        setError('WebSocket connection error - backend may not be running');
      };
    } catch (e) {
      console.error('[WebSocket] Failed to create connection:', e);
      setError('Failed to create WebSocket connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();

    if (socketRef.current) {
      socketRef.current.close(1000, 'User disconnect');
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setError(null);
  }, [clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    disconnect();
    shouldReconnectRef.current = true;
    setReconnectAttempt(0);
    setError(null);
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  const send = useCallback((message: WsClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      shouldReconnectRef.current = true;
      setReconnectAttempt(0);
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId]);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempt,
    error,
    send,
    disconnect,
    reconnect,
    lastMessage,
  };
}