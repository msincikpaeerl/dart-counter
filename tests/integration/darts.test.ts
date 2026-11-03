import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, migrateDatabase } from '../../src/server/db.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('darts (PostgreSQL)', () => {
  const db = createDatabase(databaseUrl ?? '');

  beforeAll(async () => {
    await migrateDatabase(databaseUrl ?? '');
  });

  afterAll(async () => {
    await db.close();
  });

  it('stores darts in order, deletes the last one and records the winner', async () => {
    const player = await db.createPlayer({
      name: `Darts-${randomUUID()}`,
      nickname: null,
      photoPath: null,
    });
    const game = await db.createGame(301, [player.id]);
    const base = { playerId: player.id, multiplier: 3, score: 60, segment: 20, bust: false };
    await db.addDart(game.id, { ...base, visitNumber: 1, dartNumber: 1 });
    await db.addDart(game.id, { ...base, visitNumber: 1, dartNumber: 2 });
    await db.addDart(game.id, {
      playerId: player.id,
      visitNumber: 1,
      dartNumber: 3,
      segment: 0,
      multiplier: 0,
      score: 0,
      bust: false,
    });
    expect((await db.listDarts(game.id)).map((d) => d.dartNumber)).toEqual([1, 2, 3]);

    await db.removeLastDart(game.id);
    expect((await db.listDarts(game.id)).map((d) => d.dartNumber)).toEqual([1, 2]);

    await db.setWinner(game.id, player.id);
    expect((await db.getGame(game.id))?.status).toBe('finished');
    await db.setWinner(game.id, null);
    expect((await db.getGame(game.id))?.status).toBe('in_progress');
  });
});
