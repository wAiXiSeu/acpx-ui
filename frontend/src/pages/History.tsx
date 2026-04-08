import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSessions, useSession, useHistory } from "../hooks/useSessions";
import TimelineView from "../components/history/TimelineView";
import ConversationView from "../components/history/ConversationView";
import ActionLogView from "../components/history/ActionLogView";
import ChatView from "../components/ChatView";
import type { SessionRecord } from "../types/acpx";

type TabType = "chat" | "timeline" | "conversation" | "actionlog";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
        active
          ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/25"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SessionSelector({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: SessionRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedSession = sessions.find((s) => s.acpxRecordId === selectedId);

  return (
    <div className="relative">
      <select
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none w-64 bg-surface-800 border border-surface-600 text-text-primary text-sm rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors cursor-pointer"
      >
        <option value="" disabled>
          Select a session...
        </option>
        {sessions.map((session) => (
          <option key={session.acpxRecordId} value={session.acpxRecordId}>
            {session.name || session.title || `Session ${session.acpxRecordId.slice(0, 8)}`}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {selectedSession && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <span
            className={`w-2 h-2 rounded-full ${
              selectedSession.closed
                ? "bg-surface-500"
                : selectedSession.pid
                ? "bg-accent-success animate-pulse"
                : "bg-accent-warning"
            }`}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold text-lg mb-2">
        No session selected
      </h3>
      <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
        Select a session from the dropdown above to view its history, timeline, and actions.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-12">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Loading session data...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="bg-surface-800 border border-accent-error/30 rounded-xl p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent-error/10 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-accent-error"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold mb-2">
        Failed to load history
      </h3>
      <p className="text-text-muted text-sm mb-4">{error.message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("timeline");
  
  const sessionIdFromUrl = searchParams.get("session");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionIdFromUrl);

  const { data: sessions } = useSessions();
  const { data: session, isLoading: isLoadingSession, error: sessionError, refetch: refetchSession } = useSession(selectedSessionId || "");
  const { data: history, isLoading: isLoadingHistory, error: historyError, refetch: refetchHistory } = useHistory(selectedSessionId || "");

  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("session");
    if (sessionIdFromUrl && sessionIdFromUrl !== selectedSessionId) {
      setSelectedSessionId(sessionIdFromUrl);
    }
  }, [searchParams]);

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    setSearchParams({ session: id });
  };

  const isLoading = isLoadingSession || isLoadingHistory;
  const error = sessionError || historyError;

  const handleRetry = () => {
    refetchSession();
    refetchHistory();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">History</h2>
          <p className="text-text-muted text-sm mt-1">
            Browse session timeline, conversation, and actions
          </p>
        </div>
        {sessions && sessions.length > 0 && (
          <SessionSelector
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={handleSelectSession}
          />
        )}
      </div>

      {selectedSessionId && (
        <div className="flex items-center gap-2 p-1 bg-surface-800 border border-surface-700 rounded-xl">
          <TabButton
            active={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            label="Chat"
          />
          <TabButton
            active={activeTab === "timeline"}
            onClick={() => setActiveTab("timeline")}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Timeline"
          />
          <TabButton
            active={activeTab === "conversation"}
            onClick={() => setActiveTab("conversation")}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
            label="History"
          />
          <TabButton
            active={activeTab === "actionlog"}
            onClick={() => setActiveTab("actionlog")}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            }
            label="Actions"
          />
        </div>
      )}

      {!selectedSessionId ? (
        <EmptyState />
      ) : activeTab === "chat" ? (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <ChatView sessionId={selectedSessionId} />
        </div>
      ) : isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={handleRetry} />
      ) : session && history ? (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          {activeTab === "timeline" && (
            <TimelineView session={session} history={history} />
          )}
          {activeTab === "conversation" && (
            <ConversationView session={session} history={history} />
          )}
          {activeTab === "actionlog" && (
            <ActionLogView session={session} history={history} />
          )}
        </div>
      ) : null}
    </div>
  );
}
