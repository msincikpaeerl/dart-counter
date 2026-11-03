# Architecture

Components of Dart Counter and how they fit together. The reasons for each choice are in [ADR 0002](../adr/0002-technology-stack.md); the decision process is in [ADR 0001](../adr/0001-record-architecture-decisions.md).

## Stack

TypeScript on Node.js 24, Fastify, PostgreSQL 17. Only two services run: the **app** and **PostgreSQL**. There is no cache, queue, reverse proxy or separate front-end server. Dependencies are kept to the minimum: Fastify (with its multipart and static plugins) and the `pg` driver.

## Components

```
Browser (phone/tablet)
   │  HTML pages, JSON API, uploaded files
   ▼
app (Fastify)  ── src/server/
   ├─ pages        GET /
   ├─ JSON API     GET /api/health, POST /api/uploads
   ├─ files        /uploads/<name>, stored in UPLOAD_DIR (a volume)
   └─ database     src/server/db.ts ──► PostgreSQL
scoring rules   src/scoring/  (pure TypeScript, used by the server)
```

- `src/server/app.ts` builds the Fastify app from a `Database` and an upload directory, so tests can inject a stub database.
- `src/server/db.ts` is the only code that talks to PostgreSQL.
- `src/scoring/` holds the X01 rules. It has no UI, server or database dependency; ESLint forbids those imports there.
- Uploaded files (player photos) are written to `UPLOAD_DIR`, which is a Docker volume in production, and served under `/uploads/`.

## Testing

Where each kind of test runs is described in [testing](testing.md). Tests that need PostgreSQL run in CI only.
