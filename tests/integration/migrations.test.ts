import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../src/server/db.js';
import { migrations } from '../../src/server/migrations.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('migrations (PostgreSQL)', () => {
  const url = databaseUrl ?? '';
  const pool = new pg.Pool({ connectionString: url });

  beforeAll(async () => {
    // Start from a fresh, empty database.
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates the full schema on an empty database', async () => {
    const applied = await migrateDatabase(url);
    expect(applied).toEqual(migrations.map((m) => m.name));
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tables = rows.map((r) => r.table_name);
    for (const t of ['players', 'games', 'game_players', 'darts', 'schema_migrations']) {
      expect(tables).toContain(t);
    }
  });

  it('can run again without failing or losing data', async () => {
    await pool.query(`INSERT INTO players (name) VALUES ('Keep me')`);
    await expect(migrateDatabase(url)).resolves.toEqual([]);
    const { rows } = await pool.query(`SELECT name FROM players WHERE name = 'Keep me'`);
    expect(rows).toHaveLength(1);
  });

  it('can run concurrently', async () => {
    await expect(Promise.all([migrateDatabase(url), migrateDatabase(url)])).resolves.toBeDefined();
  });

  it('enforces unique player names, ignoring case', async () => {
    await pool.query(`INSERT INTO players (name) VALUES ('Alice')`);
    await expect(pool.query(`INSERT INTO players (name) VALUES ('Alice')`)).rejects.toThrow(
      /players_name_unique/,
    );
    await expect(pool.query(`INSERT INTO players (name) VALUES ('alice')`)).rejects.toThrow(
      /players_name_unique/,
    );
  });

  it('stores every dart with game, player, visit and order so a game can be replayed', async () => {
    const p = await pool.query<{ id: string }>(
      `INSERT INTO players (name) VALUES ('Bob'), ('Carol') RETURNING id`,
    );
    const [bob, carol] = p.rows.map((r) => r.id);
    const g = await pool.query<{ id: string }>(
      `INSERT INTO games (mode) VALUES (501) RETURNING id`,
    );
    const game = g.rows[0]?.id;
    await pool.query(
      `INSERT INTO game_players (game_id, player_id, play_order) VALUES ($1, $2, 1), ($1, $3, 2)`,
      [game, bob, carol],
    );
    // Insert out of order on purpose.
    await pool.query(
      `INSERT INTO darts (game_id, player_id, visit_number, dart_number, segment, multiplier, score, bust)
       VALUES ($1, $3, 2, 1, 20, 1, 20, false),
              ($1, $2, 1, 2, 5, 1, 5, false),
              ($1, $2, 1, 1, 20, 3, 60, false)`,
      [game, bob, carol],
    );
    const { rows } = await pool.query<{ player_id: string; score: number }>(
      `SELECT player_id, score FROM darts WHERE game_id = $1 ORDER BY visit_number, dart_number`,
      [game],
    );
    expect(rows.map((r) => [r.player_id, r.score])).toEqual([
      [bob, 60],
      [bob, 5],
      [carol, 20],
    ]);
    // A dart of a player who is not in the game is rejected.
    const other = await pool.query<{ id: string }>(
      `INSERT INTO players (name) VALUES ('Dave') RETURNING id`,
    );
    await expect(
      pool.query(
        `INSERT INTO darts (game_id, player_id, visit_number, dart_number, segment, multiplier, score)
         VALUES ($1, $2, 3, 1, 1, 1, 1)`,
        [game, other.rows[0]?.id],
      ),
    ).rejects.toThrow();
  });
});
