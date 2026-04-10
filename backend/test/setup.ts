import { beforeAll, afterAll } from 'vitest';
import { build } from '../src/index.js';

// Set test environment before importing server
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

let server: Awaited<ReturnType<typeof build>>;

beforeAll(async () => {
  server = await build();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

export { server };
