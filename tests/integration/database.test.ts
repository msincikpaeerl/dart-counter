import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db.js';

// Needs a real PostgreSQL: runs in CI only (docs/dev/testing.md).
const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('database (PostgreSQL)', () => {
  const db = createDatabase(databaseUrl ?? '');

  afterAll(async () => {
    await db.close();
  });

  it('answers a ping', async () => {
    await expect(db.ping()).resolves.toBeUndefined();
  });
});
