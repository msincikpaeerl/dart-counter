import pg from 'pg';
import { migrations, type Migration } from './migrations.js';

/** The only database access the app needs for now; tests can replace it with a stub. */
export interface Database {
  /** Resolves when the database answers, rejects otherwise. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(databaseUrl: string): Database {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return {
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
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
