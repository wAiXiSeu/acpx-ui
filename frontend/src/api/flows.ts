import { apiClient } from "./client";

export interface FlowRun {
  runId: string;
  manifest: {
    schema: "acpx.flow-run-bundle.v1";
    runId: string;
    flowName: string;
    runTitle?: string;
    flowPath?: string;
    startedAt: string;
    finishedAt?: string;
    status: "running" | "waiting" | "completed" | "failed" | "timed_out";
  };
}

export async function fetchFlows(): Promise<{ runs: FlowRun[] }> {
  return apiClient.get<{ runs: FlowRun[] }>("/api/flows");
}

export async function fetchFlow(runId: string): Promise<FlowRun> {
  return apiClient.get<FlowRun>(`/api/flows/${runId}`);
}