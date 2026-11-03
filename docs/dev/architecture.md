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
- `src/server/db.ts` is the only code that talks to PostgreSQL. It also applies the schema migrations at startup (see [database](database.md)).
- `src/scoring/` holds the X01 rules. It has no UI, server or database dependency; ESLint forbids those imports there.
- Uploaded files (player photos) are written to `UPLOAD_DIR`, which is a Docker volume in production, and served under `/uploads/`.
- Games: routes in `src/server/games.ts`. The browser never computes scores: each action is sent to the server, which stores the dart in `darts` and answers with the full game state computed by the scoring engine (`getGameView`, `suggestCheckout`). `GET /api/games/:id` (state), `POST /api/games/:id/darts` (`{sector, multiplier}`; a miss is `{sector: 0}`), `POST /api/games/:id/next` ("Joueur suivant": records misses for the darts left in the visit), `DELETE /api/games/:id/darts/last` (undo), `POST /api/games/:id/rematch` (same players and mode, new random order). The game page is `public/partie.html`, `partie.css`, `partie.js`.
- Players: routes in `src/server/players.ts` (`/api/players`, create/edit with a multipart form, `/api/players/:id/archive`); photos are resized to 512 px by `src/server/photos.ts` with `sharp` ([ADR 0004](../adr/0004-player-photos-and-web-pages.md)).
- Pages: plain HTML/CSS/JS in `public/` (copied into the Docker image), served under `/static/`; the players page is `/joueurs`.

## Scoring module

`src/scoring/` exposes (through `index.ts`):

- `applyTurn`, `dartValue`: score one visit of up to three darts.
- `createGame`, `throwDart`, `undoDart`, `getGameView`: a game is its configuration plus the list of darts thrown. `getGameView` replays the darts to give each player's remaining score, the visits, whose turn it is, the darts left in the visit and the winner. Undo simply removes the last dart, so it works across visits and undoes a bust or a win.
- `suggestCheckout(remaining, dartsLeft)`: a finish for 170 or less, using the fewest darts, preferring D20, D16, D8 and avoiding the bull unless needed. It returns `null` above 170, for bogey numbers (169, 168, 166, 165, 163, 162, 159) and when the darts left are too few. `formatDart` gives labels such as `T20`, `D16`, `Bull`.

Rules: 3 darts per visit, single in, double out (the bull counts as a double). A visit is a bust when the score goes below 0, leaves 1, or reaches 0 without a double; a bust scores 0, restores the score and passes the turn at once.

## Testing

Where each kind of test runs is described in [testing](testing.md). Tests that need PostgreSQL run in CI only.
