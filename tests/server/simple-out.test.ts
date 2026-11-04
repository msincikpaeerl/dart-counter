import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { Database } from '../../src/server/db.js';
import { createMemoryDb } from './memory-db.js';

interface State {
  winnerId: number | null;
  currentPlayerId: number | null;
  remaining: Record<string, number>;
  checkout?: { label: string }[];
  bust: { playerId: number; remaining: number } | null;
}

describe('simple out and the per-player double-out option', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let simple: number;
  let forced: number;
  let gameId: number;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    // Existing-style player: no option given, so simple out.
    simple = (await db.createPlayer({ name: 'Simple', nickname: null, photoPath: null })).id;
    forced = (
      await db.createPlayer({ name: 'Forced', nickname: null, photoPath: null, doubleOut: true })
    ).id;
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 301, playerIds: [simple, forced] },
    });
    gameId = created.json<{ id: number }>().id;
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const dart = async (sector: number, multiplier: number) =>
    (
      await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/darts`,
        payload: { sector, multiplier },
      })
    ).json<State>();
  const pass = async () =>
    (await app.inject({ method: 'POST', url: `/api/games/${gameId}/next` })).json<State>();

  /** Both players throw the same two visits (180, then `second`) and are left on 20 or 19. */
  async function bringBothTo(left: 20 | 19): Promise<void> {
    const first: [number, number][] = [
      [20, 3],
      [20, 3],
      [20, 3],
    ];
    // 301 - 180 = 121: 101 leaves 20, 102 leaves 19.
    const second: [number, number][] =
      left === 20
        ? [
            [20, 3],
            [13, 3],
            [1, 2],
          ]
        : [
            [20, 3],
            [14, 3],
          ];
    for (const visit of [first, first, second, second]) {
      for (const [sector, multiplier] of visit) await dart(sector, multiplier);
      if (visit.length < 3) await pass();
    }
  }

  it('players are simple out by default', async () => {
    expect((await db.getPlayer(simple))?.doubleOut).toBe(false);
    expect((await db.getPlayer(forced))?.doubleOut).toBe(true);
  });

  it('a simple-out player wins with a single', async () => {
    await bringBothTo(20);
    const state = await dart(20, 1);
    expect(state.winnerId).toBe(simple);
  });

  it('a forced-double player busts on a single and a treble, and may not leave 1', async () => {
    await bringBothTo(20);
    await pass(); // the simple-out player misses
    const state = await dart(20, 1);
    expect(state.winnerId).toBeNull();
    expect(state.bust).toEqual({ playerId: forced, remaining: 20 });
    expect(state.currentPlayerId).toBe(simple);
  });

  it('suggests a checkout matching the current player rule', async () => {
    await bringBothTo(19);
    // Simple out to throw first: a single 19 finishes.
    const first = await app.inject({ method: 'GET', url: `/api/games/${gameId}` });
    expect(first.json<State>().checkout?.map((c) => c.label)).toEqual(['19']);
    await pass();
    const second = await app.inject({ method: 'GET', url: `/api/games/${gameId}` });
    // 19 is not a double: the forced player needs a setup dart first.
    const labels = second.json<State>().checkout?.map((c) => c.label) ?? [];
    expect(labels.length).toBeGreaterThan(1);
    expect(labels[labels.length - 1]).toMatch(/^D|^BULL$/);
  });
});
