import { useQuery } from "@tanstack/react-query";
import { fetchFlows, fetchFlow } from "../api/flows";
import type { FlowRun } from "../api/flows";

export function useFlows() {
  return useQuery<FlowRun[]>({
    queryKey: ["flows"],
    queryFn: async () => {
      const result = await fetchFlows();
      return result.runs;
    },
  });
}

export function useFlow(runId: string) {
  return useQuery<FlowRun | null>({
    queryKey: ["flows", runId],
    queryFn: async () => {
      try {
        return await fetchFlow(runId);
      } catch {
        return null;
      }
    },
    enabled: !!runId,
  });
}

export type { FlowRun };