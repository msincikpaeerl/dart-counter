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

Listed with defaults in [`.env.example`](../../.env.example): `PORT`, `DATABASE_URL`, `UPLOAD_DIR`, `POSTGRES_PASSWORD`. Copy it to `.env` for local use; never commit `.env`.

## Running the product

`docker compose up --build` starts the `app` and `db` services. See [getting started](../user/getting-started.md).

Agents cannot run a database on their machine: they work without PostgreSQL and rely on CI for the tests that need it (see [testing](testing.md)).

## Documentation link check

CI checks that every relative link in the Markdown files points to an existing file and heading with `npm run docs:links` (see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). The tools are pinned dev dependencies.
