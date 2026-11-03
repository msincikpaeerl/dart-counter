import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Database } from './db.js';

export interface AppOptions {
  db: Database;
  uploadDir: string;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function buildApp({ db, uploadDir }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify();
  await mkdir(uploadDir, { recursive: true });

  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  await app.register(fastifyStatic, { root: uploadDir, prefix: '/uploads/' });

  // Server-rendered page (French UI).
  app.get('/', async (_request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .send(
        '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>Dart Counter</title></head><body><h1>Dart Counter</h1>' +
          '<p>Compteur de fléchettes.</p></body></html>',
      );
  });

  // JSON API.
  app.get('/api/health', async (_request, reply) => {
    try {
      await db.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      return reply.code(503).send({ status: 'error', database: 'down' });
    }
  });

  // File upload stored on the volume path.
  app.post('/api/uploads', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'No file sent' });
    const extension = extname(file.filename).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      file.file.resume();
      return reply.code(415).send({ error: 'Only jpg, png and webp images are accepted' });
    }
    const name = `${randomUUID()}${extension}`;
    await pipeline(file.file, createWriteStream(join(uploadDir, name)));
    if (file.file.truncated) return reply.code(413).send({ error: 'File too large' });
    return reply.code(201).send({ name, url: `/uploads/${name}` });
  });

  return app;
}
