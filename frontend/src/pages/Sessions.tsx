import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessions } from "../hooks/useSessions";
import { useCreateSession, useCloseSession } from "../hooks/useMutations";
import { useSessionStore } from "../stores/sessionStore";
import SessionCard from "../components/SessionCard";
import CreateSessionModal from "../components/CreateSessionModal";
import type { CreateSessionOptions } from "../api/sessions";

function SessionSkeleton() {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="h-5 bg-surface-600 rounded w-3/4 mb-2" />
          <div className="h-3 bg-surface-600 rounded w-1/2" />
        </div>
        <div className="h-6 bg-surface-600 rounded-full w-16" />
      </div>
      <div className="mb-4">
        <div className="h-5 bg-surface-600 rounded w-20" />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-surface-700/50">
        <div className="h-3 bg-surface-600 rounded w-24" />
        <div className="flex items-center gap-2">
          <div className="h-7 bg-surface-600 rounded w-14" />
          <div className="h-7 bg-surface-600 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
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
        Failed to load sessions
      </h3>
      <p className="text-text-muted text-sm mb-4">
        There was an error fetching your sessions. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
        <span className="text-3xl text-text-muted">◎</span>
      </div>
      <h3 className="text-text-primary font-semibold text-lg mb-2">
        No sessions yet
      </h3>
      <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
        Create a new session to start interacting with agents and manage your
        conversations.
      </p>
      <button
        onClick={onCreate}
        className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
      >
        Create Session
      </button>
    </div>
  );
}

export default function Sessions() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const createSessionMutation = useCreateSession();
  const closeSessionMutation = useCloseSession();
  const connectedSessionIds = useSessionStore((state) => state.connectedSessionIds);

  const handleCreateSession = (options: CreateSessionOptions) => {
    createSessionMutation.mutate(options, {
      onSuccess: () => {
        setIsModalOpen(false);
      },
    });
  };

  const handleCloseSession = (id: string) => {
    closeSessionMutation.mutate(id);
  };

  const handleResumeSession = (id: string) => {
    navigate(`/history?session=${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Sessions</h2>
          <p className="text-text-muted text-sm mt-1">
            Manage your agent sessions
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors flex items-center gap-2"
        >
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Session
        </button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SessionSkeleton key={i} />)}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.acpxRecordId}
              session={session}
              onClose={handleCloseSession}
              onResume={handleResumeSession}
              isActive={connectedSessionIds.includes(session.acpxRecordId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onCreate={() => setIsModalOpen(true)} />
      )}

      <CreateSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSession}
        isLoading={createSessionMutation.isPending}
      />
    </div>
  );
}
