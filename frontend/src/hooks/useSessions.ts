import { useQuery } from "@tanstack/react-query";
import { fetchSessions, fetchSession, fetchHistory } from "../api/sessions";
import type { SessionRecord, SessionMessage } from "../types/acpx";

export function useSessions() {
  return useQuery<SessionRecord[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const result = await fetchSessions();
      return result.sessions;
    },
  });
}

export function useSession(id: string) {
  return useQuery<SessionRecord>({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const result = await fetchSession(id);
      return result.session;
    },
    enabled: !!id,
  });
}

export function useHistory(id: string) {
  return useQuery<SessionMessage[]>({
    queryKey: ["sessions", id, "history"],
    queryFn: async () => {
      const result = await fetchHistory(id);
      return result.messages;
    },
    enabled: !!id,
  });
}