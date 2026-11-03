import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { createMemoryDb } from './memory-db.js';

const BOUNDARY = 'xBOUNDARYx';

interface Photo {
  filename: string;
  data: Buffer;
}

function multipart(fields: Record<string, string>, photo?: Photo) {
  const chunks: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  if (photo) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="photo"; filename="${photo.filename}"\r\n` +
          'Content-Type: application/octet-stream\r\n\r\n',
      ),
      photo.data,
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    body: Buffer.concat(chunks),
  };
}

async function bigImage(): Promise<Photo> {
  const data = await sharp({
    create: { width: 2000, height: 1200, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
  return { filename: 'big.png', data };
}

interface PlayerJson {
  id: number;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
}

describe('players API', () => {
  let uploadDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-players-'));
    app = await buildApp({ db: createMemoryDb(), uploadDir });
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  async function create(fields: Record<string, string>, photo?: Photo) {
    return app.inject({ method: 'POST', url: '/api/players', ...multipart(fields, photo) });
  }

  it('creates a player with only a name', async () => {
    const response = await create({ name: '  Alice ' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: 'Alice', nickname: null, photoUrl: null });
  });

  it('creates a player with a nickname and lists it', async () => {
    await create({ name: 'Bob', nickname: 'La Flèche' });
    const list = await app.inject({ method: 'GET', url: '/api/players' });
    expect(list.json<PlayerJson[]>()).toMatchObject([{ name: 'Bob', nickname: 'La Flèche' }]);
  });

  it('requires a name, in French', async () => {
    const response = await create({ name: '   ', nickname: 'x' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Le nom est obligatoire.' });
  });

  it('refuses a duplicate name (ignoring case) with a French message', async () => {
    await create({ name: 'Alice' });
    const response = await create({ name: 'ALICE' });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toContain('Un joueur porte déjà ce nom');
  });

  it('stores an uploaded photo resized to at most 512 px', async () => {
    const response = await create({ name: 'Carl' }, await bigImage());
    expect(response.statusCode).toBe(201);
    const { photoUrl } = response.json<PlayerJson>();
    expect(photoUrl).toMatch(/^\/uploads\/.+\.jpg$/);
    const file = await app.inject({ method: 'GET', url: photoUrl as string });
    const meta = await sharp(file.rawPayload).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(512);
    expect(meta.width).toBeGreaterThan(meta.height ?? 0);
  });

  it('does not enlarge a small photo', async () => {
    const data = await sharp({
      create: { width: 100, height: 80, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    const response = await create({ name: 'Dan' }, { filename: 'small.jpg', data });
    const file = await app.inject({ method: 'GET', url: response.json<PlayerJson>().photoUrl! });
    expect((await sharp(file.rawPayload).metadata()).width).toBe(100);
  });

  it('rejects an unreadable photo and keeps no file or player', async () => {
    const response = await create(
      { name: 'Eve' },
      { filename: 'x.jpg', data: Buffer.from('not an image') },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain('illisible');
    expect(await readdir(uploadDir)).toEqual([]);
    const list = await app.inject({ method: 'GET', url: '/api/players' });
    expect(list.json()).toEqual([]);
  });

  it('removes the stored photo when the name is a duplicate', async () => {
    await create({ name: 'Fay' });
    await create({ name: 'Fay' }, await bigImage());
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it('edits name and nickname and keeps the photo', async () => {
    const created = (await create({ name: 'Gus' }, await bigImage())).json<PlayerJson>();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/players/${created.id}`,
      ...multipart({ name: 'Gustave', nickname: 'Gus' }),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Gustave',
      nickname: 'Gus',
      photoUrl: created.photoUrl,
    });
  });

  it('replaces the photo and deletes the old file', async () => {
    const created = (await create({ name: 'Hal' }, await bigImage())).json<PlayerJson>();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/players/${created.id}`,
      ...multipart({ name: 'Hal' }, await bigImage()),
    });
    const updated = response.json<PlayerJson>();
    expect(updated.photoUrl).not.toBe(created.photoUrl);
    expect(await readdir(uploadDir)).toEqual([updated.photoUrl?.replace('/uploads/', '')]);
  });

  it('removes the photo on request', async () => {
    const created = (await create({ name: 'Ian' }, await bigImage())).json<PlayerJson>();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/players/${created.id}`,
      ...multipart({ name: 'Ian', removePhoto: '1' }),
    });
    expect(response.json<PlayerJson>().photoUrl).toBeNull();
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it('refuses to rename a player to an existing name', async () => {
    await create({ name: 'Jo' });
    const other = (await create({ name: 'Kim' })).json<PlayerJson>();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/players/${other.id}`,
      ...multipart({ name: 'jo' }),
    });
    expect(response.statusCode).toBe(409);
  });

  it('answers 404 for an unknown player', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/players/999',
      ...multipart({ name: 'Zed' }),
    });
    expect(response.statusCode).toBe(404);
    const archive = await app.inject({ method: 'POST', url: '/api/players/999/archive' });
    expect(archive.statusCode).toBe(404);
  });

  it('archives a player, who then disappears from the list', async () => {
    const a = (await create({ name: 'Lea' })).json<PlayerJson>();
    await create({ name: 'Max' });
    const response = await app.inject({ method: 'POST', url: `/api/players/${a.id}/archive` });
    expect(response.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/players' });
    expect(list.json<PlayerJson[]>().map((p) => p.name)).toEqual(['Max']);
  });

  it('serves the players page in French with its static files', async () => {
    const page = await app.inject({ method: 'GET', url: '/joueurs' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Nouveau joueur');
    expect(page.body).toContain('capture="user"');
    for (const file of ['joueurs.js', 'joueurs.css']) {
      const asset = await app.inject({ method: 'GET', url: `/static/${file}` });
      expect(asset.statusCode).toBe(200);
    }
  });
});
