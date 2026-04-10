import type { FastifyInstance } from 'fastify';
import sessionRoutes from './sessions.js';
import flowRoutes from './flows.js';
import { SessionService } from '../services/session.service.js';
import { sessionRegistry } from '../shared/session-registry.js';
import { matrixGateway } from '../index.js';

export default async function routes(fastify: FastifyInstance) {
  fastify.register(sessionRoutes, { prefix: '/api' });
  fastify.register(flowRoutes, { prefix: '/api' });

  // System status endpoint
  fastify.get('/api/status', async (_request, _reply) => {
    const sessions = sessionRegistry.getAll();
    return {
      matrix: {
        connected: matrixGateway?.isConnected() ?? false,
        rooms: matrixGateway?.getConnectedRooms() ?? 0,
      },
      sessions: {
        active: sessions.filter(s => s.status === 'running').length,
        total: sessions.length,
      },
    };
  });

  fastify.get('/health', async (_request, _reply) => {
    const runtimeHealthy = SessionService.getInstance().isHealthy();
    return {
      status: runtimeHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime: { healthy: runtimeHealthy },
    };
  });
}
