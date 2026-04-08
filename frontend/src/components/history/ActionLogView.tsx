import { useState, useMemo } from "react";
import type { SessionRecord, SessionMessage, SessionToolUse, SessionToolResult } from "../../types/acpx";

interface ActionLogViewProps {
  session: SessionRecord;
  history: SessionMessage[];
}

type ActionType = "file_read" | "file_write" | "terminal" | "tool_call" | "system";

interface ActionItem {
  id: string;
  timestamp: string;
  type: ActionType;
  action: string;
  target: string;
  status: "success" | "error" | "running" | "pending";
  details?: unknown;
  duration?: number;
}

const ACTION_TYPE_FILTERS: { type: ActionType | "all"; label: string; icon: React.ReactNode }[] = [
  {
    type: "all",
    label: "All Actions",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    type: "file_read",
    label: "File Read",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    type: "file_write",
    label: "File Write",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    type: "terminal",
    label: "Terminal",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: "tool_call",
    label: "Tool Calls",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getStatusColor(status: ActionItem["status"]): string {
  switch (status) {
    case "success":
      return "bg-accent-success/20 text-accent-success border-accent-success/30";
    case "error":
      return "bg-accent-error/20 text-accent-error border-accent-error/30";
    case "running":
      return "bg-accent-warning/20 text-accent-warning border-accent-warning/30";
    case "pending":
      return "bg-surface-600 text-text-muted border-surface-500";
    default:
      return "bg-surface-600 text-text-muted";
  }
}

function getStatusIcon(status: ActionItem["status"]): React.ReactNode {
  switch (status) {
    case "success":
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "error":
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case "running":
      return (
        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "pending":
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function extractActions(history: SessionMessage[]): ActionItem[] {
  const actions: ActionItem[] = [];
  let actionIndex = 0;

  history.forEach((msg) => {
    if (msg === "Resume") {
      actions.push({
        id: `resume-${actionIndex++}`,
        timestamp: new Date().toISOString(),
        type: "system",
        action: "Session Resume",
        target: "-",
        status: "success",
      });
      return;
    }

    if ("Agent" in msg) {
      const agentMsg = msg.Agent;

      agentMsg.content.forEach((content) => {
        if ("ToolUse" in content) {
          const toolUse: SessionToolUse = content.ToolUse;
          actions.push({
            id: `tool-use-${toolUse.id}`,
            timestamp: new Date().toISOString(),
            type: "tool_call",
            action: toolUse.name,
            target: toolUse.raw_input.slice(0, 50) || "No input",
            status: "running",
            details: toolUse,
          });
        }
      });

      Object.entries(agentMsg.tool_results).forEach(([toolId, result]) => {
        const toolResult = result as SessionToolResult;
        const existingAction = actions.find((a) => a.id === `tool-use-${toolId}`);

        if (existingAction) {
          existingAction.status = toolResult.is_error ? "error" : "success";
          const existingDetails = existingAction.details as Record<string, unknown> | undefined;
          existingAction.details = { ...existingDetails, result: toolResult };
        } else {
          actions.push({
            id: `tool-result-${toolId}`,
            timestamp: new Date().toISOString(),
            type: "tool_call",
            action: toolResult.tool_name,
            target: "Tool execution result",
            status: toolResult.is_error ? "error" : "success",
            details: toolResult,
          });
        }
      });
    }
  });

  return actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function ActionDetailPanel({ action, onClose }: { action: ActionItem; onClose: () => void }) {
  return (
    <div className="border-t border-surface-700 bg-surface-900/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(action.status)}`}>
            {getStatusIcon(action.status)}
            {action.status}
          </span>
          <span className="text-text-primary font-medium">{action.action}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-text-muted text-xs uppercase tracking-wider">Target</span>
          <p className="text-text-secondary text-sm mt-1 font-mono bg-surface-800 rounded p-2">{action.target}</p>
        </div>

        <div>
          <span className="text-text-muted text-xs uppercase tracking-wider">Timestamp</span>
          <p className="text-text-secondary text-sm mt-1">{formatTimestamp(action.timestamp)}</p>
        </div>

        {action.duration && (
          <div>
            <span className="text-text-muted text-xs uppercase tracking-wider">Duration</span>
            <p className="text-text-secondary text-sm mt-1">{formatDuration(action.duration)}</p>
          </div>
        )}

        {action.details ? (
          <div>
            <span className="text-text-muted text-xs uppercase tracking-wider">Details</span>
            <pre className="mt-1 text-xs text-text-secondary font-mono bg-surface-800 rounded p-3 overflow-auto max-h-64">
              {JSON.stringify(action.details, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ActionLogView({ session, history }: ActionLogViewProps) {
  const [filter, setFilter] = useState<ActionType | "all">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const actions = useMemo(() => extractActions(history), [history]);

  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      const matchesFilter = filter === "all" || action.type === filter;
      const matchesSearch =
        searchQuery === "" ||
        action.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        action.target.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [actions, filter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: actions.length,
      success: actions.filter((a) => a.status === "success").length,
      error: actions.filter((a) => a.status === "error").length,
      running: actions.filter((a) => a.status === "running").length,
    };
  }, [actions]);

  if (actions.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="text-text-primary font-semibold text-lg mb-2">No actions yet</h3>
        <p className="text-text-muted text-sm">This session has no recorded actions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-4 border-b border-surface-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ACTION_TYPE_FILTERS.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === type
                    ? "bg-accent-primary text-white"
                    : "bg-surface-700 text-text-secondary hover:text-text-primary hover:bg-surface-600"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-success" />
              <span className="text-text-muted">{stats.success} Success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-error" />
              <span className="text-text-muted">{stats.error} Error</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-warning" />
              <span className="text-text-muted">{stats.running} Running</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-900 border border-surface-700 text-text-primary text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full">
          <thead className="bg-surface-900 sticky top-0">
            <tr>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3 w-24">Time</th>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3 w-32">Type</th>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3">Action</th>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3">Target</th>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3 w-24">Status</th>
              <th className="text-left text-text-muted text-xs font-medium uppercase tracking-wider px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700">
            {filteredActions.map((action) => (
              <>
                <tr
                  key={action.id}
                  className="hover:bg-surface-700/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedRow(expandedRow === action.id ? null : action.id)}
                >
                  <td className="px-4 py-3 text-text-secondary text-xs font-mono whitespace-nowrap">
                    {formatTimestamp(action.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-text-secondary text-xs">
                      {ACTION_TYPE_FILTERS.find((f) => f.type === action.type)?.icon}
                      <span className="capitalize">{action.type.replace("_", " ")}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary text-sm font-medium">{action.action}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs truncate max-w-xs">{action.target}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(action.status)}`}>
                      {getStatusIcon(action.status)}
                      <span className="capitalize">{action.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <svg
                      className={`w-4 h-4 text-text-muted transition-transform ${expandedRow === action.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </td>
                </tr>
                {expandedRow === action.id && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <ActionDetailPanel action={action} onClose={() => setExpandedRow(null)} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredActions.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-text-muted text-sm">No actions match your filters.</p>
          </div>
        )}
      </div>

      <div className="border-t border-surface-700 p-3 bg-surface-800/50">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Showing {filteredActions.length} of {actions.length} actions
          </span>
          <span>Session: {session.acpxRecordId.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  );
}
