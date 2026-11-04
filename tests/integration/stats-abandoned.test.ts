import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { createDatabase, migrateDatabase } from '../../src/server/db.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('statistics ignore abandoned games (PostgreSQL)', () => {
  const db = createDatabase(databaseUrl ?? '');
  let app: FastifyInstance;
  let uploadDir: string;

  beforeAll(async () => {
    await migrateDatabase(databaseUrl ?? '');
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-counter-stats-'));
    app = await buildApp({ db, uploadDir });
  });

  afterAll(async () => {
    await app.close();
    await db.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  async function newPlayerId(): Promise<number> {
    const player = await db.createPlayer({
      name: `Abandoned-${randomUUID()}`,
      nickname: null,
      photoPath: null,
    });
    return player.id;
  }

  async function getJson(url: string): Promise<unknown> {
    const response = await app.inject({ method: 'GET', url });
    return response.json();
  }

  /** Everything the statistics and history screens can show. */
  async function snapshot(playerIds: number[]): Promise<unknown> {
    return {
      players: await getJson('/api/stats/players'),
      perPlayer: await Promise.all(playerIds.map((id) => getJson(`/api/stats/players/${id}`))),
      history: await getJson('/api/history'),
      historyPerPlayer: await Promise.all(
        playerIds.map((id) => getJson(`/api/history?playerId=${id}`)),
      ),
    };
  }

  it('an abandoned game with darts changes no statistic and no history', async () => {
    const alice = await newPlayerId();
    const bob = await newPlayerId();

    // One finished 301 game for Alice: 180, then T20 + T7 + D20 = 121 checks out.
    const finished = await db.createGame(301, [alice]);
    const visits: [number, number][][] = [
      [
        [20, 3],
        [20, 3],
        [20, 3],
      ],
      [
        [20, 3],
        [7, 3],
        [20, 2],
      ],
    ];
    let visitNumber = 0;
    for (const visit of visits) {
      visitNumber += 1;
      let dartNumber = 0;
      for (const [segment, multiplier] of visit) {
        dartNumber += 1;
        await db.addDart(finished.id, {
          playerId: alice,
          visitNumber,
          dartNumber,
          segment,
          multiplier,
          score: segment * multiplier,
          bust: false,
        });
      }
    }
    await db.setWinner(finished.id, alice);

    const ids = [alice, bob];
    const before = await snapshot(ids);

    // An abandoned game with many darts, for Alice and for Bob (who has no finished game).
    const abandoned = await db.createGame(501, [alice, bob]);
    let n = 0;
    for (const playerId of [alice, bob, alice, bob]) {
      n += 1;
      for (const dartNumber of [1, 2, 3]) {
        await db.addDart(abandoned.id, {
          playerId,
          visitNumber: n,
          dartNumber,
          segment: 20,
          multiplier: 3,
          score: 60,
          bust: false,
        });
      }
    }
    await db.abandonGame(abandoned.id);
    expect((await db.getGame(abandoned.id))?.status).toBe('abandoned');
    expect((await db.listDarts(abandoned.id)).length).toBe(12);

    const after = await snapshot(ids);
    expect(after).toEqual(before);

    // Bob only played an abandoned game: he is in no statistics list and has no history.
    const list = (await getJson('/api/stats/players')) as { player: { id: number } }[];
    expect(list.some((entry) => entry.player.id === bob)).toBe(false);
    const history = (await getJson(`/api/history?playerId=${bob}`)) as unknown[];
    expect(history).toEqual([]);
    const gameDetail = await app.inject({ method: 'GET', url: `/api/history/${abandoned.id}` });
    expect(gameDetail.statusCode).toBe(404);
  });
});
