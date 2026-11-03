import pg from 'pg';

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
