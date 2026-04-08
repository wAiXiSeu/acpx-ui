declare module '@local/acpx/dist/session-BtwAKtJ3.js' {
  export const t: {
    listSessions: () => Promise<import('./types-yxf-gcOE.js').SessionRecord[]>;
    closeSession: (id: string) => Promise<import('./types-yxf-gcOE.js').SessionRecord>;
    createSession: (options: {
      agent: string;
      cwd?: string;
      name?: string;
      mcpServers?: unknown[];
      nonInteractivePermissions?: string;
      authCredentials?: Record<string, string>;
      authPolicy?: string;
      timeoutMs?: number;
      verbose?: boolean;
    }) => Promise<import('./types-yxf-gcOE.js').SessionRecord>;
    listSessionsForAgent: (agentCommand: string) => Promise<import('./types-yxf-gcOE.js').SessionRecord[]>;
    findSession: (options: {
      agentCommand: string;
      cwd: string;
      name?: string;
      includeClosed?: boolean;
    }) => Promise<import('./types-yxf-gcOE.js').SessionRecord | undefined>;
    findSessionByDirectoryWalk: (options: {
      agentCommand: string;
      cwd: string;
      name?: string;
      boundary?: string;
    }) => Promise<import('./types-yxf-gcOE.js').SessionRecord | undefined>;
    DEFAULT_HISTORY_LIMIT: number;
    DEFAULT_QUEUE_OWNER_TTL_MS: number;
    InterruptedError: typeof Error;
    TimeoutError: typeof Error;
    cancelSessionPrompt: (options: unknown) => Promise<unknown>;
    createSessionWithClient: (options: unknown) => Promise<unknown>;
    ensureSession: (options: unknown) => Promise<unknown>;
    runOnce: (options: unknown) => Promise<unknown>;
    runSessionQueueOwner: (options: unknown) => Promise<unknown>;
    sendSession: (options: unknown) => Promise<unknown>;
    sendSessionDirect: (options: unknown) => Promise<unknown>;
    setSessionConfigOption: (options: unknown) => Promise<unknown>;
    setSessionMode: (options: unknown) => Promise<unknown>;
    setSessionModel: (options: unknown) => Promise<unknown>;
    isProcessAlive: (pid: number) => boolean;
    normalizeQueueOwnerTtlMs: (ttlMs?: number) => number;
    runQueuedTask: (options: unknown) => Promise<unknown>;
    findGitRepositoryRoot: (startDir: string) => string | undefined;
  };
  export const a: unknown;
  export const c: unknown;
  export const i: unknown;
  export const l: unknown;
  export const n: unknown;
  export const o: unknown;
  export const r: unknown;
  export const s: unknown;
  export const u: number;
}

declare module '@local/acpx/dist/prompt-turn-CXMtXBl-.js' {
  export const A: (sessionId: string) => Promise<import('./types-yxf-gcOE.js').SessionRecord>;
  export const D: () => Promise<import('./types-yxf-gcOE.js').SessionRecord[]>;
  export const DEFAULT_AGENT_NAME: string;
  export const resolveAgentCommand: (agentName: string) => string;
  export const listBuiltInAgents: () => string[];
  export const AcpClient: typeof import('./client-D-4_aZf2.js').AcpClient;
}