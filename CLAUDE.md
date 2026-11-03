# CLAUDE.md — Dart Counter

Instructions for Claude Code working on this repository. Keep this file under 150 lines.
Details belong in `docs/`; this file only points to them.

## What this project is

Private web app (French UI) for scoring X01 darts games (301/501) at home on a phone or tablet. Saved players with photos, dart-by-dart scoring on a clickable board or keypad, checkout suggestions, resumable games and per-player statistics. Backend with PostgreSQL, delivered with Docker Compose, no authentication.

## Current state

Bootstrapped: TypeScript on Node 24, Fastify, PostgreSQL (see `docs/adr/0002-technology-stack.md`). Two services only: app + PostgreSQL. No product feature yet, only a health route, an upload route and a sample scoring module. The database schema (players, games, game_players, darts) is created by migrations applied at startup: see `docs/dev/database.md`; add schema changes as new entries in `src/server/migrations.ts`, never edit merged ones.

## Read before working

1. The ticket you were given.
2. The documentation of the area you touch in `docs/dev/`.
3. The decisions in `docs/adr/` related to that area.

## Commands

Run them from the repository root. Agents have no database: the PostgreSQL tests run in CI only.

| Task                                              | Command                                   |
| ------------------------------------------------- | ----------------------------------------- |
| Install                                           | `npm ci`                                  |
| Lint                                              | `npm run lint`                            |
| Format (write) / check                            | `npm run format` / `npm run format:check` |
| Type check                                        | `npm run typecheck`                       |
| Tests (unit + server, no database)                | `npm test`                                |
| Integration tests (PostgreSQL, CI only)           | `npm run test:integration`                |
| Build                                             | `npm run build`                           |
| Documentation link check (the same command as CI) | `npm run docs:links`                      |
| Run everything with Docker                        | `docker compose up --build`               |

## Repository map

```
src/scoring/        Pure X01 scoring rules: no UI, server or database imports (ESLint enforces it)
src/server/         Fastify app: app.ts (routes), db.ts (PostgreSQL), config.ts (env), main.ts (entry)
tests/unit/         Unit tests (scoring)
tests/server/       HTTP route tests with app.inject() and a stub database
tests/integration/  Tests needing PostgreSQL (CI only; skipped without DATABASE_URL)
docs/user/          User documentation, organised by tasks
docs/dev/           Developer documentation (architecture, setup, testing)
docs/adr/           Architecture Decision Records
.github/            CI and the pull request template
Dockerfile, docker-compose.yml, .env.example   Delivery (app + db, uploads on a volume)
```

## Conventions

- Commits follow Conventional Commits with the ticket number: `feat(WEB-12): add contact form`.
- Every significant technical choice gets an ADR: copy `docs/adr/0000-template.md`, next number.
- A user-visible change updates `docs/user/` and `CHANGELOG.md` in the same pull request.
- CI: every job in `.github/workflows/ci.yml` is listed in the `needs` of the final `ci` job. Never rename or remove `ci`: branch protection requires it, and no pull request can be merged without it.
- TypeScript strict, ES modules: relative imports end in `.js`. Prettier formats, ESLint lints; run `npm run format` before committing.
- Dependencies are pinned exactly in `package.json`; keep them minimal and justify new ones in an ADR.
- Database access goes through `src/server/db.ts`; game rules go in `src/scoring/`.
- Uploaded files go to `UPLOAD_DIR`, never into the repository.
- All text in English (the product UI is in French).

## Tests

- New behaviour needs tests.
- A bug fix starts with a regression test that fails before the fix.
- Never weaken or delete a test to make CI pass: fix the code, or explain in the pull request why the test was wrong.
- Code that needs PostgreSQL is tested in `tests/integration/`, which runs in CI only (see `docs/dev/testing.md`).

## Before finishing

Every command in the Commands table (except Docker, and except the integration tests, which need a database) must pass.

## Never

- Never commit secrets. Environment variables are listed in `.env.example`.
- Never commit to the default branch: work on the ticket branch.
