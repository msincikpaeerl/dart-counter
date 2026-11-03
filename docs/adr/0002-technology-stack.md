# 0002 — Technology stack

- Status: accepted
- Date: 2026-11-03

## Context

Dart Counter is a private web app used on a phone or tablet at home, with a backend, PostgreSQL and file uploads (player photos). It is delivered with Docker Compose with only two services (the app and PostgreSQL). It is built by AI agents, so the stack must be mainstream, well documented and checkable by commands. Agents cannot run a database on their machine: anything needing PostgreSQL is tested in CI only.

## Decision

- Language: TypeScript (strict) on Node.js 24 LTS, for the server and the scoring rules.
- Web framework: Fastify 5 with `@fastify/multipart` (uploads) and `@fastify/static` (serving uploaded files). It serves HTML pages and a JSON API from one process.
- Database: PostgreSQL 17 through the `pg` driver, no ORM for now (plain SQL, added when the first feature needs tables).
- Pure scoring module in `src/scoring/`, with no dependency on the server or database (enforced by ESLint).
- Tooling: npm, Vitest (tests), ESLint with typescript-eslint, Prettier, `tsc` (type check and build), remark with `remark-validate-links` (documentation links).
- Delivery: one Dockerfile and `docker-compose.yml` with two services, `app` and `db`; uploads live on a named volume (`UPLOAD_DIR`).
- Tests that need PostgreSQL run in the CI job `test-integration` only.

Versions are pinned exactly in `package.json`. TypeScript is held at 6.0.x because typescript-eslint does not yet support 7.

## Alternatives considered

- Python (Django or FastAPI): good, but two languages would be needed for the interactive scoring screen, or heavier server-rendered pages.
- Next.js or another full-stack framework: more dependencies and build complexity than a two-service home app needs.
- Express: older and less typed than Fastify; no built-in validation or inject-based testing.
- An ORM (Prisma, Drizzle): useful later, but premature before the data model exists; a new ADR will cover it.
- SQLite: simpler, but the project requires PostgreSQL.

## Consequences

- One language and one toolchain for everything; the scoring rules can be reused in the browser later.
- Database code cannot be checked on agents' machines; CI is the only place it runs.
- No front-end framework is chosen yet: pages are server-rendered, and a front-end choice needs its own ADR.
