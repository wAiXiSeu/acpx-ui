import { useState } from "react";
import { useFlows, useFlow } from "../hooks/useFlows";
import { FlowVisualizer } from "../components/FlowVisualizer";
import type { FlowRun } from "../api/flows";

type FlowStatus = FlowRun["manifest"]["status"];

function formatDuration(startedAt: string, finishedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const durationMs = end - start;

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function getStatusColor(status: FlowStatus): string {
  switch (status) {
    case "completed":
      return "bg-accent-success";
    case "failed":
      return "bg-accent-error";
    case "running":
      return "bg-accent-primary animate-pulse";
    case "waiting":
      return "bg-accent-warning";
    case "timed_out":
      return "bg-accent-error/70";
    default:
      return "bg-surface-600";
  }
}

function getStatusLabel(status: FlowStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "waiting":
      return "Waiting";
    case "timed_out":
      return "Timed Out";
    default:
      return status;
  }
}

export default function Flows() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: flows, isLoading, error } = useFlows();
  const { data: selectedFlow } = useFlow(selectedRunId ?? "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Flows</h2>
        </div>
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-8">
          <div className="flex items-center justify-center text-text-muted">
            <div className="animate-spin mr-3">⟳</div>
            Loading flows...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Flows</h2>
        </div>
        <div className="bg-surface-800 border border-accent-error/30 rounded-lg p-8">
          <div className="text-center text-accent-error">
            <div className="text-4xl mb-4">⚠</div>
            <p>Failed to load flows</p>
            <p className="text-sm mt-2 text-text-muted">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFlow) {
    return (
      <div className="space-y-4 h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedRunId(null)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back to Flows
            </button>
            <h2 className="text-xl font-semibold text-text-primary">
              {selectedFlow.manifest.runTitle || selectedFlow.manifest.flowName}
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(
                selectedFlow.manifest.status
              )}`}
            >
              {getStatusLabel(selectedFlow.manifest.status)}
            </span>
          </div>
          <div className="text-sm text-text-muted">
            Duration: {formatDuration(selectedFlow.manifest.startedAt, selectedFlow.manifest.finishedAt)}
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <FlowVisualizer flowRun={selectedFlow} />
        </div>
      </div>
    );
  }

  if (!flows || flows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Flows</h2>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-surface-700">
            <div className="flex items-center gap-3 text-text-muted">
              <div className="text-3xl">⬡</div>
              <div>
                <p className="text-text-primary font-medium">No flow runs yet</p>
                <p className="text-sm">
                  Flows are defined in code and executed via CLI
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h3 className="text-lg font-medium text-text-primary">How to Create and Run Flows</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-accent-primary font-bold">1.</span>
                <div className="text-sm text-text-secondary">
                  <p className="font-medium text-text-primary mb-1">Write a flow definition file</p>
                  <p>Create a <code className="px-1 py-0.5 bg-surface-600 rounded text-text-primary">*.flow.ts</code> file using the <code className="px-1 py-0.5 bg-surface-600 rounded text-text-primary">defineFlow</code> API:</p>
                </div>
              </div>

              <div className="bg-surface-900 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                <pre className="text-text-secondary">
{`import { acp, compute, defineFlow } from "acpx/flows";

export default defineFlow({
  name: "example-echo",
  startAt: "reply",
  nodes: {
    reply: acp({
      async prompt({ input }) {
        return "Say hello in one short sentence.";
      },
    }),
    finalize: compute({
      run: ({ outputs }) => outputs.reply,
    }),
  },
  edges: [{ from: "reply", to: "finalize" }],
});`}
                </pre>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-accent-primary font-bold">2.</span>
                <div className="text-sm text-text-secondary">
                  <p className="font-medium text-text-primary mb-1">Run the flow via CLI</p>
                  <p>Use <code className="px-1 py-0.5 bg-surface-600 rounded text-text-primary">acpx flow run</code> to execute:</p>
                </div>
              </div>

              <div className="bg-surface-900 rounded-lg p-3 text-sm font-mono">
                <code className="text-accent-success">acpx flow run ./my-flow.ts --input-json '{"{"}request": "Hello"{"}"}'</code>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-accent-primary font-bold">3.</span>
                <div className="text-sm text-text-secondary">
                  <p className="font-medium text-text-primary mb-1">View run history here</p>
                  <p>Completed runs appear in this dashboard with full visualization.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-surface-700">
              <p className="text-sm text-text-muted">
                📖 Learn more: 
                <a 
                  href="https://github.com/openclaw/acpx/tree/main/examples/flows" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:text-accent-primary/80 ml-1"
                >
                  Example flows
                </a>
                {" | "}
                <a 
                  href="https://github.com/openclaw/acpx/blob/main/docs/2026-03-25-acpx-flows-architecture.md" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:text-accent-primary/80"
                >
                  Flow architecture
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-text-primary">Flows</h2>
        <span className="text-sm text-text-muted">
          Run flows via CLI: <code className="px-1 py-0.5 bg-surface-700 rounded">acpx flow run &lt;file&gt;</code>
        </span>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-700/50 border-b border-surface-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Flow
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Started
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Steps
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700">
            {flows.map((flow) => (
              <tr
                key={flow.runId}
                className="hover:bg-surface-700/30 transition-colors cursor-pointer"
                onClick={() => setSelectedRunId(flow.runId)}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">
                      {flow.manifest.runTitle || flow.manifest.flowName}
                    </span>
                    <span className="text-xs text-text-muted">{flow.runId}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(
                      flow.manifest.status
                    )}`}
                  >
                    {getStatusLabel(flow.manifest.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {new Date(flow.manifest.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {formatDuration(flow.manifest.startedAt, flow.manifest.finishedAt)}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  -
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRunId(flow.runId);
                    }}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                  >
                    Visualize →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
