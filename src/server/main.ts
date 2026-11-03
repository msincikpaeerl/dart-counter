import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, migrateDatabase } from './db.js';
import { retry } from './retry.js';

const config = loadConfig();
const applied = await retry(() => migrateDatabase(config.databaseUrl), {
  onRetry: (error, attempt) =>
    console.log(`Waiting for the database (attempt ${attempt}): ${String(error)}`),
});
console.log(
  applied.length > 0
    ? `Applied migrations: ${applied.join(', ')}`
    : 'Database schema is up to date',
);
const db = createDatabase(config.databaseUrl);
const app = await buildApp({ db, uploadDir: config.uploadDir });

app.addHook('onClose', async () => {
  await db.close();
});

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Dart Counter listening on port ${config.port}`);
