import { useState } from "react";
import type { CreateSessionOptions } from "../api/sessions";

const AVAILABLE_AGENTS = [
  { value: "opencode", label: "OpenCode", command: "opencode" },
  { value: "claude", label: "Claude", command: "claude" },
  { value: "qwen", label: "Qwen", command: "qwen" },
  { value: "codex", label: "Codex", command: "codex" },
  { value: "gemini", label: "Gemini", command: "gemini" },
];

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (options: CreateSessionOptions) => void;
  isLoading: boolean;
}

export default function CreateSessionModal({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}: CreateSessionModalProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");
  const [cwd, setCwd] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    onCreate({
      agent: selectedAgent,
      name: sessionName.trim() || undefined,
      cwd: cwd.trim() || undefined,
    });

    setSelectedAgent("");
    setSessionName("");
    setCwd("");
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedAgent("");
      setSessionName("");
      setCwd("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-surface-800 border border-surface-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-text-primary">
            Create New Session
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Start a new agent session
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="agent"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Agent <span className="text-accent-error">*</span>
            </label>
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-600 rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
                paddingRight: "40px",
              }}
            >
              <option value="" disabled>
                Select an agent...
              </option>
              {AVAILABLE_AGENTS.map((agent) => (
                <option key={agent.value} value={agent.value}>
                  {agent.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Session Name <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={isLoading}
              placeholder="e.g., Feature Development"
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-600 rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="cwd"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Working Directory <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="cwd"
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              disabled={isLoading}
              placeholder="e.g., /home/user/projects/my-app"
              className="w-full px-3 py-2.5 bg-surface-900 border border-surface-600 rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedAgent}
              className="px-4 py-2 text-sm font-medium bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {isLoading ? "Creating..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
