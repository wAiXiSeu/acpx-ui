import type { SessionRecord } from "../types/acpx";

interface SessionCardProps {
  session: SessionRecord;
  onClose: (id: string) => void;
  onResume: (id: string) => void;
  isActive?: boolean;
}

function getStatusFromSession(session: SessionRecord, isActive?: boolean): "running" | "idle" | "closed" {
  if (isActive) return "running";
  if (session.closed) return "closed";
  if (session.pid) return "running";
  return "idle";
}

function getStatusColor(status: "running" | "idle" | "closed"): string {
  switch (status) {
    case "running":
      return "bg-accent-success/20 text-accent-success border-accent-success/30";
    case "idle":
      return "bg-accent-warning/20 text-accent-warning border-accent-warning/30";
    case "closed":
      return "bg-surface-600 text-text-muted border-surface-500";
    default:
      return "bg-surface-600 text-text-muted";
  }
}

function getAgentFromCommand(command: string): string {
  const parts = command.split(" ");
  const cmd = parts[0] || "unknown";
  return cmd.replace(/^.*[/\\]/, "").replace(/\.exe$/i, "");
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

function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[/\\]/);
  if (parts.length <= 2) return "..." + path.slice(-maxLength + 3);
  return ".../" + parts.slice(-2).join("/");
}

export default function SessionCard({ session, onClose, onResume, isActive }: SessionCardProps) {
  const status = getStatusFromSession(session, isActive);
  const agent = getAgentFromCommand(session.agentCommand);
  const displayName = session.name || session.title || `Session ${session.acpxRecordId.slice(0, 8)}`;

  return (
    <div className="group bg-surface-800 border border-surface-700 rounded-xl p-5 hover:border-accent-primary/50 hover:bg-surface-700/50 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary font-semibold text-base truncate pr-4">
            {displayName}
          </h3>
          <p className="text-text-muted text-xs mt-1 font-mono truncate">
            {truncatePath(session.cwd)}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
            status
          )}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              status === "running"
                ? "bg-accent-success"
                : status === "idle"
                ? "bg-accent-warning"
                : "bg-text-muted"
            }`}
          />
          {status}
        </span>
      </div>

      <div className="mb-4">
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-accent-primary/10 text-accent-primary text-xs font-medium">
          <svg
            className="w-3 h-3 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {agent}
        </span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-surface-700/50">
        <span className="text-text-muted text-xs">
          Last active {formatRelativeTime(session.lastUsedAt)}
        </span>

        <div className="flex items-center gap-2">
          {status !== "closed" && (
            <button
              onClick={() => onClose(session.acpxRecordId)}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-accent-error hover:bg-accent-error/10 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
          <button
            onClick={() => onResume(session.acpxRecordId)}
            className="px-3 py-1.5 text-xs font-medium bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
