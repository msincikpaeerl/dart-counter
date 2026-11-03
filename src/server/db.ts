import pg from 'pg';
import { migrations, type Migration } from './migrations.js';

export interface Player {
  id: number;
  name: string;
  nickname: string | null;
  /** File name inside UPLOAD_DIR, or null when the player has no photo. */
  photoPath: string | null;
  archived: boolean;
}

export interface PlayerChanges {
  name: string;
  nickname: string | null;
  /** `undefined` keeps the current photo, `null` removes it. */
  photoPath?: string | null;
}

/** Thrown when another player already has this name (ignoring case). */
export class DuplicatePlayerNameError extends Error {
  constructor() {
    super('A player with this name already exists');
  }
}

/** The database access the app needs; tests can replace it with a stub. */
export interface Database {
  /** Resolves when the database answers, rejects otherwise. */
  ping(): Promise<void>;
  close(): Promise<void>;
  /** Active (not archived) players, sorted by name. */
  listPlayers(): Promise<Player[]>;
  getPlayer(id: number): Promise<Player | null>;
  createPlayer(input: {
    name: string;
    nickname: string | null;
    photoPath: string | null;
  }): Promise<Player>;
  /** Returns null when the player does not exist. */
  updatePlayer(id: number, changes: PlayerChanges): Promise<Player | null>;
  /** Archives the player; returns null when the player does not exist. */
  archivePlayer(id: number): Promise<Player | null>;
}

interface PlayerRow {
  id: number;
  name: string;
  nickname: string | null;
  photo_path: string | null;
  archived: boolean;
}

const PLAYER_COLUMNS = 'id::int AS id, name, nickname, photo_path, archived';
const UNIQUE_VIOLATION = '23505';

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    photoPath: row.photo_path,
    archived: row.archived,
  };
}

export function createDatabase(databaseUrl: string): Database {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  async function run(text: string, values: unknown[]): Promise<Player | null> {
    try {
      const result = await pool.query<PlayerRow>(text, values);
      const row = result.rows[0];
      return row ? toPlayer(row) : null;
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new DuplicatePlayerNameError();
      }
      throw error;
    }
  }

  return {
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
    async listPlayers() {
      const result = await pool.query<PlayerRow>(
        `SELECT ${PLAYER_COLUMNS} FROM players WHERE NOT archived ORDER BY lower(name)`,
      );
      return result.rows.map(toPlayer);
    },
    getPlayer(id) {
      return run(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [id]);
    },
    async createPlayer(input) {
      const player = await run(
        `INSERT INTO players (name, nickname, photo_path) VALUES ($1, $2, $3)
         RETURNING ${PLAYER_COLUMNS}`,
        [input.name, input.nickname, input.photoPath],
      );
      if (!player) throw new Error('Insert returned no row');
      return player;
    },
    updatePlayer(id, changes) {
      const keepPhoto = changes.photoPath === undefined;
      return run(
        `UPDATE players SET name = $2, nickname = $3,
           photo_path = CASE WHEN $4 THEN photo_path ELSE $5 END
         WHERE id = $1 RETURNING ${PLAYER_COLUMNS}`,
        [id, changes.name, changes.nickname, keepPhoto, changes.photoPath ?? null],
      );
    },
    archivePlayer(id) {
      return run(`UPDATE players SET archived = true WHERE id = $1 RETURNING ${PLAYER_COLUMNS}`, [
        id,
      ]);
    },
  };
}

/** Arbitrary constant identifying our migrations in PostgreSQL advisory locks. */
const MIGRATION_LOCK_ID = 727_001;

/**
 * Applies every migration not yet recorded in `schema_migrations`, in order.
 * Safe to run at every startup (already-applied migrations are skipped) and
 * from several app instances at once (an advisory lock serialises them).
 * Returns the names of the migrations applied by this call.
 */
export async function migrateDatabase(
  databaseUrl: string,
  list: readonly Migration[] = migrations,
): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           name        text PRIMARY KEY,
           applied_at  timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const done = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
      const doneNames = new Set(done.rows.map((row) => row.name));
      for (const migration of list) {
        if (doneNames.has(migration.name)) continue;
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
        applied.push(migration.name);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } finally {
    await client.end();
  }
  return applied;
}
