import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { Database } from '../../src/server/db.js';
import { createMemoryDb } from './memory-db.js';

describe('games API', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let ids: number[];

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    ids = [];
    for (const name of ['Léa', 'Max', 'Sophie']) {
      ids.push((await db.createPlayer({ name, nickname: null, photoPath: null })).id);
    }
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const create = (payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/games', payload: payload as object });

  it('creates a game keeping the order sent', async () => {
    const order = [ids[2], ids[0], ids[1]];
    const response = await create({ mode: 301, playerIds: order });
    expect(response.statusCode).toBe(201);
    const game = response.json<{ id: number; mode: number; players: { id: number }[] }>();
    expect(game.mode).toBe(301);
    expect(game.players.map((p) => p.id)).toEqual(order);

    const fetched = await app.inject({ method: 'GET', url: `/api/games/${game.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json<{ players: { id: number }[] }>().players.map((p) => p.id)).toEqual(order);
  });

  it('allows a solo game', async () => {
    const response = await create({ mode: 501, playerIds: [ids[0]] });
    expect(response.statusCode).toBe(201);
  });

  it('refuses an invalid mode, an empty or duplicated selection', async () => {
    expect((await create({ mode: 401, playerIds: [ids[0]] })).statusCode).toBe(400);
    expect((await create({ mode: 501, playerIds: [] })).statusCode).toBe(400);
    expect((await create({ mode: 501, playerIds: [ids[0], ids[0]] })).statusCode).toBe(400);
    expect((await create({ mode: 501 })).statusCode).toBe(400);
  });

  it('refuses unknown and archived players', async () => {
    expect((await create({ mode: 501, playerIds: [9999] })).statusCode).toBe(400);
    await db.archivePlayer(ids[1] as number);
    expect((await create({ mode: 501, playerIds: [ids[0], ids[1]] })).statusCode).toBe(400);
  });

  it('answers 404 for an unknown game', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/games/42' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/games/abc' })).statusCode).toBe(404);
  });

  it('does not offer archived players on the setup screen', async () => {
    await db.archivePlayer(ids[1] as number);
    const list = await app.inject({ method: 'GET', url: '/api/players' });
    expect(list.json<{ id: number }[]>().map((p) => p.id)).toEqual([ids[0], ids[2]]);
  });

  it('serves the setup page and the game page', async () => {
    const setup = await app.inject({ method: 'GET', url: '/' });
    expect(setup.body).toContain('Tirer au sort');
    expect(setup.body).toContain('Modifier la sélection');
    expect(setup.body).toContain('Relancer');
    expect(setup.body).toContain('C’est parti');
    const game = await app.inject({ method: 'GET', url: '/partie/1' });
    expect(game.statusCode).toBe(200);
  });
});
