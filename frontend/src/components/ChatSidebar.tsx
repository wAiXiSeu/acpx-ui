import { useSessions } from "../hooks/useSessions";
import { useSessionStore } from "../stores/sessionStore";
import type { SessionRecord } from "../types/acpx";

interface ChatSidebarProps {
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

function SessionSkeleton() {
  return (
    <div className="px-3 py-2.5 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-surface-600" />
        <div className="h-4 bg-surface-600 rounded w-3/4" />
      </div>
      <div className="h-3 bg-surface-600 rounded w-1/2 ml-4" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center mb-3">
        <span className="text-xl text-text-muted">◎</span>
      </div>
      <p className="text-text-primary text-sm font-medium mb-1">No sessions yet</p>
      <p className="text-text-muted text-xs">Create your first session to get started</p>
    </div>
  );
}

function getStatusIndicator(session: SessionRecord, isConnected: boolean): { color: string; label: string; dotColor: string } {
  if (isConnected) {
    return { color: "text-accent-success", label: "running", dotColor: "bg-accent-success" };
  }
  if (session.closed) {
    return { color: "text-text-muted", label: "closed", dotColor: "bg-text-muted" };
  }
  if (session.lastAgentExitCode !== null && session.lastAgentExitCode !== undefined) {
    return { color: "text-accent-error", label: "error", dotColor: "bg-accent-error" };
  }
  return { color: "text-accent-warning", label: "idle", dotColor: "bg-accent-warning" };
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface SessionItemProps {
  session: SessionRecord;
  isConnected: boolean;
  onSelect: (id: string) => void;
}

function SessionItem({ session, isConnected, onSelect }: SessionItemProps) {
  const status = getStatusIndicator(session, isConnected);
  const displayName = session.name || session.title || `Session ${session.acpxRecordId.slice(0, 8)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(session.acpxRecordId)}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-700/50 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotColor} ${
            status.label === "running" ? "animate-pulse" : ""
          }`}
        />
        <span className="text-text-primary text-sm font-medium truncate flex-1">
          {displayName}
        </span>
        <span className={`text-xs font-medium capitalize ${status.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
          {status.label}
        </span>
      </div>
      <p className="text-text-muted text-xs ml-4">
        {formatRelativeTime(session.lastUsedAt)}
      </p>
    </button>
  );
}

export default function ChatSidebar({ onSelectSession, onNewSession }: ChatSidebarProps) {
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const connectedSessionIds = useSessionStore((state) => state.connectedSessionIds);

  return (
    <div className="flex flex-col h-full bg-surface-800 border-r border-surface-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <h2 className="text-text-primary font-semibold text-sm">Sessions</h2>
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-accent-primary rounded-lg hover:bg-accent-primary/90 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Session
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto py-2">
        {isError ? (
          <div className="px-4 py-6 text-center">
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-accent-error/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-text-muted text-xs mb-2">Failed to load sessions</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs text-accent-primary hover:underline"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          sessions.map((session) => (
            <SessionItem
              key={session.acpxRecordId}
              session={session}
              isConnected={connectedSessionIds.includes(session.acpxRecordId)}
              onSelect={onSelectSession}
            />
          ))
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
