import { useEffect, useState, useCallback, useRef } from "react";
import type { WsPermissionParams, PermissionResponseKind } from "../types/websocket";

interface PermissionModalProps {
  isOpen: boolean;
  permission: WsPermissionParams | null;
  onResponse: (requestId: string, kind: PermissionResponseKind) => void;
  onClose: () => void;
}

const TIMEOUT_SECONDS = 120;

export default function PermissionModal({
  isOpen,
  permission,
  onResponse,
  onClose,
}: PermissionModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(TIMEOUT_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoDeniedRef = useRef(false);

  useEffect(() => {
    if (isOpen && permission) {
      setTimeRemaining(TIMEOUT_SECONDS);
      setIsExpired(false);
      hasAutoDeniedRef.current = false;
    }
  }, [isOpen, permission]);

  useEffect(() => {
    if (!isOpen || !permission || isExpired) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, permission, isExpired]);

  useEffect(() => {
    if (isExpired && permission && !hasAutoDeniedRef.current) {
      hasAutoDeniedRef.current = true;
      onResponse(permission.requestId, "deny_once");
    }
  }, [isExpired, permission, onResponse]);

  const handleResponse = useCallback(
    (kind: PermissionResponseKind) => {
      if (!permission || isExpired) return;
      onResponse(permission.requestId, kind);
    },
    [permission, isExpired, onResponse]
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRiskLevel = (toolName: string): { level: "low" | "medium" | "high"; label: string } => {
    const highRiskTools = ["write", "edit", "delete", "remove", "exec", "shell", "bash"];
    const mediumRiskTools = ["read", "cat", "ls", "grep", "search"];
    
    const lowerToolName = toolName.toLowerCase();
    if (highRiskTools.some(t => lowerToolName.includes(t))) {
      return { level: "high", label: "High Risk" };
    }
    if (mediumRiskTools.some(t => lowerToolName.includes(t))) {
      return { level: "medium", label: "Medium Risk" };
    }
    return { level: "low", label: "Low Risk" };
  };

  const getRiskStyles = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return {
          badge: "bg-accent-error/20 text-accent-error border-accent-error/30",
          icon: "text-accent-error",
          border: "border-accent-error/30",
        };
      case "medium":
        return {
          badge: "bg-accent-warning/20 text-accent-warning border-accent-warning/30",
          icon: "text-accent-warning",
          border: "border-accent-warning/30",
        };
      default:
        return {
          badge: "bg-accent-success/20 text-accent-success border-accent-success/30",
          icon: "text-accent-success",
          border: "border-accent-success/30",
        };
    }
  };

  if (!isOpen || !permission) return null;

  const risk = getRiskLevel(permission.toolName);
  const riskStyles = getRiskStyles(risk.level);
  const progressPercent = (timeRemaining / TIMEOUT_SECONDS) * 100;

  const formatInput = (input: unknown): string => {
    if (typeof input === "string") return input;
    if (typeof input === "object" && input !== null) {
      const obj = input as Record<string, unknown>;
      if (obj.file_path) return String(obj.file_path);
      if (obj.path) return String(obj.path);
      if (obj.command) return String(obj.command);
      if (obj.cmd) return String(obj.cmd);
      return JSON.stringify(input, null, 2);
    }
    return String(input);
  };

  const inputDisplay = formatInput(permission.input);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-surface-900/90 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={`relative bg-surface-800 border ${riskStyles.border} rounded-xl shadow-2xl w-full max-w-lg overflow-hidden`}>
        <div className="px-6 py-4 border-b border-surface-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-surface-700 ${riskStyles.icon}`}>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Permission Request
                </h2>
                <p className="text-sm text-text-muted">
                  Agent requires approval to continue
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${riskStyles.badge}`}>
              {risk.label}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Tool
              </label>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium">
                  {permission.toolTitle || permission.toolName}
                </span>
                <span className="text-text-muted text-sm">({permission.toolName})</span>
              </div>
            </div>

            {permission.toolKind && (
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                  Type
                </label>
                <span className="text-text-secondary capitalize">
                  {permission.toolKind}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                Target
              </label>
              <div className="bg-surface-900 border border-surface-700 rounded-lg p-3 font-mono text-sm text-text-secondary break-all">
                {inputDisplay}
              </div>
            </div>

            {permission.message && (
              <div className="bg-accent-warning/10 border border-accent-warning/20 rounded-lg p-3">
                <p className="text-sm text-accent-warning">
                  {permission.message}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Time remaining</span>
              <span className={`font-mono font-medium ${timeRemaining < 30 ? "text-accent-error" : "text-text-primary"}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  timeRemaining < 30
                    ? "bg-accent-error"
                    : timeRemaining < 60
                    ? "bg-accent-warning"
                    : "bg-accent-primary"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {isExpired && (
              <p className="text-sm text-accent-error text-center">
                Request expired - auto-denied
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleResponse("allow_once")}
              disabled={isExpired}
              className="px-4 py-3 text-sm font-medium bg-accent-success text-white rounded-lg hover:bg-accent-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Allow Once
            </button>
            <button
              onClick={() => handleResponse("allow_always")}
              disabled={isExpired}
              className="px-4 py-3 text-sm font-medium bg-surface-700 text-accent-success border border-accent-success/30 rounded-lg hover:bg-surface-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Allow Always
            </button>
            <button
              onClick={() => handleResponse("deny_once")}
              disabled={isExpired}
              className="px-4 py-3 text-sm font-medium bg-accent-error text-white rounded-lg hover:bg-accent-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject Once
            </button>
            <button
              onClick={() => handleResponse("deny_always")}
              disabled={isExpired}
              className="px-4 py-3 text-sm font-medium bg-surface-700 text-accent-error border border-accent-error/30 rounded-lg hover:bg-surface-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Always
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Dismiss (will auto-deny)
          </button>
        </div>
      </div>
    </div>
  );
}
