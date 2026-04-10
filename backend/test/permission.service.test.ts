import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionManager } from '../src/services/permission.service.js';
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    // Create fresh instance for each test to avoid state leakage
    (PermissionManager as any).instance = null;
    manager = PermissionManager.getInstance();
  });

  describe('createPermissionCallback', () => {
    it('should create a callback function', () => {
      const callback = manager.createPermissionCallback();
      expect(typeof callback).toBe('function');
    });
  });

  describe('requestPermission', () => {
    it('should pend a permission request and emit event', async () => {
      let emittedEvent: unknown;
      manager.setEventHandler((event) => {
        emittedEvent = event;
      });

      const params: RequestPermissionRequest = {
        toolName: 'Read',
        input: { path: '/tmp/test.txt' },
      };

      // Start the request (will wait for response or timeout)
      const promise = manager.requestPermission(params);

      // Verify event was emitted
      expect(emittedEvent).toBeDefined();
      expect((emittedEvent as any).type).toBe('permission_request');
      expect((emittedEvent as any).params).toEqual(params);

      // Verify pending request exists
      expect(manager.getPendingRequests()).toHaveLength(1);

      // Respond to the request
      const pending = manager.getPendingRequests()[0];
      const response: RequestPermissionResponse = {
        outcome: { outcome: 'approved' },
      };
      manager.respondToPermission(pending.requestId, response);

      const result = await promise;
      expect(result).toEqual(response);
      expect(manager.getPendingRequests()).toHaveLength(0);
    });

    it('should timeout after PERMISSION_TIMEOUT_MS', async () => {
      vi.useFakeTimers();

      const params: RequestPermissionRequest = {
        toolName: 'Read',
        input: { path: '/tmp/test.txt' },
      };

      const promise = manager.requestPermission(params);

      // Advance time past the 120s timeout
      await vi.advanceTimersByTimeAsync(120_001);

      const result = await promise;
      expect(result.outcome.outcome).toBe('cancelled');

      vi.useRealTimers();
    });
  });

  describe('cancelAllPending', () => {
    it('should cancel all pending requests', async () => {
      const params: RequestPermissionRequest = {
        toolName: 'Write',
        input: { path: '/tmp/test.txt', content: 'hello' },
      };

      manager.requestPermission(params);
      manager.requestPermission(params);

      expect(manager.getPendingRequests()).toHaveLength(2);

      manager.cancelAllPending();

      expect(manager.getPendingRequests()).toHaveLength(0);
    });
  });

  describe('respondToPermission', () => {
    it('should return false for non-existent request', () => {
      const response: RequestPermissionResponse = {
        outcome: { outcome: 'approved' },
      };
      expect(manager.respondToPermission('non-existent', response)).toBe(false);
    });
  });
});
