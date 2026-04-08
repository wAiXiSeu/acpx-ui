import { useSessions } from "../hooks/useSessions";
import { useFlows } from "../hooks/useFlows";
import { useSessionStore } from "../stores/sessionStore";

export default function Home() {
  const { data: sessions } = useSessions();
  const { data: flows } = useFlows();
  const connectedSessionIds = useSessionStore((state) => state.connectedSessionIds);

  const activeSessionsCount = sessions?.filter((s) => 
    !s.closed && (s.pid || connectedSessionIds.includes(s.acpxRecordId))
  ).length || 0;
  const totalSessions = sessions?.length || 0;
  const closedSessions = sessions?.filter((s) => s.closed).length || 0;
  
  const runningFlows = flows?.filter((f) => f.manifest.status === "running").length || 0;
  const completedFlows = flows?.filter((f) => f.manifest.status === "completed").length || 0;
  const failedFlows = flows?.filter((f) => f.manifest.status === "failed").length || 0;
  const totalFlows = flows?.length || 0;

  const successRate = totalFlows > 0 
    ? Math.round((completedFlows / totalFlows) * 100) 
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text-primary">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
          <div className="text-text-muted text-sm mb-2">Active Sessions</div>
          <div className="text-3xl font-bold text-accent-primary">
            {activeSessionsCount}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {totalSessions} total, {closedSessions} closed
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
          <div className="text-text-muted text-sm mb-2">Running Flows</div>
          <div className="text-3xl font-bold text-accent-success">
            {runningFlows}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {totalFlows} total
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
          <div className="text-text-muted text-sm mb-2">Completed Flows</div>
          <div className="text-3xl font-bold text-accent-info">
            {completedFlows}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {failedFlows} failed
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
          <div className="text-text-muted text-sm mb-2">Success Rate</div>
          <div className="text-3xl font-bold text-accent-secondary">
            {successRate !== null ? `${successRate}%` : "-"}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {totalFlows > 0 ? "based on flows" : "no flows yet"}
          </div>
        </div>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">
          Welcome to acpx-ui
        </h3>
        <p className="text-text-secondary mb-4">
          This is the dashboard for the Agent Client Protocol UI. Use the
          sidebar to navigate between sessions, flows, and history.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-surface-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💬</span>
              <span className="font-medium text-text-primary">Sessions</span>
            </div>
            <p className="text-text-muted text-sm">
              Create and manage agent sessions for conversations
            </p>
          </div>
          
          <div className="bg-surface-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⬡</span>
              <span className="font-medium text-text-primary">Flows</span>
            </div>
            <p className="text-text-muted text-sm">
              Visualize multi-step agent workflows
            </p>
          </div>
          
          <div className="bg-surface-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📜</span>
              <span className="font-medium text-text-primary">History</span>
            </div>
            <p className="text-text-muted text-sm">
              Browse past conversations and actions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
