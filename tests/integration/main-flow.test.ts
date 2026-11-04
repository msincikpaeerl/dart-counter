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

interface GameBody {
  id: number;
  status: string;
  winnerId: number | null;
  currentPlayerId: number | null;
  remaining: Record<string, number>;
}

describe.skipIf(!databaseUrl)(
  'main flow: players → 501 game → checkout → stats (PostgreSQL)',
  () => {
    const db = createDatabase(databaseUrl ?? '');
    let app: FastifyInstance;
    let uploadDir: string;

    beforeAll(async () => {
      await migrateDatabase(databaseUrl ?? '');
      uploadDir = await mkdtemp(join(tmpdir(), 'dart-counter-flow-'));
      app = await buildApp({ db, uploadDir });
    });

    afterAll(async () => {
      await app.close();
      await db.close();
      await rm(uploadDir, { recursive: true, force: true });
    });

    async function createPlayer(name: string): Promise<number> {
      const boundary = `----flow${randomUUID()}`;
      const payload =
        `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n` +
        `--${boundary}--\r\n`;
      const response = await app.inject({
        method: 'POST',
        url: '/api/players',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload,
      });
      expect(response.statusCode).toBe(201);
      return response.json<{ id: number }>().id;
    }

    async function throwDart(
      gameId: number,
      expectedPlayer: number,
      sector: number,
      multiplier: number,
    ): Promise<GameBody> {
      const before = await app.inject({ method: 'GET', url: `/api/games/${gameId}` });
      expect(before.json<GameBody>().currentPlayerId).toBe(expectedPlayer);
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/darts`,
        payload: { sector, multiplier },
      });
      expect(response.statusCode).toBe(200);
      return response.json<GameBody>();
    }

    it('stores the winner and finished status, and updates the statistics', async () => {
      const suffix = randomUUID().slice(0, 8);
      const alice = await createPlayer(`Alice-${suffix}`);
      const bob = await createPlayer(`Bob-${suffix}`);

      // Another test may have left a game open; it must not hide ours.
      for (let open = await db.getUnfinishedGame(); open; open = await db.getUnfinishedGame()) {
        await db.abandonGame(open.id);
      }

      const created = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { mode: 501, playerIds: [alice, bob] },
      });
      expect(created.statusCode).toBe(201);
      const gameId = created.json<GameBody>().id;

      // Alice: 180, 180, then 141 = T20 + T19 + D12 (double checkout). Bob misses every dart.
      for (let visit = 0; visit < 2; visit++) {
        for (let i = 0; i < 3; i++) await throwDart(gameId, alice, 20, 3);
        for (let i = 0; i < 3; i++) await throwDart(gameId, bob, 0, 1);
      }
      await throwDart(gameId, alice, 20, 3);
      const beforeFinish = await throwDart(gameId, alice, 19, 3);
      expect(beforeFinish.remaining[String(alice)]).toBe(24);
      expect(beforeFinish.status).toBe('in_progress');
      const last = await throwDart(gameId, alice, 12, 2);

      // The game state returned after the checkout.
      expect(last.status).toBe('finished');
      expect(last.winnerId).toBe(alice);
      expect(last.remaining[String(alice)]).toBe(0);

      // Criterion 2: winner and finished status are stored in the database.
      const stored = await db.getGame(gameId);
      expect(stored?.status).toBe('finished');
      const finished = (await db.listFinishedGames()).find((game) => game.id === gameId);
      expect(finished?.winnerId).toBe(alice);
      expect(await db.getUnfinishedGame()).toBeNull();

      // No more darts once the game is won.
      const extra = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/darts`,
        payload: { sector: 1, multiplier: 1 },
      });
      expect(extra.statusCode).toBe(409);

      // Criterion 3: statistics reflect the game.
      const aliceStats = await app.inject({ method: 'GET', url: `/api/stats/players/${alice}` });
      expect(aliceStats.json().groups[0].stats).toMatchObject({
        gamesPlayed: 1,
        gamesWon: 1,
        winPercent: 100,
        threeDartAverage: 167, // 501 points in 9 darts
        bestVisit: 180,
        count180: 2,
        highestCheckout: 141,
      });

      const bobStats = await app.inject({ method: 'GET', url: `/api/stats/players/${bob}` });
      expect(bobStats.json().groups[0].stats).toMatchObject({
        gamesPlayed: 1,
        gamesWon: 0,
        winPercent: 0,
        threeDartAverage: 0,
        highestCheckout: null,
      });

      // The game appears in the history with its winner.
      const history = await app.inject({ method: 'GET', url: `/api/history?playerId=${alice}` });
      const item = history.json<{ id: number; winner: { id: number } | null }[]>()[0];
      expect(item?.id).toBe(gameId);
      expect(item?.winner?.id).toBe(alice);
    });
  },
);
