import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSession, closeSession } from "../api/sessions";
import type { CreateSessionOptions, CreateSessionResponse } from "../api/sessions";

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation<CreateSessionResponse, Error, CreateSessionOptions>({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useCloseSession() {
  const queryClient = useQueryClient();

  return useMutation<{ session: { acpxRecordId: string } }, Error, string>({
    mutationFn: async (id: string) => {
      const result = await closeSession(id);
      return { session: { acpxRecordId: result.session.acpxRecordId } };
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    },
  });
}