# Setup

## Requirements

- Node.js 24.21.0 or newer, and npm.
- Docker with Compose, to run the full product (app and PostgreSQL).

## Install

```
npm ci
```

## Commands

| Task                     | Command                                    |
| ------------------------ | ------------------------------------------ |
| Install                  | `npm ci`                                   |
| Lint                     | `npm run lint`                             |
| Format (write)           | `npm run format`                           |
| Format check             | `npm run format:check`                     |
| Type check               | `npm run typecheck`                        |
| Tests (no database)      | `npm test`                                 |
| Integration tests (CI)   | `npm run test:integration`                 |
| Build                    | `npm run build`                            |
| Documentation link check | `npm run docs:links`                       |
| Run in development       | `npm run dev` (needs a reachable database) |

## Environment variables

Listed with defaults in [`.env.example`](../../.env.example): `PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `UPLOAD_DIR`. Copy it to `.env`; never commit `.env`. Docker Compose reads `.env` itself: it builds the app's `DATABASE_URL` from the `POSTGRES_*` variables and fixes `UPLOAD_DIR` to the volume, so `DATABASE_URL` and `UPLOAD_DIR` in `.env` only matter outside Docker.

## Running the product

`docker compose up -d --build` starts the `app` and `db` services (nothing else). The database lives on the `pgdata` named volume, uploaded photos on the `uploads` volume (mounted at `/data`); both survive `docker compose down` (not `down -v`). The `app` service starts once the database health check passes; `src/server/main.ts` also retries the connection (`src/server/retry.ts`) before applying migrations, so a slow database does not crash it. See [getting started](../user/getting-started.md).

Agents cannot run a database on their machine: they work without PostgreSQL and rely on CI for the tests that need it (see [testing](testing.md)).

## Documentation link check

CI checks that every relative link in the Markdown files points to an existing file and heading with `npm run docs:links` (see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). The tools are pinned dev dependencies.
