import type { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session.service.js';

export default async function sessionRoutes(fastify: FastifyInstance) {
  // Read-only: list sessions
  fastify.get('/sessions', async (_request, reply) => {
    try {
      const sessions = await sessionService.listSessions();
      return reply.status(200).send({ sessions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list sessions';
      return reply.status(500).send({ error: message });
    }
  });

  // Read-only: get single session
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionService.getSession(id);
      return reply.status(200).send({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  // Read-only: get session history
  fastify.get('/sessions/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionService.getSession(id);
      return reply.status(200).send({ messages: session.messages });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get session history';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });
}
