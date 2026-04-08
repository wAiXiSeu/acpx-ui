import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { FlowRunManifest } from '../types/acpx.js';

const FLOWS_DIR = path.join(os.homedir(), '.acpx', 'flows');
const RUNS_DIR = path.join(FLOWS_DIR, 'runs');

export default async function flowRoutes(fastify: FastifyInstance) {
  fastify.get('/flows', async (_request, reply) => {
    try {
      const runs: Array<{ runId: string; manifest: FlowRunManifest }> = [];

      try {
        const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const manifestPath = path.join(RUNS_DIR, entry.name, 'manifest.json');
            try {
              const manifestContent = await fs.readFile(manifestPath, 'utf-8');
              const manifest = JSON.parse(manifestContent) as FlowRunManifest;
              runs.push({ runId: entry.name, manifest });
            } catch {
              continue;
            }
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      return reply.status(200).send({ runs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list flows';
      return reply.status(500).send({ error: message });
    }
  });

  fastify.get('/flows/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };

    try {
      const manifestPath = path.join(RUNS_DIR, runId, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as FlowRunManifest;

      return reply.status(200).send({ runId, manifest });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get flow run';
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ error: `Flow run not found: ${runId}` });
      }
      return reply.status(500).send({ error: message });
    }
  });

  fastify.post('/flows/run', async (_request, reply) => {
    return reply.status(501).send({
      status: 'not_implemented',
      message: 'Flow execution is not yet implemented via the REST API',
    });
  });
}