import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Import from acpx-fork bundled runtime
import {
  createAcpRuntime,
  createFileSessionStore,
  createAgentRegistry,
  AcpxRuntime,
  DEFAULT_AGENT_NAME,
} from '@local/acpx/dist/runtime.js';

// Import types from acpx-fork bundled runtime
import type {
  AcpRuntimeHandle,
  AcpRuntimeEvent,
  AcpRuntimeEnsureInput,
  AcpRuntimeSessionMode,
} from '@local/acpx/dist/runtime.js';

// Import session functions from bundled session module
import { t as sessionExports } from '@local/acpx/dist/session-DwM_3DqC.js';

// Import resolveSessionRecord from bundled prompt-turn module (exported as A)
import { A as resolveSessionRecord } from '@local/acpx/dist/prompt-turn-Di3t13Tw.js';

// Import types from local backend types
import type { SessionRecord } from '../types/acpx.js';

// Import permission types from ACP SDK
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

// Extract session functions from sessionExports
const listSessions = (sessionExports as Record<string, unknown>).listSessions as () => Promise<SessionRecord[]>;
const closeSession = (sessionExports as Record<string, unknown>).closeSession as (id: string) => Promise<SessionRecord>;

/**
 * Options for creating a new session.
 */
export interface CreateSessionOptions {
  /** Agent name (opencode, claude, qwen, codex, etc.) */
  agent: string;
  /** Working directory for the session */
  cwd?: string;
  /** Optional session name */
  name?: string;
}

/**
 * Result of creating a new session.
 */
export interface CreateSessionResult {
  /** Runtime handle for the session */
  handle: AcpRuntimeHandle;
  /** Session record with metadata */
  record: SessionRecord;
}

/**
 * SessionService provides session management operations.
 * Integrates with acpx-fork for ACP runtime operations.
 */
export class SessionService {
  private static instance: SessionService | null = null;
  private runtime: AcpxRuntime | null = null;
  private runtimePromise: Promise<AcpxRuntime> | null = null;
  private permissionCallback?: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  private handleCache: Map<string, AcpRuntimeHandle> = new Map();

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  setPermissionCallback(callback: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>): void {
    this.permissionCallback = callback;
  }

  getHandle(sessionId: string): AcpRuntimeHandle | undefined {
    return this.handleCache.get(sessionId);
  }

  private async getRuntime(): Promise<AcpxRuntime> {
    if (this.runtime) {
      return this.runtime;
    }

    if (!this.runtimePromise) {
      this.runtimePromise = this.initRuntime();
    }

    return await this.runtimePromise;
  }

  private async initRuntime(): Promise<AcpxRuntime> {
    const stateDir = path.join(os.homedir(), '.acpx');
    const cwd = process.cwd();

    const sessionStore = createFileSessionStore({ stateDir });
    const agentRegistry = createAgentRegistry();

    const runtimeOptions: {
      cwd: string;
      sessionStore: ReturnType<typeof createFileSessionStore>;
      agentRegistry: ReturnType<typeof createAgentRegistry>;
      permissionMode: 'approve-reads';
      onPermissionRequest?: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
    } = {
      cwd,
      sessionStore,
      agentRegistry,
      permissionMode: 'approve-reads',
    };

    if (this.permissionCallback) {
      runtimeOptions.onPermissionRequest = this.permissionCallback;
    }

    const runtime = createAcpRuntime(runtimeOptions);

    // Probe availability to check agent health
    try {
      await runtime.probeAvailability();
    } catch (error) {
      // Log but don't fail - runtime may still work for some agents
      console.warn('Runtime probe failed:', error);
    }

    this.runtime = runtime;
    return runtime;
  }

