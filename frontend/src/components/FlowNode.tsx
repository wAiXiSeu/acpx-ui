import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeDefinition, FlowNodeResult } from "../types/acpx";

export interface FlowNodeData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  nodeType: FlowNodeDefinition["nodeType"];
  status: "pending" | "running" | "completed" | "failed" | "timed_out" | "cancelled";
  result?: FlowNodeResult;
  isStart?: boolean;
  isTerminal?: boolean;
  durationMs?: number;
  onClick?: (nodeId: string) => void;
}

const nodeTypeConfig: Record<
  FlowNodeDefinition["nodeType"],
  {
    icon: string;
    baseClasses: string;
    shapeClasses: string;
  }
> = {
  acp: {
    icon: "💬",
    baseClasses: "border-accent-primary/50 bg-accent-primary/10",
    shapeClasses: "rounded-xl",
  },
  compute: {
    icon: "⚙",
    baseClasses: "border-accent-secondary/50 bg-accent-secondary/10",
    shapeClasses: "rounded-lg transform rotate-0",
  },
  action: {
    icon: "⚡",
    baseClasses: "border-accent-warning/50 bg-accent-warning/10",
    shapeClasses: "rounded-md",
  },
  checkpoint: {
    icon: "🚩",
    baseClasses: "border-accent-info/50 bg-accent-info/10",
    shapeClasses: "rounded-full",
  },
};

const statusConfig: Record<
  FlowNodeData["status"],
  {
    indicator: string;
    label: string;
  }
> = {
  pending: {
    indicator: "bg-surface-600",
    label: "Pending",
  },
  running: {
    indicator: "bg-accent-primary animate-pulse",
    label: "Running",
  },
  completed: {
    indicator: "bg-accent-success",
    label: "Done",
  },
  failed: {
    indicator: "bg-accent-error",
    label: "Failed",
  },
  timed_out: {
    indicator: "bg-accent-error/70",
    label: "Timeout",
  },
  cancelled: {
    indicator: "bg-surface-500",
    label: "Cancelled",
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function FlowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const config = nodeTypeConfig[nodeData.nodeType];
  const status = statusConfig[nodeData.status];

  const handleClick = () => {
    nodeData.onClick?.(nodeData.nodeId);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative min-w-[140px] max-w-[200px] cursor-pointer
        border-2 ${config.baseClasses} ${config.shapeClasses}
        transition-all duration-200
        hover:shadow-lg hover:shadow-accent-primary/20
        ${selected ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-900" : ""}
      `}
    >
      <div
        className={`
          absolute top-0 left-0 right-0 h-1 rounded-t-xl
          ${status.indicator}
        `}
      />

      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400"
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400"
      />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {nodeData.nodeType}
          </span>
          {nodeData.isStart && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-accent-success/20 text-accent-success rounded">
              start
            </span>
          )}
          {nodeData.isTerminal && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-accent-secondary/20 text-accent-secondary rounded">
              end
            </span>
          )}
        </div>

        <div className="font-medium text-text-primary text-sm leading-tight mb-1">
          {nodeData.label}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span
            className={`
              inline-block w-2 h-2 rounded-full
              ${status.indicator}
            `}
          />
          <span className="text-xs text-text-secondary">{status.label}</span>
        </div>

        {nodeData.durationMs !== undefined && nodeData.durationMs > 0 && (
          <div className="text-xs text-text-muted mt-1">
            {formatDuration(nodeData.durationMs)}
          </div>
        )}
      </div>

      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400"
      />
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400"
      />
    </div>
  );
}

export const FlowNode = memo(FlowNodeComponent);

function ComputeNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const status = statusConfig[nodeData.status];

  const handleClick = () => {
    nodeData.onClick?.(nodeData.nodeId);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative cursor-pointer
        transition-all duration-200
        ${selected ? "drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""}
      `}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        className="overflow-visible"
      >
        <polygon
          points="60,5 115,60 60,115 5,60"
          className={`
            fill-surface-800 stroke-2
            ${nodeData.status === "running" ? "stroke-accent-primary animate-pulse" : "stroke-accent-secondary/50"}
            ${selected ? "stroke-accent-primary" : ""}
          `}
        />
        <circle
          cx="60"
          cy="25"
          r="4"
          className={status.indicator}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <span className="text-xl mb-1">⚙</span>
        <span className="text-xs font-medium text-text-muted uppercase">compute</span>
        <span className="text-sm font-medium text-text-primary mt-1 leading-tight">
          {nodeData.label}
        </span>
      </div>

      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400 !-top-1"
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400 !-left-1"
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400 !-bottom-1"
      />
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-surface-500 !border-2 !border-surface-400 !-right-1"
      />
    </div>
  );
}

export const ComputeNode = memo(ComputeNodeComponent);
