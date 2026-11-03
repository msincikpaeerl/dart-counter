export interface Config {
  port: number;
  databaseUrl: string;
  /** Directory (a Docker volume in production) where uploaded files are stored. */
  uploadDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env['PORT'] ?? 3000),
    databaseUrl: env['DATABASE_URL'] ?? 'postgres://dart:dart@localhost:5432/dart',
    uploadDir: env['UPLOAD_DIR'] ?? './data/uploads',
  };
}
