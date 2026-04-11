import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isProduction, matrixConfig } from './config.js';
import routes from './routes/index.js';
import websocketPlugin from './plugins/websocket.js';
import { SessionService } from './services/session.service.js';
import { permissionManager } from './services/permission.service.js';
import { MatrixGateway } from './matrix/gateway.js';
import { RoomRouter } from './matrix/room-router.js';
import { eventBus } from './shared/event-bus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
  },
});

// Wire up permission callback
SessionService.getInstance().setPermissionCallback(
  permissionManager.createPermissionCallback()
);

fastify.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

fastify.register(websocketPlugin);
fastify.register(routes);

// Serve frontend static files in production
if (isProduction) {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  fastify.register(staticPlugin, {
    root: frontendDistPath,
    prefix: '/',
    decorateReply: false,
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/ws')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not found' });
    }
  });
}

fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: {
      message: error.message,
      code: error.code,
    },
  });
});

// Initialize Matrix Gateway if configured
let matrixGateway: MatrixGateway | null = null;
let roomRouter: RoomRouter | null = null;

async function initMatrix() {
  if (!matrixConfig.accessToken || !matrixConfig.managerRoomId) {
    fastify.log.warn('Matrix not configured. Set MATRIX_ACCESS_TOKEN and MATRIX_MANAGER_ROOM_ID.');
    return;
  }

  matrixGateway = new MatrixGateway(matrixConfig);
  roomRouter = new RoomRouter(matrixGateway);

  await matrixGateway.connect();
  fastify.log.info(`Matrix connected as ${matrixConfig.userId}`);

  matrixGateway.on("room_message", async (msg: any) => {
    if (roomRouter) {
      await roomRouter.handleMessage(msg);
    }
  });

  // Broadcast events from EventBus to Matrix
  eventBus.onAll(async (_event) => {
    if (!roomRouter || !matrixGateway) return;
    // Events are already sent to Matrix by RoomRouter.runTurnAndStream
    // This handles events from non-Matrix sources
  });
}

// Graceful shutdown
async function gracefulShutdown() {
  if (matrixGateway) {
    await matrixGateway.disconnect();
  }
  await fastify.close();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const start = async () => {
  try {
    await initMatrix();
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

export async function build() {
  return fastify;
}

export { matrixGateway, roomRouter };

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
