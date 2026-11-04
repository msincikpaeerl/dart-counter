# Database

PostgreSQL 17, plain SQL, no ORM. The choice of migration mechanism is in [ADR 0003](../adr/0003-database-migrations.md).

## Schema

| Table          | Content                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `players`      | `name` (unique, case-insensitive), `nickname`, `photo_path`, `archived`, `double_out` (false = simple out)              |
| `games`        | `mode` (301 or 501), `status` (`in_progress`, `finished`, `abandoned`), `winner_player_id`, `started_at`, `finished_at` |
| `game_players` | Players of a game with their `play_order` (1, 2, ...); unique per game                                                  |
| `darts`        | One row per dart: `game_id`, `player_id`, `visit_number`, `dart_number` (1-3), `segment`, `multiplier`, `score`, `bust` |

Details worth knowing:

- Player names are unique at database level, ignoring case (`Alice` and `alice` clash). Archived players keep their name.
- `segment` is 0 (miss), 1-20, or 25 (bull); `multiplier` is 0-3 (0 for a miss); `score` is the points of that dart (0-60).
- `visit_number` counts visits over the whole game (1, 2, 3, ...); each visit belongs to one player. Replaying a game means reading its darts ordered by `(visit_number, dart_number)`. `(game_id, visit_number, dart_number)` is unique.
- A dart must belong to a player who is in the game (foreign key on `game_players`).
- A winner can only be set on a `finished` game.
- Abandoned games are kept (`status = 'abandoned'`) but must never count in statistics: every statistics query counts `status = 'finished'` games only (`tests/integration/stats-abandoned.test.ts` proves an abandoned game with darts changes no statistic or history). The unfinished game offered on opening the app is the latest `in_progress` one.

## Migrations

Migrations are listed in order in [`src/server/migrations.ts`](../../src/server/migrations.ts) and applied by `migrateDatabase()` in `src/server/db.ts` at every app startup, before the server listens.

- Applied migrations are recorded in the `schema_migrations` table, so restarting never re-applies them nor touches data.
- Each migration runs in a transaction; a failure rolls it back and stops the startup.
- An advisory lock makes concurrent startups safe.
- **Never edit a migration that has been merged.** Add a new one at the end of the list, named `NNNN_description`.

Migrations are verified against a fresh PostgreSQL by `tests/integration/migrations.test.ts`, in the CI job `test-integration` (see [testing](testing.md)).
