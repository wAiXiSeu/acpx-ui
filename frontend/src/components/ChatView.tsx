import { useEffect, useRef } from "react";
import { useSessionStream } from "../hooks/useSessionStream";
import { useSessionStore } from "../stores/sessionStore";
import type { AcpEvent } from "../types/acpx";

interface ChatViewProps {
  sessionId: string;
}

function EventRow({ event }: { event: AcpEvent }) {
  return (
    <div className="mb-3 p-3 bg-surface-700 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded">
          {event.type}
        </span>
        <span className="text-xs text-text-muted">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {event.payload && (
        <pre className="text-xs text-text-secondary whitespace-pre-wrap overflow-auto max-h-48">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ChatView({ sessionId }: ChatViewProps) {
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, isReconnecting, error, subscribe, reconnect } = useSessionStream(sessionId);
  const { events, isStreaming, setSession } = useSessionStore();

  useEffect(() => {
    setSession(sessionId);
    subscribe(sessionId);
    return () => {
      // cleanup handled by component unmount
    };
  }, [sessionId, setSession, subscribe]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-800 border-b border-surface-700">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected
              ? "bg-accent-success"
              : isReconnecting
              ? "bg-accent-warning animate-pulse"
              : "bg-accent-error"
          }`}
        />
        <span className="text-xs text-text-muted">
          {isConnected
            ? "Connected"
            : isReconnecting
            ? "Reconnecting..."
            : "Disconnected"}
        </span>
        {error && (
          <span className="text-xs text-accent-error ml-2 flex-1">{error}</span>
        )}
        {!isConnected && !isReconnecting && (
          <button
            onClick={reconnect}
            className="text-xs px-2 py-1 bg-accent-primary text-white rounded hover:bg-accent-primary/80"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">📡</div>
              <p>Waiting for events...</p>
              {isStreaming && (
                <p className="text-sm mt-2 animate-pulse">Streaming active</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {events.map((event, idx) => (
              <EventRow key={idx} event={event} />
            ))}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="bg-surface-700 rounded-lg px-4 py-2">
                  <span className="text-sm text-text-muted animate-pulse">
                    Streaming...
                  </span>
                </div>
              </div>
            )}
            <div ref={eventsEndRef} />
          </>
        )}
      </div>
    </div>
  );
}
