import { FastifyInstance } from 'fastify';
import sessionRoutes from './sessions';
import flowRoutes from './flows';
import { SessionService } from '../services/session.service.js';

export default async function routes(fastify: FastifyInstance) {
  fastify.register(sessionRoutes, { prefix: '/api' });
  fastify.register(flowRoutes, { prefix: '/api' });

  fastify.get('/health', async (_request, _reply) => {
    const runtimeHealthy = SessionService.getInstance().isHealthy();
    return {
      status: runtimeHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime: {
        healthy: runtimeHealthy,
      },
    };
  });
}
