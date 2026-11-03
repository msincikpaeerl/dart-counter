# 0003 — Database migrations

- Status: accepted
- Date: 2026-11-03

## Context

The app must create and update its PostgreSQL schema by itself when it starts (Docker Compose, no manual step). [ADR 0002](0002-technology-stack.md) chose plain SQL with the `pg` driver and no ORM.

## Decision

A small in-house runner (`migrateDatabase()` in `src/server/db.ts`) applies an ordered list of SQL migrations kept in `src/server/migrations.ts`. Applied names are stored in `schema_migrations`; each migration runs in a transaction; a PostgreSQL advisory lock serialises concurrent startups. The migrations are TypeScript strings, so they are always included in the build and the Docker image without copying extra files.

Player names are made unique with a unique index on `lower(name)`.

## Alternatives considered

- A migration library (node-pg-migrate, Drizzle Kit): extra dependency for a need this small; can be adopted later with a new ADR.
- `.sql` files read at startup: requires copying them into the build and the image.

## Consequences

- No new dependency.
- Merged migrations must never be edited; schema changes are always new entries.
- No down migrations: rolling back means restoring a backup.
