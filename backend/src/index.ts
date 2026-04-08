import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isProduction } from './config';
import routes from './routes';
import websocketPlugin from './plugins/websocket';
import { SessionService } from './services/session.service';
import { permissionManager } from './services/permission.service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Serve frontend static files in production
if (isProduction) {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  
  fastify.register(staticPlugin, {
    root: frontendDistPath,
    prefix: '/',
    decorateReply: false,
  });

  // SPA fallback - serve index.html for client-side routing
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