  /**
   * List all sessions from ~/.acpx/sessions/
   * Returns sessions sorted by lastUsedAt (most recent first).
   */
  async listSessions(): Promise<SessionRecord[]> {
    try {
      const sessions = await listSessions();
      return sessions as SessionRecord[];
    } catch (error) {
      throw new Error(`Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a single session by ID.
   * Throws error if session is not found.
   * @param id - Session ID (acpxRecordId, acpSessionId, or suffix match)
   */
  async getSession(id: string): Promise<SessionRecord> {
    if (!id || id.trim() === '') {
      throw new Error('Session ID is required');
    }

    try {
      const record = await resolveSessionRecord(id);
      return record as SessionRecord;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Session not found: ${id}`);
      }
      throw new Error(`Failed to resolve session ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new session with the specified agent.
   * @param options - Session creation options
   */
  async createSession(options: CreateSessionOptions): Promise<CreateSessionResult> {
    const { agent, cwd, name } = options;

    if (!agent || agent.trim() === '') {
      throw new Error('Agent name is required');
    }

    // Validate agent name
    const validAgents = ['opencode', 'claude', 'qwen', 'codex', 'cursor', 'copilot', 'gemini', 'pi'];
    if (!validAgents.includes(agent.toLowerCase())) {
      // Allow unknown agents but warn
      console.warn(`Unknown agent: ${agent}. Using provided agent name.`);
    }

    const runtime = await this.getRuntime();
    const sessionKey = name || randomUUID();
    const sessionCwd = cwd || process.cwd();

    const ensureInput: AcpRuntimeEnsureInput = {
      sessionKey,
      agent: agent.toLowerCase(),
      mode: 'persistent' as AcpRuntimeSessionMode,
      cwd: sessionCwd,
    };

    try {
      const handle = await runtime.ensureSession(ensureInput);

      // Cache the handle for later use
      const sessionId = handle.acpxRecordId || sessionKey;
      this.handleCache.set(sessionId, handle);

      // Get the session record using the handle's acpxRecordId
      const record = await this.getSession(sessionId);

      return {
        handle,
        record,
      };
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureHandleForSession(sessionId: string): Promise<AcpRuntimeHandle> {
    const cachedHandle = this.handleCache.get(sessionId);
    if (cachedHandle) {
      return cachedHandle;
    }

    const record = await this.getSession(sessionId);
    const runtime = await this.getRuntime();

    const ensureInput: AcpRuntimeEnsureInput = {
      sessionKey: sessionId,
      agent: record.agentCommand?.split(' ')[0]?.replace(/^.*[/\\]/, '').replace(/\.exe$/i, '') || 'opencode',
      mode: 'persistent' as AcpRuntimeSessionMode,
      cwd: record.cwd || process.cwd(),
    };

    const handle = await runtime.ensureSession(ensureInput);
    this.handleCache.set(sessionId, handle);

    return handle;
  }

  /**
   * Close an existing session.
   * Marks the session as closed and terminates any running agent process.
   * @param id - Session ID to close
   */
  async closeSession(id: string): Promise<SessionRecord> {
    if (!id || id.trim() === '') {
      throw new Error('Session ID is required');
    }

    try {
      const record = await closeSession(id);
      return record as SessionRecord;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Session not found: ${id}`);
      }
      throw new Error(`Failed to close session ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run a turn in a session with streaming events.
   * Wrapper for WebSocket streaming integration.
   * @param handle - Runtime handle for the session
   * @param text - User prompt text
   * @param requestId - Optional request ID for tracking
   * @param signal - Optional abort signal for cancellation
   */
  async *runTurn(
    handle: AcpRuntimeHandle,
    text: string,
    requestId?: string,
    signal?: AbortSignal,
  ): AsyncIterable<AcpRuntimeEvent> {
    if (!handle) {
      throw new Error('Session handle is required');
    }

    if (!text || text.trim() === '') {
      throw new Error('Prompt text is required');
    }

    const runtime = await this.getRuntime();

    const turnInput = {
      handle,
      text,
      mode: 'prompt' as const,
      requestId: requestId || randomUUID(),
      signal,
    };

    try {
      yield* runtime.runTurn(turnInput);
    } catch (error) {
      // Emit error event for WebSocket clients
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }

  /**
   * Cancel an ongoing turn in a session.
   * @param handle - Runtime handle for the session
   * @param reason - Optional cancellation reason
   */
  async cancelTurn(handle: AcpRuntimeHandle, reason?: string): Promise<void> {
    if (!handle) {
      throw new Error('Session handle is required');
    }

    const runtime = await this.getRuntime();

    try {
      await runtime.cancel({
        handle,
        reason: reason || 'User cancelled',
      });
    } catch (error) {
      throw new Error(`Failed to cancel turn: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the status of a session.
   * @param handle - Runtime handle for the session
   */
  async getStatus(handle: AcpRuntimeHandle): Promise<{
    summary?: string;
    acpxRecordId?: string;
    backendSessionId?: string;
    agentSessionId?: string;
    details?: Record<string, unknown>;
  }> {
    if (!handle) {
      throw new Error('Session handle is required');
    }

    const runtime = await this.getRuntime();

    try {
      const status = await runtime.getStatus({ handle });
      return status;
    } catch (error) {
      throw new Error(`Failed to get status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set the mode for a session.
   * @param handle - Runtime handle for the session
   * @param mode - Mode ID to set
   */
  async setMode(handle: AcpRuntimeHandle, mode: string): Promise<void> {
    if (!handle) {
      throw new Error('Session handle is required');
    }

    if (!mode || mode.trim() === '') {
      throw new Error('Mode ID is required');
    }

    const runtime = await this.getRuntime();

    try {
      await runtime.setMode({ handle, mode });
    } catch (error) {
      throw new Error(`Failed to set mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set a configuration option for a session.
   * @param handle - Runtime handle for the session
   * @param key - Configuration key
   * @param value - Configuration value
   */
  async setConfigOption(handle: AcpRuntimeHandle, key: string, value: string): Promise<void> {
    if (!handle) {
      throw new Error('Session handle is required');
    }

    if (!key || key.trim() === '') {
      throw new Error('Configuration key is required');
    }

    const runtime = await this.getRuntime();

    try {
      await runtime.setConfigOption({ handle, key, value });
    } catch (error) {
      throw new Error(`Failed to set config option: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the runtime is healthy.
   */
  isHealthy(): boolean {
    return this.runtime?.isHealthy() ?? false;
  }

  /**
   * Run diagnostics on the runtime.
   */
  async doctor(): Promise<{
    ok: boolean;
    code?: string;
    message: string;
    installCommand?: string;
    details?: string[];
  }> {
    const runtime = await this.getRuntime();
    return await runtime.doctor();
  }
}

export const sessionService = SessionService.getInstance();
export { DEFAULT_AGENT_NAME };