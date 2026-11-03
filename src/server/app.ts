import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Database } from './db.js';
import { registerGameRoutes } from './games.js';
import { registerPlayerRoutes } from './players.js';

/** Static front-end files: src/server → ../../public, and the same from dist/server. */
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

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
  await app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: '/static/',
    decorateReply: false,
    index: false,
  });

  // Game setup screen (home page, French UI) and the game page; both are static files.
  const setupPage = await readFile(join(PUBLIC_DIR, 'index.html'), 'utf-8');
  const gamePage = await readFile(join(PUBLIC_DIR, 'partie.html'), 'utf-8');
  app.get('/', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(setupPage);
  });
  app.get('/partie/:id', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(gamePage);
  });
  registerGameRoutes(app, db);

  // Players screen (French UI); the page itself is a static file.
  const playersPage = await readFile(join(PUBLIC_DIR, 'joueurs.html'), 'utf-8');
  app.get('/joueurs', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(playersPage);
  });
  registerPlayerRoutes(app, db, uploadDir);

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
