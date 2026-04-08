import { beforeAll, afterAll } from 'vitest';
import { build } from '../src/index.js';

let server: Awaited<ReturnType<typeof build>>;

beforeAll(async () => {
  server = await build();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

export { server };