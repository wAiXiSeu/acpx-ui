import { useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useMultiSessionEvents } from "../hooks/useMultiSessionEvents";
import { useSessionStore } from "../stores/sessionStore";

interface ChatThreadProps {
  activeSessionId: string | null;
  onSessionChange: (id: string) => void;
  onSessionClose: (id: string) => void;
}

interface MessageEntry {
  role: "user" | "agent";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function ChatThread({
  activeSessionId,
  onSessionChange,
  onSessionClose,
}: ChatThreadProps) {
  // Open tabs state
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  // User messages per session
  const [userMessagesBySession, setUserMessagesBySession] = useState<
    Map<string, MessageEntry[]>
  >(new Map());

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive the set of session IDs to subscribe to (only open tabs)
  const { subscribeSession, unsubscribeSession, isSessionStreaming } =
    useMultiSessionEvents(openTabs);

  // Subscribe when a tab is opened
  useEffect(() => {
    if (activeSessionId && openTabs.includes(activeSessionId)) {
      subscribeSession(activeSessionId);
    }
    // We intentionally only subscribe on mount of the active tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, openTabs.length]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSessionId, userMessagesBySession.size, openTabs.length]);

  // Also scroll when agent events arrive for the active session
  const eventsBySession = useSessionStore((s) => s.eventsBySession);
  useEffect(() => {
    if (activeSessionId && eventsBySession[activeSessionId]) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSessionId, eventsBySession]);

  const handleTabClick = (sessionId: string) => {
    onSessionChange(sessionId);
  };

  const handleTabClose = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Unsubscribe WS + clear streaming state
    unsubscribeSession(sessionId);
    useSessionStore.getState().setSessionStreaming(sessionId, false);
    useSessionStore.getState().clearSessionEvents(sessionId);

    const newTabs = openTabs.filter((id) => id !== sessionId);
    setOpenTabs(newTabs);

    // Clear user messages for this tab
    setUserMessagesBySession((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });

    // If we closed the active tab, switch to the last remaining tab or null
    if (sessionId === activeSessionId) {
      if (newTabs.length > 0) {
        onSessionChange(newTabs[newTabs.length - 1]);
      } else {
        onSessionClose(sessionId);
      }
    } else {
      onSessionClose(sessionId);
    }
  };

  // Open a new tab for the given session if not already open
  useEffect(() => {
    if (activeSessionId && !openTabs.includes(activeSessionId)) {
      setOpenTabs((prev) => [...prev, activeSessionId]);
    }
  }, [activeSessionId, openTabs]);

  const handleSend = (text: string) => {
    if (!activeSessionId) return;

    const userMsg: MessageEntry = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setUserMessagesBySession((prev) => {
      const next = new Map(prev);
      const existing = next.get(activeSessionId) ?? [];
      next.set(activeSessionId, [...existing, userMsg]);
      return next;
    });

    // The actual "send prompt" integration with the backend happens separately.
    // For now we just store the message locally and let the WS streaming
    // deliver agent events through eventsBySession.
    // TODO: wire up sessionService.runTurn or equivalent REST endpoint.
    subscribeSession(activeSessionId);
  };

  // Build the message list for the active session
  const activeUserMessages = activeSessionId
    ? userMessagesBySession.get(activeSessionId) ?? []
    : [];

  const activeEvents = activeSessionId
    ? eventsBySession[activeSessionId] ?? []
    : [];

  const activeStreaming = activeSessionId
    ? isSessionStreaming(activeSessionId)
    : false;

  // Build agent messages from events
  const agentMessages: MessageEntry[] = [];
  if (activeEvents.length > 0) {
    // Group text_delta events into continuous agent messages
    // A simple approach: each batch of consecutive text_delta events between
    // non-text events forms one agent message.
    let currentText = "";
    let currentStartTs: number | null = null;

    for (const event of activeEvents) {
      if (event.type === "text_delta") {
        if (currentStartTs === null) {
          currentStartTs = event.timestamp;
        }
        currentText += (event.payload?.text as string) ?? "";
      } else if (event.type === "session_done" || event.type === "error") {
        // Flush accumulated text
        if (currentText) {
          agentMessages.push({
            role: "agent",
            content: currentText,
            timestamp: currentStartTs ?? Date.now(),
            isStreaming: false,
          });
          currentText = "";
          currentStartTs = null;
        }
      }
    }

    // Flush any remaining text (still streaming)
    if (currentText) {
      agentMessages.push({
        role: "agent",
        content: currentText,
        timestamp: currentStartTs ?? Date.now(),
        isStreaming: activeStreaming,
      });
    }
  }

  // Interleave user and agent messages by timestamp
  const allMessages: MessageEntry[] = [...activeUserMessages, ...agentMessages].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // Connection status for the active session
  const connectedSessionIds = useSessionStore((s) => s.connectedSessionIds);
  const isActiveConnected = activeSessionId
    ? connectedSessionIds.includes(activeSessionId)
    : false;

  // Session display name helper
  const getSessionDisplayName = (sessionId: string): string => {
    // Try to find a meaningful name from connected session info
    return `Session ${sessionId.slice(0, 8)}`;
  };

  return (
    <div className="flex flex-col h-full bg-surface-900">
      {/* Tab Bar */}
      {openTabs.length > 0 && (
        <div className="flex items-center bg-surface-800 border-b border-surface-700 overflow-x-auto">
          {openTabs.map((tabId) => {
            const isActive = tabId === activeSessionId;
            const isTabStreaming = tabId
              ? isSessionStreaming(tabId)
              : false;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => handleTabClick(tabId)}
                className={`group flex items-center gap-2 px-4 py-2.5 text-sm border-r border-surface-700 transition-colors min-w-0 max-w-48 ${
                  isActive
                    ? "bg-surface-900 text-text-primary border-b-2 border-b-accent-primary"
                    : "bg-surface-800 text-text-muted hover:text-text-primary hover:bg-surface-700"
                }`}
              >
                {/* Streaming indicator dot */}
                {isTabStreaming && (
                  <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-left">
                  {getSessionDisplayName(tabId)}
                </span>
                {/* Close button */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleTabClose(tabId, e)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-600 text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
                >
                  &times;
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {activeSessionId ? (
        <>
          {/* Session Header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-800 border-b border-surface-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isActiveConnected
                  ? "bg-accent-success"
                  : activeStreaming
                  ? "bg-accent-primary animate-pulse"
                  : "bg-text-muted"
              }`}
            />
            <span className="text-sm font-medium text-text-primary truncate">
              {getSessionDisplayName(activeSessionId)}
            </span>
            <span className="text-xs text-text-muted ml-auto">
              {isActiveConnected
                ? "Connected"
                : activeStreaming
                ? "Streaming..."
                : "Disconnected"}
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {allMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-text-muted">
                <div className="text-center">
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Send a message to start the conversation</p>
                </div>
              </div>
            ) : (
              <>
                {allMessages.map((msg, idx) => (
                  <ChatMessage
                    key={`${activeSessionId}-${idx}`}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    isStreaming={msg.isStreaming}
                  />
                ))}
                {/* Streaming placeholder when no content yet */}
                {activeStreaming &&
                  agentMessages.length === 0 &&
                  activeUserMessages.length > 0 && (
                    <ChatMessage
                      role="agent"
                      content=""
                      timestamp={Date.now()}
                      isStreaming
                    />
                  )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <ChatInput
            onSend={handleSend}
            disabled={!activeSessionId}
            placeholder="Type a message..."
          />
        </>
      ) : (
        /* No Active Session */
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-sm">No session selected</p>
            <p className="text-xs mt-1">Select or create a session to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
