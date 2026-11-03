import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { Database } from '../../src/server/db.js';
import { createMemoryDb } from './memory-db.js';

const upDb: Database = createMemoryDb();
const downDb: Database = createMemoryDb({ down: true });

describe('server', () => {
  let uploadDir: string;
  let app: FastifyInstance;

  async function start(db: Database) {
    app = await buildApp({ db, uploadDir });
  }

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('serves an HTML page', async () => {
    await start(upDb);
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Dart Counter');
  });

  it('serves a JSON health check', async () => {
    await start(upDb);
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'up' });
  });

  it('reports 503 when the database is down', async () => {
    await start(downDb);
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(503);
  });

  it('stores an uploaded image on the upload directory and serves it back', async () => {
    await start(upDb);
    const boundary = 'xBOUNDARYx';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n` +
          'Content-Type: image/png\r\n\r\n',
      ),
      Buffer.from([1, 2, 3, 4]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(response.statusCode).toBe(201);
    const { name, url } = response.json<{ name: string; url: string }>();
    expect(await readdir(uploadDir)).toContain(name);
    const fetched = await app.inject({ method: 'GET', url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.rawPayload).toEqual(Buffer.from([1, 2, 3, 4]));
  });
});
