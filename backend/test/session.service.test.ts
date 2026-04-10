import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the acpx-fork stable exports
const mockRuntime = {
  probeAvailability: vi.fn().mockResolvedValue(undefined),
  ensureSession: vi.fn().mockResolvedValue({
    acpxRecordId: 'test-session-123',
    agent: 'opencode',
    cwd: '/tmp',
  }),
  cancel: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockResolvedValue({ summary: 'ok' }),
  setMode: vi.fn().mockResolvedValue(undefined),
  setConfigOption: vi.fn().mockResolvedValue(undefined),
  isHealthy: vi.fn().mockReturnValue(true),
  doctor: vi.fn().mockResolvedValue({ ok: true, message: 'All good' }),
  runTurn: vi.fn(async function* () {
    yield { type: 'text_delta', text: 'Hello', stream: 'output' };
    yield { type: 'done', stopReason: 'end_turn' };
  }),
};

vi.mock('@local/acpx/runtime', () => ({
  createAcpRuntime: vi.fn(() => mockRuntime),
  createFileSessionStore: vi.fn(() => ({})),
  createAgentRegistry: vi.fn(() => ({})),
  DEFAULT_AGENT_NAME: 'opencode',
}));

// Mock the hash-path imports
vi.mock('@local/acpx/dist/session-DwM_3DqC.js', () => ({
  t: {
    listSessions: vi.fn().mockResolvedValue([]),
    closeSession: vi.fn(),
  },
}));

vi.mock('@local/acpx/dist/prompt-turn-Di3t13Tw.js', () => ({
  A: vi.fn(),
}));

import { SessionService } from '../src/services/session.service.js';

describe('SessionService', () => {
  beforeEach(() => {
    // Reset singleton instance before each test
    (SessionService as any).instance = null;
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton', () => {
      const instance1 = SessionService.getInstance();
      const instance2 = SessionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('isHealthy', () => {
    it('should return false when runtime is not initialized', () => {
      expect(SessionService.getInstance().isHealthy()).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should throw if agent name is empty', async () => {
      await expect(
        SessionService.getInstance().createSession({ agent: '' })
      ).rejects.toThrow('Agent name is required');
    });

    it('should throw if agent name is whitespace', async () => {
      await expect(
        SessionService.getInstance().createSession({ agent: '  ' })
      ).rejects.toThrow('Agent name is required');
    });
  });

  describe('closeSession', () => {
    it('should throw if session ID is empty', async () => {
      await expect(
        SessionService.getInstance().closeSession('')
      ).rejects.toThrow('Session ID is required');
    });

    it('should throw if session ID is whitespace', async () => {
      await expect(
        SessionService.getInstance().closeSession('  ')
      ).rejects.toThrow('Session ID is required');
    });
  });

  describe('cancelTurn', () => {
    it('should throw if handle is null', async () => {
      await expect(
        SessionService.getInstance().cancelTurn(null as any)
      ).rejects.toThrow('Session handle is required');
    });
  });

  describe('setMode', () => {
    it('should throw if mode is empty', async () => {
      await expect(
        SessionService.getInstance().setMode({} as any, '')
      ).rejects.toThrow('Mode ID is required');
    });
  });

  describe('setConfigOption', () => {
    it('should throw if key is empty', async () => {
      await expect(
        SessionService.getInstance().setConfigOption({} as any, '', 'value')
      ).rejects.toThrow('Configuration key is required');
    });
  });
});
