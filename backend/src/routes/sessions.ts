import { FastifyInstance } from 'fastify';
import { sessionService } from '../services/session.service.js';

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.get('/sessions', async (_request, reply) => {
    try {
      const sessions = await sessionService.listSessions();
      return reply.status(200).send({ sessions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list sessions';
      return reply.status(500).send({ error: message });
    }
  });

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

  fastify.post('/sessions', {
    schema: {
      body: {
        type: 'object',
        required: ['agent'],
        properties: {
          agent: { type: 'string', minLength: 1 },
          cwd: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { agent, cwd, name } = request.body as { agent: string; cwd?: string; name?: string };

    try {
      const result = await sessionService.createSession({ agent, cwd, name });
      return reply.status(201).send({
        handle: result.handle.acpxRecordId,
        record: result.record,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      if (message.includes('required')) {
        return reply.status(400).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  fastify.delete('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const session = await sessionService.closeSession(id);
      return reply.status(200).send({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close session';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

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