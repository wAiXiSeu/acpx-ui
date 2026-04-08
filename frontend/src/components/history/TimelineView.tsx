import { useState, useRef, useEffect } from "react";
import type { SessionRecord, SessionMessage, SessionToolUse, SessionToolResult } from "../../types/acpx";

interface TimelineViewProps {
  session: SessionRecord;
  history: SessionMessage[];
}

type EventType = "prompt" | "response" | "tool_use" | "tool_result" | "error" | "system";

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  title: string;
  description: string;
  details?: unknown;
}

function getEventColor(type: EventType): string {
  switch (type) {
    case "prompt":
      return "bg-accent-info border-accent-info/50";
    case "response":
      return "bg-accent-primary border-accent-primary/50";
    case "tool_use":
      return "bg-accent-warning border-accent-warning/50";
    case "tool_result":
      return "bg-accent-success border-accent-success/50";
    case "error":
      return "bg-accent-error border-accent-error/50";
    case "system":
      return "bg-surface-500 border-surface-400";
    default:
      return "bg-surface-600 border-surface-500";
  }
}

function getEventIcon(type: EventType): React.ReactNode {
  switch (type) {
    case "prompt":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case "response":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "tool_use":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "tool_result":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "error":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "system":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      );
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}



function extractEvents(history: SessionMessage[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  history.forEach((message, idx) => {
    if (message === "Resume") {
      events.push({
        id: `resume-${idx}`,
        type: "system",
        timestamp: new Date().toISOString(),
        title: "Session Resumed",
        description: "The session was resumed from a previous state",
      });
      return;
    }

    if ("User" in message) {
      const userMsg = message.User;
      const textContent = userMsg.content
        .filter((c): c is { Text: string } => "Text" in c)
        .map((c) => c.Text)
        .join(" ")
        .slice(0, 100);

      events.push({
        id: `prompt-${idx}`,
        type: "prompt",
        timestamp: new Date().toISOString(),
        title: "User Prompt",
        description: textContent || "Image or mention",
        details: userMsg,
      });
    } else if ("Agent" in message) {
      const agentMsg = message.Agent;

      agentMsg.content.forEach((content, contentIdx) => {
        if ("Text" in content) {
          events.push({
            id: `response-${idx}-${contentIdx}`,
            type: "response",
            timestamp: new Date().toISOString(),
            title: "Agent Response",
            description: content.Text.slice(0, 100) + (content.Text.length > 100 ? "..." : ""),
            details: content,
          });
        } else if ("Thinking" in content) {
          events.push({
            id: `thinking-${idx}-${contentIdx}`,
            type: "system",
            timestamp: new Date().toISOString(),
            title: "Agent Thinking",
            description: content.Thinking.text.slice(0, 100) + "...",
            details: content,
          });
        } else if ("ToolUse" in content) {
          const toolUse: SessionToolUse = content.ToolUse;
          events.push({
            id: `tool-use-${toolUse.id}`,
            type: "tool_use",
            timestamp: new Date().toISOString(),
            title: `Tool: ${toolUse.name}`,
            description: toolUse.raw_input.slice(0, 100) || "No input",
            details: toolUse,
          });
        }
      });

      Object.entries(agentMsg.tool_results).forEach(([toolId, result]) => {
        const toolResult = result as SessionToolResult;
        events.push({
          id: `tool-result-${toolId}`,
          type: toolResult.is_error ? "error" : "tool_result",
          timestamp: new Date().toISOString(),
          title: `Result: ${toolResult.tool_name}`,
          description: toolResult.is_error ? "Error occurred" : "Completed successfully",
          details: toolResult,
        });
      });
    }
  });

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function EventDetailModal({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-800 border border-surface-600 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${getEventColor(event.type).split(" ")[0]}`}>
              {getEventIcon(event.type)}
            </div>
            <div>
              <h3 className="text-text-primary font-semibold">{event.title}</h3>
              <p className="text-text-muted text-xs">{formatTime(event.timestamp)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[60vh]">
          <div className="mb-4">
            <h4 className="text-text-secondary text-sm font-medium mb-2">Description</h4>
            <p className="text-text-primary text-sm">{event.description}</p>
          </div>
          {event.details ? (
            <div>
              <h4 className="text-text-secondary text-sm font-medium mb-2">Details</h4>
              <pre className="bg-surface-900 border border-surface-700 rounded-lg p-3 text-xs text-text-secondary overflow-auto max-h-96 font-mono">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function TimelineView({ session, history }: TimelineViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const events = extractEvents(history);

  useEffect(() => {
    if (scrollRef.current && events.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-text-primary font-semibold text-lg mb-2">No events yet</h3>
        <p className="text-text-muted text-sm">This session has no recorded events.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm">
            {events.length} events
          </span>
          <span className="text-text-muted text-sm">
            Session started {new Date(session.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-text-secondary text-sm min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-thin pb-4"
        style={{ cursor: "grab" }}
      >
        <div
          className="flex items-start gap-4 min-w-max px-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: "left top" }}
        >
          {events.map((event, index) => (
            <div
              key={event.id}
              className="flex flex-col items-center group cursor-pointer"
              onClick={() => setSelectedEvent(event)}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-200 group-hover:scale-110 ${getEventColor(
                  event.type
                )}`}
              >
                {getEventIcon(event.type)}
              </div>
              <div className="mt-3 text-center max-w-[120px]">
                <p className="text-text-primary text-xs font-medium truncate">{event.title}</p>
                <p className="text-text-muted text-[10px] mt-0.5">{formatTime(event.timestamp)}</p>
              </div>
              {index < events.length - 1 && (
                <div className="absolute left-full top-6 w-4 h-0.5 bg-surface-600" style={{ transform: "translateX(8px)" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-surface-700">
        <h4 className="text-text-secondary text-sm font-medium mb-3">Event Types</h4>
        <div className="flex flex-wrap gap-3">
          {[
            { type: "prompt" as EventType, label: "User Prompt" },
            { type: "response" as EventType, label: "Agent Response" },
            { type: "tool_use" as EventType, label: "Tool Use" },
            { type: "tool_result" as EventType, label: "Tool Result" },
            { type: "error" as EventType, label: "Error" },
            { type: "system" as EventType, label: "System" },
          ].map(({ type, label }) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getEventColor(type).split(" ")[0]}`} />
              <span className="text-text-muted text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
