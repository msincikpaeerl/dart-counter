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
  status: string;
  teams: { number: number; playerIds: number[]; hitPoints: number }[];
  currentPlayerId: number | null;
  currentTeam: number | null;
  winnerId: number | null;
  winnerTeam: number | null;
}

describe('Bataille (teams)', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let ids: number[];

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    ids = [];
    for (const name of ['Ana', 'Ben', 'Cléo', 'Dan']) {
      ids.push((await db.createPlayer({ name, nickname: null, photoPath: null })).id);
    }
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const [ana, ben, cleo, dan] = [0, 1, 2, 3];
  const create = (payload: object) => app.inject({ method: 'POST', url: '/api/games', payload });
  const start = async (
    hp = 500,
    teams = [
      [ids[ana], ids[cleo]],
      [ids[ben], ids[dan]],
    ],
  ) => (await create({ type: 'battle', mode: hp, teams })).json<State>();
  const send = async (id: number, darts: [number, number][]) => {
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
  const get = async (id: number) =>
    (await app.inject({ method: 'GET', url: `/api/games/${id}` })).json<State>();

  it('creates a game with 500, 1000 or 2000 hit points for each team', async () => {
    for (const hp of [500, 1000, 2000]) {
      const created = await start(hp);
      const state = await get(created.id);
      expect(state).toMatchObject({ type: 'battle', mode: hp, status: 'in_progress' });
      expect(state.teams.map((t) => t.hitPoints)).toEqual([hp, hp]);
      expect(state.currentPlayerId).toBe(ids[ana]);
    }
  });

  it('refuses wrong hit points, empty teams, a shared player or an unknown player', async () => {
    const good = [[ids[ana]], [ids[ben]]];
    expect((await create({ type: 'battle', mode: 501, teams: good })).statusCode).toBe(400);
    expect((await create({ type: 'battle', mode: 500, teams: [[ids[ana]], []] })).statusCode).toBe(
      400,
    );
    expect((await create({ type: 'battle', mode: 500, teams: [[ids[ana]]] })).statusCode).toBe(400);
    expect(
      (await create({ type: 'battle', mode: 500, teams: [[ids[ana]], [ids[ana]]] })).statusCode,
    ).toBe(400);
    expect(
      (await create({ type: 'battle', mode: 500, teams: [[ids[ana]], [99]] })).statusCode,
    ).toBe(400);
    expect((await create({ type: 'battle', mode: 500 })).statusCode).toBe(400);
  });

  it('alternates between the teams and removes the visit from the opposing team', async () => {
    const { id } = await start();
    let state = await send(id, [
      [20, 3],
      [20, 3],
      [20, 1],
    ]); // Ana: 140 from team 2
    expect(state.teams.map((t) => t.hitPoints)).toEqual([500, 360]);
    expect(state.currentPlayerId).toBe(ids[ben]);
    expect(state.currentTeam).toBe(2);
    state = await send(id, [
      [20, 1],
      [0, 0],
      [0, 0],
    ]); // Ben: 20 from team 1
    expect(state.teams.map((t) => t.hitPoints)).toEqual([480, 360]);
    expect(state.currentPlayerId).toBe(ids[cleo]); // next player of team 1, not Ana again
    await send(id, [[0, 0]]);
    state = (await app.inject({ method: 'POST', url: `/api/games/${id}/next` })).json<State>();
    expect(state.currentPlayerId).toBe(ids[dan]);
  });

  it('ends the game and names the winning team when a team has no hit points left', async () => {
    const { id } = await start(500, [[ids[ana]], [ids[ben]]]);
    const miss: [number, number][] = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    const big: [number, number][] = [
      [20, 3],
      [20, 3],
      [20, 3],
    ];
    await send(id, big); // 320
    await send(id, miss);
    await send(id, big); // 140
    await send(id, miss);
    const won = await send(id, [
      [20, 3],
      [20, 3],
      [20, 1],
    ]);
    expect(won).toMatchObject({ status: 'finished', winnerId: ids[ana], winnerTeam: 1 });
    expect(won.teams.map((t) => t.hitPoints)).toEqual([500, 0]);
    const refused = await app.inject({
      method: 'POST',
      url: `/api/games/${id}/darts`,
      payload: { sector: 1, multiplier: 1 },
    });
    expect(refused.statusCode).toBe(409);
    // Undo reopens the game.
    const undone = (
      await app.inject({ method: 'DELETE', url: `/api/games/${id}/darts/last` })
    ).json<State>();
    expect(undone).toMatchObject({ status: 'in_progress', winnerId: null, winnerTeam: null });
  });

  it('can be resumed with its hit points, then abandoned like any other game', async () => {
    const { id } = await start(1000);
    await send(id, [[20, 3]]);
    const resumed = (await app.inject({ method: 'GET', url: '/api/games/unfinished' })).json<{
      game: State;
    }>();
    expect(resumed.game).toMatchObject({ id, type: 'battle', mode: 1000 });
    expect(resumed.game.teams.map((t) => t.hitPoints)).toEqual([1000, 940]);

    const abandoned = await app.inject({ method: 'POST', url: `/api/games/${id}/abandon` });
    expect(abandoned.statusCode).toBe(200);
    expect(abandoned.json<State>().status).toBe('abandoned');
    const after = (await app.inject({ method: 'GET', url: '/api/games/unfinished' })).json<{
      game: State | null;
    }>();
    expect(after.game).toBeNull();
  });

  it('keeps the teams in a rematch and leaves battle games out of the statistics', async () => {
    const { id } = await start(500, [[ids[ana]], [ids[ben]]]);
    await send(id, [
      [20, 3],
      [20, 3],
      [20, 3],
    ]);
    const rematch = (
      await app.inject({ method: 'POST', url: `/api/games/${id}/rematch` })
    ).json<State>();
    expect(rematch).toMatchObject({ type: 'battle', mode: 500 });
    const state = await get(rematch.id);
    expect(state.teams.map((t) => t.playerIds)).toEqual([[ids[ana]], [ids[ben]]]);

    // Finish the first game: it must not appear in the X01 history or statistics.
    await send(id, [
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    await send(id, [
      [20, 3],
      [20, 3],
      [20, 3],
    ]);
    await send(id, [
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    await send(id, [
      [20, 3],
      [20, 3],
      [20, 1],
    ]);
    expect((await get(id)).status).toBe('finished');
    const history = (await app.inject({ method: 'GET', url: '/api/history' })).json<unknown[]>();
    expect(history).toEqual([]);
    const stats = (await app.inject({ method: 'GET', url: '/api/stats/players' })).json<
      unknown[]
    >();
    expect(stats).toEqual([]);
  });
});
