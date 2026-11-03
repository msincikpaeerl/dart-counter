# Testing

Tests use Vitest, configured in [`vitest.config.ts`](../../vitest.config.ts) with three levels.

| Level                    | Folder               | Runs with                  | Where                                |
| ------------------------ | -------------------- | -------------------------- | ------------------------------------ |
| Unit (scoring rules)     | `tests/unit/`        | `npm test`                 | Locally and CI                       |
| Server (HTTP routes)     | `tests/server/`      | `npm test`                 | Locally and CI                       |
| Integration (PostgreSQL) | `tests/integration/` | `npm run test:integration` | **CI only** (job `test-integration`) |
| Documentation links      | all Markdown files   | `npm run docs:links`       | Locally and CI (`docs-links`)        |

- **Unit** tests cover `src/scoring/`, which is pure and needs nothing else.
- **Server** tests call the Fastify app with `app.inject()` and a stub database, and write uploads to a temporary folder.
- **Integration** tests use a real PostgreSQL.

## PostgreSQL tests run in CI only

Agents cannot run a database on their machine yet. Integration tests therefore run in the CI job `test-integration`, which starts a PostgreSQL service and sets `DATABASE_URL`. Without `DATABASE_URL` they are skipped, so `npm run test:integration` is safe but does nothing locally. New code that touches the database needs an integration test, and a stub-based server test where possible.

## Rules

- New behaviour needs tests; a bug fix starts with a failing regression test.
- Never weaken or delete a test to make CI pass.
