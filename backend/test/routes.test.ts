import { describe, it, expect } from 'vitest';
import { server } from './setup.js';

describe('Backend API Integration Tests', () => {
  describe('Health Check', () => {
    it('should return health status with runtime info', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toMatch(/^(ok|degraded)$/);
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('runtime');
      expect(body.runtime).toHaveProperty('healthy');
      expect(typeof body.runtime.healthy).toBe('boolean');
    });
  });

  describe('Sessions API', () => {
    it('should list sessions', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('sessions');
      expect(Array.isArray(body.sessions)).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    // NOTE: Session creation is now Matrix-only via /new command.
    // POST/DELETE endpoints have been removed from REST API.
    it('should return 404 for session creation (moved to Matrix)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          agent: 'claude',
          cwd: '/tmp',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for session deletion (moved to Matrix)', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/sessions/some-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Flows API', () => {
    it('should list flows', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/flows',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('runs');
      expect(Array.isArray(body.runs)).toBe(true);
    });

    it('should return 404 for non-existent flow', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/flows/non-existent-run-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 501 for flow run execution', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/flows/run',
      });

      expect(response.statusCode).toBe(501);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'not_implemented');
      expect(body).toHaveProperty('message');
    });
  });
});