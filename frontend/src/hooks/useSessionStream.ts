import { useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionStore } from '../stores/sessionStore';
import { useUIStore } from '../stores/uiStore';
import type { WsPermissionParams, PermissionResponseKind } from '../types/websocket';
import type { SessionMessage, SessionAgentContent } from '../types/acpx';

interface UseSessionStreamReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  sendPrompt: (text: string, handle?: unknown) => void;
  cancelStream: () => void;
  sendPermissionResponse: (requestId: string, kind: PermissionResponseKind) => void;
  disconnect: () => void;
  reconnect: () => void;
  currentPermission: WsPermissionParams | null;
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

  const {
    setStreaming,
    addMessage,
    updateTokenUsage,
  } = useSessionStore();

  const {
    showPermissionModal,
    closeModal,
    addToast,
  } = useUIStore();

  const currentPermissionRef = useRef<WsPermissionParams | null>(null);
  const streamingTextRef = useRef<string>('');
  const streamingThoughtRef = useRef<string>('');

  const handleTextDelta = useCallback((text: string, stream?: 'output' | 'thought') => {
    if (stream === 'thought') {
      streamingThoughtRef.current += text;
    } else {
      streamingTextRef.current += text;
    }
  }, []);

  const flushStreamingText = useCallback(() => {
    const outputText = streamingTextRef.current;
    const thoughtText = streamingThoughtRef.current;

    if (outputText || thoughtText) {
      const content: SessionAgentContent[] = [];

      if (thoughtText) {
        content.push({ Thinking: { text: thoughtText } });
      }

      if (outputText) {
        content.push({ Text: outputText });
      }

      const agentMessage: SessionMessage = {
        Agent: {
          content,
          tool_results: {},
        },
      };

      addMessage(agentMessage);
      streamingTextRef.current = '';
      streamingThoughtRef.current = '';
    }
  }, [addMessage]);

  const handleStatus = useCallback((_text: string, used?: number, size?: number) => {
    if (used !== undefined && size !== undefined) {
      updateTokenUsage({
        input_tokens: used,
        output_tokens: size - used,
      });
    }
  }, [updateTokenUsage]);

  const handleToolCall = useCallback((text: string, toolCallId?: string, _status?: string, title?: string) => {
    const toolMessage: SessionMessage = {
      Agent: {
        content: [{ ToolUse: { id: toolCallId || '', name: title || text, raw_input: '', input: {}, is_input_complete: true } }],
        tool_results: {},
      },
    };
    addMessage(toolMessage);
  }, [addMessage]);

  const handlePermissionRequest = useCallback((params: WsPermissionParams) => {
    currentPermissionRef.current = params;
    showPermissionModal(params);
  }, [showPermissionModal]);

  const handleError = useCallback((message: string, _code?: string, _retryable?: boolean) => {
    addToast(message, 'error');
    setStreaming(false);
    flushStreamingText();
  }, [addToast, setStreaming, flushStreamingText]);

  const handleDone = useCallback((_stopReason?: string) => {
    setStreaming(false);
    flushStreamingText();
    currentPermissionRef.current = null;
    closeModal();
  }, [setStreaming, flushStreamingText, closeModal]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'text_delta':
        handleTextDelta(lastMessage.text, lastMessage.stream);
        break;

      case 'status':
        handleStatus(lastMessage.text, lastMessage.used, lastMessage.size);
        break;

      case 'tool_call':
        handleToolCall(lastMessage.text, lastMessage.toolCallId, lastMessage.status, lastMessage.title);
        break;

      case 'permission_request':
        handlePermissionRequest(lastMessage.params);
        break;

      case 'error':
        handleError(lastMessage.message, lastMessage.code, lastMessage.retryable);
        break;

      case 'done':
        handleDone(lastMessage.stopReason);
        break;

      case 'pong':
        break;
    }
  }, [lastMessage, handleTextDelta, handleStatus, handleToolCall, handlePermissionRequest, handleError, handleDone]);

  const sendPrompt = useCallback((text: string, handle?: unknown) => {
    setStreaming(true);
    streamingTextRef.current = '';
    streamingThoughtRef.current = '';
    send({ type: 'prompt', text, handle, sessionId });
  }, [setStreaming, send, sessionId]);

  const cancelStream = useCallback(() => {
    send({ type: 'cancel' });
    setStreaming(false);
    flushStreamingText();
  }, [send, setStreaming, flushStreamingText]);

  const sendPermissionResponse = useCallback((requestId: string, kind: PermissionResponseKind) => {
    send({ type: 'permission_response', requestId, response: kind });
    currentPermissionRef.current = null;
    closeModal();
  }, [send, closeModal]);

  return {
    isConnected,
    isReconnecting,
    error: wsError,
    sendPrompt,
    cancelStream,
    sendPermissionResponse,
    disconnect,
    reconnect,
    currentPermission: currentPermissionRef.current,
  };
}