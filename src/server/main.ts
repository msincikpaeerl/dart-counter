import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const app = await buildApp({ db, uploadDir: config.uploadDir });

app.addHook('onClose', async () => {
  await db.close();
});

await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Dart Counter listening on port ${config.port}`);
