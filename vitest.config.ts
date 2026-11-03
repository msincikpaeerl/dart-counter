import { defineConfig } from 'vitest/config';

// Three test levels (see docs/dev/testing.md):
// - unit: pure code, no I/O
// - server: HTTP routes through Fastify's inject(), database replaced by a stub
// - integration: needs a real PostgreSQL (DATABASE_URL); runs in CI only
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { test: { name: 'server', include: ['tests/server/**/*.test.ts'] } },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 20000,
        },
      },
    ],
  },
});
