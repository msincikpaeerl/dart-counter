/**
 * Database migrations, applied in order at app startup (docs/dev/database.md).
 *
 * Rules: never edit a migration once it is merged; add a new one at the end.
 * They are TypeScript strings (not .sql files) so they are always part of the build.
 */
export interface Migration {
  /** Unique, sortable name; the order of the list is the order of application. */
  name: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  {
    name: '0001_initial_schema',
    sql: `
CREATE TABLE players (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  nickname    text,
  photo_path  text,
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Names are unique ignoring case ("Alice" and "alice" are the same player).
CREATE UNIQUE INDEX players_name_unique ON players (lower(name));

CREATE TABLE games (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mode              smallint NOT NULL CHECK (mode IN (301, 501)),
  status            text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'finished', 'abandoned')),
  winner_player_id  bigint REFERENCES players (id),
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  CHECK (winner_player_id IS NULL OR status = 'finished')
);
CREATE INDEX games_status_idx ON games (status);

CREATE TABLE game_players (
  game_id     bigint NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  player_id   bigint NOT NULL REFERENCES players (id),
  play_order  smallint NOT NULL CHECK (play_order >= 1),
  PRIMARY KEY (game_id, player_id),
  UNIQUE (game_id, play_order)
);
CREATE INDEX game_players_player_idx ON game_players (player_id);

-- One row per dart thrown. Replaying a game = reading its darts ordered by
-- (visit_number, dart_number). visit_number counts visits across the whole game
-- (1, 2, 3...), each visit belonging to one player, up to 3 darts.
CREATE TABLE darts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id       bigint NOT NULL,
  player_id     bigint NOT NULL,
  visit_number  integer NOT NULL CHECK (visit_number >= 1),
  dart_number   smallint NOT NULL CHECK (dart_number BETWEEN 1 AND 3),
  segment       smallint NOT NULL CHECK (segment BETWEEN 0 AND 25 AND segment NOT BETWEEN 21 AND 24),
  multiplier    smallint NOT NULL CHECK (multiplier BETWEEN 0 AND 3),
  score         smallint NOT NULL CHECK (score BETWEEN 0 AND 60),
  bust          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (game_id, player_id) REFERENCES game_players (game_id, player_id) ON DELETE CASCADE,
  UNIQUE (game_id, visit_number, dart_number)
);
CREATE INDEX darts_player_idx ON darts (player_id);
`,
  },
];
