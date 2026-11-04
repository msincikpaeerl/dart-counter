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
  mode: number;
  doubleOut: boolean;
  players: { id: number; doubleOut: boolean }[];
  winnerId: number | null;
  remaining: Record<string, number>;
  bust: { playerId: number; remaining: number } | null;
}

describe('game type and X01 options', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let solo: number;
  let forced: number;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    solo = (await db.createPlayer({ name: 'Solo', nickname: null, photoPath: null })).id;
    forced = (
      await db.createPlayer({ name: 'Forced', nickname: null, photoPath: null, doubleOut: true })
    ).id;
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const create = (payload: object) => app.inject({ method: 'POST', url: '/api/games', payload });
  const throwDarts = async (id: number, darts: [number, number][]) => {
    let state: State | undefined;
    for (const [sector, multiplier] of darts) {
      state = (
        await app.inject({
          method: 'POST',
          url: `/api/games/${id}/darts`,
          payload: { sector, multiplier },
        })
      ).json<State>();
    }
    return state as State;
  };
  /** 701 minus 661 leaves 40 for a lone player. */
  const toForty: [number, number][] = [
    ...Array.from({ length: 9 }, () => [20, 3] as [number, number]), // 540 -> 161
    [20, 3],
    [20, 3],
    [1, 1], // 161 - 121 -> 40
  ];

  it('defaults to X01, 501 and simple out for a request that only gives players', async () => {
    const res = await create({ mode: 501, playerIds: [solo] });
    expect(res.statusCode).toBe(201);
    expect(res.json<State>()).toMatchObject({ type: 'x01', mode: 501, doubleOut: false });
  });

  it('starts a 701 game at 701', async () => {
    const res = await create({ type: 'x01', mode: 701, doubleOut: true, playerIds: [solo] });
    expect(res.statusCode).toBe(201);
    const id = res.json<State>().id;
    const state = (await app.inject({ method: 'GET', url: `/api/games/${id}` })).json<State>();
    expect(state).toMatchObject({ mode: 701, doubleOut: true });
    expect(state.remaining[solo]).toBe(701);
  });

  it('refuses unknown types, scores and finishes', async () => {
    expect((await create({ type: 'cricket', mode: 501, playerIds: [solo] })).statusCode).toBe(400);
    expect((await create({ mode: 601, playerIds: [solo] })).statusCode).toBe(400);
    expect((await create({ mode: 501, doubleOut: 'yes', playerIds: [solo] })).statusCode).toBe(400);
  });

  it('refuses a finish on a single with double out, and accepts it with simple out', async () => {
    const double = (await create({ mode: 701, doubleOut: true, playerIds: [solo] })).json<State>();
    await throwDarts(double.id, toForty);
    const bust = await throwDarts(double.id, [[20, 1]]);
    expect(bust.remaining[solo]).toBe(20);
    const refused = await throwDarts(double.id, [[20, 1]]);
    expect(refused.winnerId).toBeNull();
    expect(refused.bust).toEqual({ playerId: solo, remaining: 40 });
    const won = await throwDarts(double.id, [[20, 2]]);
    expect(won.winnerId).toBe(solo);

    const simple = (await create({ mode: 701, doubleOut: false, playerIds: [solo] })).json<State>();
    await throwDarts(simple.id, toForty);
    const result = await throwDarts(simple.id, [
      [20, 1],
      [20, 1],
    ]);
    expect(result.winnerId).toBe(solo);
  });

  it('applies the game finish to every player, and a player forced to double keeps it', async () => {
    const mixed = (await create({ mode: 301, playerIds: [solo, forced] })).json<State>();
    expect(mixed.players.map((p) => p.doubleOut)).toEqual([false, true]);
    const all = (
      await create({ mode: 301, doubleOut: true, playerIds: [solo, forced] })
    ).json<State>();
    expect(all.players.map((p) => p.doubleOut)).toEqual([true, true]);
  });

  it('shows the same options when an unfinished game is resumed, and in a rematch', async () => {
    const created = (await create({ mode: 701, doubleOut: true, playerIds: [solo] })).json<State>();
    const resumed = (await app.inject({ method: 'GET', url: '/api/games/unfinished' })).json<{
      game: State;
    }>();
    expect(resumed.game).toMatchObject({ id: created.id, type: 'x01', mode: 701, doubleOut: true });
    const rematch = (
      await app.inject({ method: 'POST', url: `/api/games/${created.id}/rematch` })
    ).json<State>();
    expect(rematch).toMatchObject({ mode: 701, doubleOut: true });
  });

  it('lists the type and options in the history', async () => {
    const created = (await create({ mode: 701, doubleOut: true, playerIds: [solo] })).json<State>();
    await throwDarts(created.id, [...toForty, [20, 2]]);
    const history = (await app.inject({ method: 'GET', url: '/api/history' })).json<State[]>();
    expect(history[0]).toMatchObject({ type: 'x01', mode: 701, doubleOut: true });
  });
});
