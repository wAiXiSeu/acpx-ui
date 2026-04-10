import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import { eventBus } from '../shared/event-bus.js';
import { sessionRegistry } from '../shared/session-registry.js';

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);

  fastify.register(async function (fastify) {
    // Basic echo WebSocket for testing
    fastify.get('/ws', { websocket: true }, async (connection) => {
      connection.socket.on('message', (message: Buffer) => {
        connection.socket.send(JSON.stringify({
          type: 'echo',
          data: message.toString(),
        }));
      });
    });

    // Session WebSocket — read-only event streaming
    fastify.get('/ws/session/:sessionId', { websocket: true }, async (connection, req) => {
      const { sessionId } = req.params as { sessionId: string };

      // Subscribe to event bus for this session
      const eventHandler = (event: import('../shared/types.js').AcpEvent) => {
        connection.socket.send(JSON.stringify({
          type: 'event',
          sessionId: event.sessionId,
          data: event,
        }));
      };

      eventBus.onSession(sessionId, eventHandler);

      // Also send session creation/update events
      const allHandler = (event: import('../shared/types.js').AcpEvent) => {
        if (event.type === 'done') {
          connection.socket.send(JSON.stringify({
            type: 'session_done',
            data: { sessionId: event.sessionId, stopReason: event.payload?.stopReason },
          }));
        }
      };
      eventBus.onAll(allHandler);

      connection.socket.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          switch (data.type) {
            case 'subscribe':
              if (data.sessionId) {
                eventBus.onSession(data.sessionId, eventHandler);
                connection.socket.send(JSON.stringify({
                  type: 'status',
                  text: `Subscribed to session ${data.sessionId}`,
                }));
              }
              break;

            case 'unsubscribe':
              eventBus.offSession(data.sessionId, eventHandler);
              connection.socket.send(JSON.stringify({
                type: 'status',
                text: `Unsubscribed from session ${data.sessionId}`,
              }));
              break;

            case 'ping':
              connection.socket.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              connection.socket.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${data.type}`,
                code: 'UNKNOWN_MESSAGE_TYPE',
              }));
          }
        } catch (error) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            code: 'PARSE_ERROR',
          }));
        }
      });

      connection.socket.on('close', () => {
        eventBus.offSession(sessionId, eventHandler);
        eventBus.offAll(allHandler);
      });

      // Send initial session info
      const session = sessionRegistry.getById(sessionId);
      if (session) {
        connection.socket.send(JSON.stringify({
          type: 'session_update',
          data: session,
        }));
      }

      connection.socket.send(JSON.stringify({
        type: 'status',
        text: `Connected. Listening to session ${sessionId} events.`,
      }));
    });
  });
};

export default fp(websocketPlugin, { name: 'websocket' });
