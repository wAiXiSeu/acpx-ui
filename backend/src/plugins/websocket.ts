import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { FastifyPluginAsync } from 'fastify';
import type WebSocket from 'ws';
import { createSessionHandler, SessionWebSocketHandler } from '../websocket/session-handler.js';
import { permissionManager } from '../services/permission.service.js';

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);

  // WebSocket routes must be attached synchronously
  fastify.register(async function (fastify) {
    // Basic echo WebSocket for testing
    fastify.get('/ws', { websocket: true }, async (connection, _req) => {
      connection.socket.on('message', (message: Buffer) => {
        connection.socket.send(JSON.stringify({
          type: 'echo',
          data: message.toString(),
        }));
      });

      connection.socket.on('close', () => {
      });
    });

    // Session WebSocket route for real-time output streaming
    fastify.get('/ws/session/:sessionId', { websocket: true }, async (connection, req) => {
      const { sessionId } = req.params as { sessionId: string };
      
      // Create handler synchronously (critical for message delivery)
      const handler: SessionWebSocketHandler = createSessionHandler(
        connection.socket as WebSocket,
        sessionId,
      );

      // Set up permission event handler to forward to WebSocket client
      permissionManager.setEventHandler((event) => {
        if (event.type === 'permission_request') {
          connection.socket.send(JSON.stringify({
            type: 'permission_request',
            requestId: event.requestId,
            params: event.params,
          }));
        }
      });

      // Handle incoming messages from client
      connection.socket.on('message', async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'prompt':
              // Run a turn with the provided text
              // Can use either handle (from createSession) or sessionId
              const handleOrSessionId = data.handle || data.sessionId || sessionId;
              if (data.text && handleOrSessionId) {
                await handler.runTurn(handleOrSessionId, data.text);
              } else {
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Missing text for prompt',
                  code: 'INVALID_PROMPT',
                }));
              }
              break;

            case 'cancel':
              // Cancel the current turn
              handler.cancel();
              connection.socket.send(JSON.stringify({
                type: 'status',
                text: 'Turn cancelled',
              }));
              break;

            case 'permission_response':
              // Handle permission response from client
              if (data.requestId && data.response) {
                const success = permissionManager.respondToPermission(
                  data.requestId,
                  data.response
                );
                if (success) {
                  connection.socket.send(JSON.stringify({
                    type: 'status',
                    text: 'Permission response processed',
                  }));
                } else {
                  connection.socket.send(JSON.stringify({
                    type: 'error',
                    message: 'No pending permission request found',
                    code: 'NO_PENDING_PERMISSION',
                  }));
                }
              } else {
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Missing requestId or response for permission_response',
                  code: 'INVALID_PERMISSION_RESPONSE',
                }));
              }
              break;

            case 'ping':
              // Keepalive ping
              connection.socket.send(JSON.stringify({
                type: 'pong',
              }));
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
        permissionManager.clearEventHandler();
        permissionManager.cancelAllPending();
      });

      // Send initial connection status
      connection.socket.send(JSON.stringify({
        type: 'status',
        text: `Connected to session ${sessionId}`,
      }));
    });
  });
};

export default fp(websocketPlugin, {
  name: 'websocket',
});