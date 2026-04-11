import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatSidebar from "../components/ChatSidebar";
import ChatThread from "../components/ChatThread";
import { useCreateSession } from "../hooks/useMutations";

export default function Chat() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionId ?? null
  );
  const createSessionMutation = useCreateSession();

  // Sync URL param with local state
  useEffect(() => {
    if (sessionId) {
      setActiveSessionId(sessionId);
    }
  }, [sessionId]);

  const handleNewSession = async () => {
    try {
      const result = await createSessionMutation.mutateAsync({
        agent: "default",
      });
      navigate(`/chat/${result.handle}`);
    } catch {
      // Let the mutation error handling deal with UI feedback
    }
  };

  const handleSelectSession = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleSessionChange = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleSessionClose = (_id: string) => {
    // Just update local state, no route change
    setActiveSessionId(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      <div className="w-[280px] flex-shrink-0">
        <ChatSidebar
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
        />
      </div>
      <div className="flex-1 min-w-0">
        <ChatThread
          activeSessionId={activeSessionId}
          onSessionChange={handleSessionChange}
          onSessionClose={handleSessionClose}
        />
      </div>
    </div>
  );
}
