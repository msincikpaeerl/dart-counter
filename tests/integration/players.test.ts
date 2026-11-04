import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, DuplicatePlayerNameError, migrateDatabase } from '../../src/server/db.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('players (PostgreSQL)', () => {
  const db = createDatabase(databaseUrl ?? '');
  const unique = (label: string) => `${label}-${randomUUID()}`;

  beforeAll(async () => {
    await migrateDatabase(databaseUrl ?? '');
  });

  afterAll(async () => {
    await db.close();
  });

  it('creates, reads and edits a player', async () => {
    const name = unique('Alice');
    const created = await db.createPlayer({ name, nickname: 'Al', photoPath: 'a.jpg' });
    expect(created).toMatchObject({ name, nickname: 'Al', photoPath: 'a.jpg', archived: false });
    expect(typeof created.id).toBe('number');

    const kept = await db.updatePlayer(created.id, { name, nickname: null });
    expect(kept).toMatchObject({ nickname: null, photoPath: 'a.jpg' });
    const removed = await db.updatePlayer(created.id, { name, nickname: null, photoPath: null });
    expect(removed?.photoPath).toBeNull();
    expect(await db.updatePlayer(2_000_000_000, { name: unique('x'), nickname: null })).toBeNull();
  });

  it('stores the double-out option, off by default and kept when not given', async () => {
    const plain = await db.createPlayer({ name: unique('Do'), nickname: null, photoPath: null });
    expect(plain.doubleOut).toBe(false);
    const forced = await db.updatePlayer(plain.id, {
      name: plain.name,
      nickname: null,
      doubleOut: true,
    });
    expect(forced?.doubleOut).toBe(true);
    const kept = await db.updatePlayer(plain.id, { name: plain.name, nickname: null });
    expect(kept?.doubleOut).toBe(true);
  });

  it('refuses a duplicate name ignoring case', async () => {
    const name = unique('Bob');
    await db.createPlayer({ name, nickname: null, photoPath: null });
    await expect(
      db.createPlayer({ name: name.toUpperCase(), nickname: null, photoPath: null }),
    ).rejects.toBeInstanceOf(DuplicatePlayerNameError);
  });

  it('creates a game with its players in play order', async () => {
    const a = await db.createPlayer({ name: unique('A'), nickname: null, photoPath: null });
    const b = await db.createPlayer({ name: unique('B'), nickname: null, photoPath: null });
    const game = await db.createGame(301, [b.id, a.id]);
    expect(game).toMatchObject({ mode: 301, status: 'in_progress' });
    expect(game.players.map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await db.getGame(game.id))?.players.map((p) => p.id)).toEqual([b.id, a.id]);
    expect(await db.getGame(2_000_000_000)).toBeNull();
  });

  it('hides archived players from the list', async () => {
    const created = await db.createPlayer({ name: unique('Cy'), nickname: null, photoPath: null });
    expect((await db.listPlayers()).some((p) => p.id === created.id)).toBe(true);
    expect((await db.archivePlayer(created.id))?.archived).toBe(true);
    expect((await db.listPlayers()).some((p) => p.id === created.id)).toBe(false);
    expect((await db.getPlayer(created.id))?.archived).toBe(true);
  });
});
