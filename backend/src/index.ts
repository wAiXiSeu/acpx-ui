import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import routes from './routes';
import websocketPlugin from './plugins/websocket';
import { SessionService } from './services/session.service';
import { permissionManager } from './services/permission.service';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
  },
});

// Wire up permission callback between SessionService and PermissionManager
SessionService.getInstance().setPermissionCallback(
  permissionManager.createPermissionCallback()
);

fastify.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

fastify.register(websocketPlugin);
fastify.register(routes);

fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);

  reply.status(error.statusCode || 500).send({
    error: {
      message: error.message,
      code: error.code,
    },
  });
});

const start = async () => {
  try {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}