import { useState, useEffect, useRef } from "react";
import { useSessionStream } from "../hooks/useSessionStream";
import { useSessionStore } from "../stores/sessionStore";
import type { SessionMessage } from "../types/acpx";

interface ChatViewProps {
  sessionId: string;
}

function MessageBubble({ message }: { message: SessionMessage }) {
  if ("User" in message) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-accent-primary text-white rounded-lg px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{message.User}</p>
        </div>
      </div>
    );
  }

  if ("Agent" in message) {
    const content = message.Agent.content;
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] bg-surface-700 text-text-primary rounded-lg px-4 py-2">
          {content.map((block, idx) => {
            if ("Text" in block) {
              return (
                <p key={idx} className="text-sm whitespace-pre-wrap">{block.Text}</p>
              );
            }
            if ("Thinking" in block) {
              return (
                <div key={idx} className="text-xs text-text-muted italic mb-2 p-2 bg-surface-800 rounded">
                  💭 {block.Thinking.text}
                </div>
              );
            }
            if ("ToolUse" in block) {
              return (
                <div key={idx} className="text-xs bg-surface-800 rounded p-2 mb-2">
                  <span className="text-accent-warning">🔧 {block.ToolUse.name}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return null;
}

export default function ChatView({ sessionId }: ChatViewProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { isConnected, isReconnecting, error, sendPrompt, reconnect } = useSessionStream(sessionId);
  const { messages, isStreaming, setSession } = useSessionStore();

  useEffect(() => {
    setSession(sessionId);
  }, [sessionId, setSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    if (!isConnected) {
      console.warn('[ChatView] Cannot send - not connected');
      return;
    }
    
    console.log('[ChatView] Sending prompt:', inputText.trim().substring(0, 50));
    sendPrompt(inputText.trim());
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">💬</div>
              <p>Start a conversation with the agent</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="bg-surface-700 rounded-lg px-4 py-2">
                  <span className="text-sm text-text-muted animate-pulse">
                    Agent is thinking...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-surface-700 p-4">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isStreaming || !isConnected}
            className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 text-text-primary text-sm resize-none focus:outline-none focus:border-accent-primary disabled:opacity-50"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !isConnected || !inputText.trim()}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <span className="animate-spin">⟳</span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}