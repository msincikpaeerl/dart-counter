import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { Database } from '../../src/server/db.js';
import { createMemoryDb } from './memory-db.js';

interface State {
  id: number;
  type: string;
  level: string;
  status: string;
  currentPlayerId: number | null;
  winnerId: number | null;
  dartsLeft: number;
  progress: Record<string, { done: number; total: number; target: string | null }>;
  target: { label: string } | null;
}

describe('around the world games', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    alice = (await db.createPlayer({ name: 'Alice', nickname: null, photoPath: null })).id;
    bob = (await db.createPlayer({ name: 'Bob', nickname: null, photoPath: null })).id;
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const create = (payload: object) => app.inject({ method: 'POST', url: '/api/games', payload });
  const start = async (level: string, playerIds = [alice, bob]) =>
    (await create({ type: 'around_the_world', level, playerIds })).json<State>();
  const throwDart = async (id: number, sector: number, multiplier: number) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/games/${id}/darts`,
        payload: { sector, multiplier },
      })
    ).json<State>();

  it('is offered with a level, which is required', async () => {
    const ok = await create({ type: 'around_the_world', level: 'pro', playerIds: [alice] });
    expect(ok.statusCode).toBe(201);
    expect(ok.json<State>()).toMatchObject({ type: 'around_the_world', level: 'pro' });
    expect((await create({ type: 'around_the_world', playerIds: [alice] })).statusCode).toBe(400);
    expect(
      (await create({ type: 'around_the_world', level: 'expert', playerIds: [alice] })).statusCode,
    ).toBe(400);
  });

  it('shows each player their target and progress; beginner goes 1, 2, 3 ...', async () => {
    const game = await start('beginner');
    expect(game.id).toBe(1);
    let state = await throwDart(game.id, 1, 3); // triple counts like a single
    expect(state.progress[alice]).toEqual({ done: 1, total: 21, target: '2' });
    expect(state.progress[bob]).toEqual({ done: 0, total: 21, target: '1' });
    expect(state.target?.label).toBe('2');
    state = await throwDart(game.id, 7, 1); // wrong number: stays on 2
    expect(state.progress[alice]?.target).toBe('2');
  });

  it('pro needs the exact ring: S1, D1, T1 ...', async () => {
    const game = await start('pro', [alice]);
    let state = await throwDart(game.id, 1, 2); // D1 while S1 is asked
    expect(state.progress[alice]?.target).toBe('S1');
    state = await throwDart(game.id, 1, 1);
    expect(state.progress[alice]?.target).toBe('D1');
    state = await throwDart(game.id, 1, 2);
    expect(state.progress[alice]).toMatchObject({ done: 2, target: 'T1' });
  });

  it('passes to the next player after three darts', async () => {
    const game = await start('beginner');
    await throwDart(game.id, 0, 0);
    await throwDart(game.id, 0, 0);
    const state = await throwDart(game.id, 0, 0);
    expect(state.currentPlayerId).toBe(bob);
    const next = (
      await app.inject({ method: 'POST', url: `/api/games/${game.id}/next` })
    ).json<State>();
    expect(next.currentPlayerId).toBe(alice);
  });

  it('is won by the first player to hit the last target, then closes', async () => {
    const game = await start('beginner', [alice]);
    let state = game;
    for (let sector = 1; sector <= 20; sector++) state = await throwDart(game.id, sector, 1);
    expect(state.winnerId).toBeNull();
    expect(state.progress[alice]?.target).toBe('Bull');
    state = await throwDart(game.id, 25, 2); // double bull counts too
    expect(state).toMatchObject({ winnerId: alice, status: 'finished' });
    expect(state.progress[alice]?.target).toBeNull();
    const refused = await app.inject({
      method: 'POST',
      url: `/api/games/${game.id}/darts`,
      payload: { sector: 1, multiplier: 1 },
    });
    expect(refused.statusCode).toBe(409);
  });

  it('can be undone, resumed and abandoned like the others', async () => {
    const game = await start('beginner');
    await throwDart(game.id, 1, 1);
    const undone = (
      await app.inject({ method: 'DELETE', url: `/api/games/${game.id}/darts/last` })
    ).json<State>();
    expect(undone.progress[alice]?.done).toBe(0);
    await throwDart(game.id, 1, 1);

    const unfinished = (await app.inject({ method: 'GET', url: '/api/games/unfinished' })).json<{
      game: State;
    }>();
    expect(unfinished.game).toMatchObject({ id: game.id, type: 'around_the_world' });
    expect(unfinished.game.progress[alice]?.done).toBe(1);

    const abandoned = await app.inject({ method: 'POST', url: `/api/games/${game.id}/abandon` });
    expect(abandoned.json<State>().status).toBe('abandoned');
    expect(
      (await app.inject({ method: 'GET', url: '/api/games/unfinished' })).json<{ game: unknown }>()
        .game,
    ).toBeNull();
  });

  it('a rematch keeps the type and the level', async () => {
    const game = await start('pro');
    const rematch = await app.inject({ method: 'POST', url: `/api/games/${game.id}/rematch` });
    expect(rematch.json<State>()).toMatchObject({ type: 'around_the_world', level: 'pro' });
  });

  it('finished games are listed under their own type and level', async () => {
    const game = await start('beginner', [alice]);
    for (let sector = 1; sector <= 20; sector++) await throwDart(game.id, sector, 1);
    await throwDart(game.id, 25, 1);
    const history = (await app.inject({ method: 'GET', url: '/api/history' })).json<
      { id: number; typeLabel: string; options: string }[]
    >();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: game.id,
      typeLabel: 'Tour du monde',
      options: 'Débutant',
    });
    expect(
      (await app.inject({ method: 'GET', url: '/api/history?type=x01' })).json<unknown[]>(),
    ).toEqual([]);
    const stats = (await app.inject({ method: 'GET', url: `/api/stats/players/${alice}` })).json<{
      groups: { label: string; stats: { gamesPlayed: number; gamesWon: number } }[];
    }>();
    expect(stats.groups).toHaveLength(1);
    expect(stats.groups[0]).toMatchObject({
      label: 'Tour du monde · Débutant',
      stats: { gamesPlayed: 1, gamesWon: 1 },
    });
  });
});
