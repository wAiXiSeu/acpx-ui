import { FastifyInstance } from 'fastify';
import sessionRoutes from './sessions';
import flowRoutes from './flows';

export default async function routes(fastify: FastifyInstance) {
  fastify.register(sessionRoutes, { prefix: '/api' });
  fastify.register(flowRoutes, { prefix: '/api' });

  fastify.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}