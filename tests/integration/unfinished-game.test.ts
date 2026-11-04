import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, migrateDatabase } from '../../src/server/db.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('unfinished and abandoned games (PostgreSQL)', () => {
  const db = createDatabase(databaseUrl ?? '');

  async function newPlayerId(): Promise<number> {
    const player = await db.createPlayer({
      name: `Unfinished-${randomUUID()}`,
      nickname: null,
      photoPath: null,
    });
    return player.id;
  }

  beforeAll(async () => {
    await migrateDatabase(databaseUrl ?? '');
  });

  // Leftovers from other tests must not count as the unfinished game.
  beforeEach(async () => {
    for (let game = await db.getUnfinishedGame(); game; game = await db.getUnfinishedGame()) {
      await db.abandonGame(game.id);
    }
  });

  afterAll(async () => {
    await db.close();
  });

  it('stores the type and options of a game (701, double out) and defaults to simple out', async () => {
    const playerId = await newPlayerId();
    const custom = await db.createGame(701, [playerId], { doubleOut: true });
    expect(await db.getGame(custom.id)).toMatchObject({ type: 'x01', mode: 701, doubleOut: true });
    const plain = await db.createGame(501, [playerId]);
    expect(await db.getGame(plain.id)).toMatchObject({ type: 'x01', mode: 501, doubleOut: false });
  });

  it('returns null when no game is in progress', async () => {
    expect(await db.getUnfinishedGame()).toBeNull();
  });

  it('returns the game in progress, and the most recent one when several exist', async () => {
    const playerId = await newPlayerId();
    const first = await db.createGame(501, [playerId]);
    expect((await db.getUnfinishedGame())?.id).toBe(first.id);

    const second = await db.createGame(301, [playerId]);
    const found = await db.getUnfinishedGame();
    expect(found?.id).toBe(second.id);
    expect(found?.mode).toBe(301);
    expect(found?.status).toBe('in_progress');
    expect(found?.players.map((p) => p.id)).toEqual([playerId]);
  });

  it('abandons a game: status abandoned, kept with its darts, no longer unfinished', async () => {
    const playerId = await newPlayerId();
    const game = await db.createGame(501, [playerId]);
    await db.addDart(game.id, {
      playerId,
      visitNumber: 1,
      dartNumber: 1,
      segment: 20,
      multiplier: 3,
      score: 60,
      bust: false,
    });

    await db.abandonGame(game.id);

    // The stored status is what future statistics queries rely on to exclude the game.
    const kept = await db.getGame(game.id);
    expect(kept?.status).toBe('abandoned');
    expect(await db.listDarts(game.id)).toHaveLength(1);
    expect(await db.getUnfinishedGame()).toBeNull();

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const result = await client.query<{ finished: boolean }>(
        'SELECT finished_at IS NOT NULL AS finished FROM games WHERE id = $1',
        [game.id],
      );
      expect(result.rows[0]?.finished).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('does not change a game that is already finished', async () => {
    const playerId = await newPlayerId();
    const game = await db.createGame(301, [playerId]);
    await db.setWinner(game.id, playerId);
    expect((await db.getGame(game.id))?.status).toBe('finished');

    await db.abandonGame(game.id);

    expect((await db.getGame(game.id))?.status).toBe('finished');
  });
});
