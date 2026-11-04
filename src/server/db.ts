import pg from 'pg';
import { migrations, type Migration } from './migrations.js';

export interface Player {
  id: number;
  name: string;
  nickname: string | null;
  /** File name inside UPLOAD_DIR, or null when the player has no photo. */
  photoPath: string | null;
  archived: boolean;
  /** Must finish on a double (or the bull). Off by default: simple out. */
  doubleOut: boolean;
}

export interface PlayerChanges {
  name: string;
  nickname: string | null;
  /** `undefined` keeps the current value. */
  doubleOut?: boolean;
  /** `undefined` keeps the current photo, `null` removes it. */
  photoPath?: string | null;
}

/** Thrown when another player already has this name (ignoring case). */
export class DuplicatePlayerNameError extends Error {
  constructor() {
    super('A player with this name already exists');
  }
}

/** A game with its players in play order (first to throw first). */
export interface Game {
  id: number;
  type: 'x01' | 'battle';
  /** X01 option: the starting score. Battle option: the hit points of each team. */
  mode: 301 | 501 | 701 | 500 | 1000 | 2000;
  /** Battle only: the ids of the players of team 1 and of team 2, in throwing order. */
  teams: [number[], number[]] | null;
  /** X01 option: finish on a double for every player (a player's own double out also applies). */
  doubleOut: boolean;
  status: 'in_progress' | 'finished' | 'abandoned';
  players: Player[];
}

/** A finished game: archived players are kept in `players`. Dates are ISO 8601 strings. */
export interface FinishedGame extends Game {
  winnerId: number | null;
  startedAt: string;
  finishedAt: string;
}

/** One dart as stored in the `darts` table. A miss is segment 0, multiplier 0, score 0. */
export interface DartRecord {
  playerId: number;
  visitNumber: number;
  dartNumber: number;
  segment: number;
  multiplier: number;
  score: number;
  bust: boolean;
}

/** The database access the app needs; tests can replace it with a stub. */
export interface Database {
  /** Resolves when the database answers, rejects otherwise. */
  ping(): Promise<void>;
  close(): Promise<void>;
  /** Active (not archived) players, sorted by name. */
  listPlayers(): Promise<Player[]>;
  getPlayer(id: number): Promise<Player | null>;
  createPlayer(input: {
    name: string;
    nickname: string | null;
    photoPath: string | null;
    doubleOut?: boolean;
  }): Promise<Player>;
  /** Returns null when the player does not exist. */
  updatePlayer(id: number, changes: PlayerChanges): Promise<Player | null>;
  /** Archives the player; returns null when the player does not exist. */
  archivePlayer(id: number): Promise<Player | null>;
  /**
   * Creates a game; `playerIds` is the play order. Players must exist.
   * A battle game gives its two teams (the players are then the teams' players).
   */
  createGame(
    mode: Game['mode'],
    playerIds: number[],
    options?: { doubleOut?: boolean; teams?: [number[], number[]] },
  ): Promise<Game>;
  getGame(id: number): Promise<Game | null>;
  /** Finished games only (never abandoned or in progress), most recent first. */
  listFinishedGames(): Promise<FinishedGame[]>;
  /** The most recently started game still in progress, or null. */
  getUnfinishedGame(): Promise<Game | null>;
  /** Closes a game in progress as abandoned (kept in the data, excluded from statistics). */
  abandonGame(id: number): Promise<void>;
  /** Darts of a game in throwing order. */
  listDarts(gameId: number): Promise<DartRecord[]>;
  addDart(gameId: number, dart: DartRecord): Promise<void>;
  /** Deletes the last dart thrown (no-op when there is none). */
  removeLastDart(gameId: number): Promise<void>;
  /** Marks the game finished with this winner, or back in progress when `winnerId` is null. */
  setWinner(gameId: number, winnerId: number | null): Promise<void>;
}

interface PlayerRow {
  id: number;
  name: string;
  nickname: string | null;
  photo_path: string | null;
  archived: boolean;
  double_out: boolean;
}

const PLAYER_COLUMNS = 'id::int AS id, name, nickname, photo_path, archived, double_out';
const UNIQUE_VIOLATION = '23505';

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    photoPath: row.photo_path,
    archived: row.archived,
    doubleOut: row.double_out,
  };
}

export function createDatabase(databaseUrl: string): Database {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  async function run(text: string, values: unknown[]): Promise<Player | null> {
    try {
      const result = await pool.query<PlayerRow>(text, values);
      const row = result.rows[0];
      return row ? toPlayer(row) : null;
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new DuplicatePlayerNameError();
      }
      throw error;
    }
  }

  async function loadGame(id: number): Promise<Game | null> {
    const game = await pool.query<{
      id: number;
      mode: number;
      game_type: Game['type'];
      double_out: boolean;
      status: Game['status'];
    }>('SELECT id::int AS id, mode, game_type, double_out, status FROM games WHERE id = $1', [id]);
    const row = game.rows[0];
    if (!row) return null;
    const players = await pool.query<PlayerRow & { team: number | null }>(
      `SELECT p.id::int AS id, p.name, p.nickname, p.photo_path, p.archived, p.double_out, gp.team
       FROM game_players gp JOIN players p ON p.id = gp.player_id
       WHERE gp.game_id = $1 ORDER BY gp.play_order`,
      [id],
    );
    const teams: [number[], number[]] | null =
      row.game_type === 'battle'
        ? [
            players.rows.filter((p) => p.team === 1).map((p) => p.id),
            players.rows.filter((p) => p.team === 2).map((p) => p.id),
          ]
        : null;
    return {
      id: row.id,
      type: row.game_type,
      mode: row.mode as Game['mode'],
      teams,
      doubleOut: row.double_out,
      status: row.status,
      players: players.rows.map(toPlayer),
    };
  }

  return {
    async ping() {
      await pool.query('SELECT 1');
    },
    async createGame(mode, playerIds, options = {}) {
      const client = await pool.connect();
      let gameId: number;
      try {
        await client.query('BEGIN');
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO games (game_type, mode, double_out) VALUES ($3, $1, $2)
           RETURNING id::int AS id`,
          [mode, options.doubleOut ?? false, options.teams ? 'battle' : 'x01'],
        );
        gameId = inserted.rows[0]?.id ?? 0;
        const teamOf = options.teams
          ? playerIds.map((id) => (options.teams?.[0].includes(id) ? 1 : 2))
          : playerIds.map(() => null);
        await client.query(
          `INSERT INTO game_players (game_id, player_id, play_order, team)
           SELECT $1, p.id, p.ord, p.team
           FROM unnest($2::bigint[], $3::smallint[]) WITH ORDINALITY AS p(id, team, ord)`,
          [gameId, playerIds, teamOf],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      const game = await loadGame(gameId);
      if (!game) throw new Error('Game not found after creation');
      return game;
    },
    getGame: loadGame,
    async listFinishedGames() {
      const games = await pool.query<{
        id: number;
        mode: number;
        winner_player_id: number | null;
        started_at: Date;
        finished_at: Date | null;
      }>(
        `SELECT id::int AS id, mode, winner_player_id::int AS winner_player_id, started_at, finished_at
         FROM games WHERE status = 'finished' ORDER BY finished_at DESC NULLS LAST, id DESC`,
      );
      const result: FinishedGame[] = [];
      for (const row of games.rows) {
        const game = await loadGame(row.id);
        if (!game) continue;
        result.push({
          ...game,
          winnerId: row.winner_player_id,
          startedAt: row.started_at.toISOString(),
          finishedAt: (row.finished_at ?? row.started_at).toISOString(),
        });
      }
      return result;
    },
    async getUnfinishedGame() {
      const result = await pool.query<{ id: number }>(
        `SELECT id::int AS id FROM games WHERE status = 'in_progress'
         ORDER BY started_at DESC, id DESC LIMIT 1`,
      );
      const row = result.rows[0];
      return row ? loadGame(row.id) : null;
    },
    async abandonGame(id) {
      await pool.query(
        `UPDATE games SET status = 'abandoned', finished_at = now()
         WHERE id = $1 AND status = 'in_progress'`,
        [id],
      );
    },
    async listDarts(gameId) {
      const result = await pool.query<{
        player_id: number;
        visit_number: number;
        dart_number: number;
        segment: number;
        multiplier: number;
        score: number;
        bust: boolean;
      }>(
        `SELECT player_id::int AS player_id, visit_number, dart_number, segment, multiplier, score, bust
         FROM darts WHERE game_id = $1 ORDER BY visit_number, dart_number`,
        [gameId],
      );
      return result.rows.map((row) => ({
        playerId: row.player_id,
        visitNumber: row.visit_number,
        dartNumber: row.dart_number,
        segment: row.segment,
        multiplier: row.multiplier,
        score: row.score,
        bust: row.bust,
      }));
    },
    async addDart(gameId, dart) {
      await pool.query(
        `INSERT INTO darts (game_id, player_id, visit_number, dart_number, segment, multiplier, score, bust)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          gameId,
          dart.playerId,
          dart.visitNumber,
          dart.dartNumber,
          dart.segment,
          dart.multiplier,
          dart.score,
          dart.bust,
        ],
      );
    },
    async removeLastDart(gameId) {
      await pool.query(
        `DELETE FROM darts WHERE id = (
           SELECT id FROM darts WHERE game_id = $1
           ORDER BY visit_number DESC, dart_number DESC LIMIT 1)`,
        [gameId],
      );
    },
    async setWinner(gameId, winnerId) {
      await pool.query(
        `UPDATE games SET winner_player_id = $2::bigint,
           status = CASE WHEN $2::bigint IS NULL THEN 'in_progress' ELSE 'finished' END,
           finished_at = CASE WHEN $2::bigint IS NULL THEN NULL ELSE now() END
         WHERE id = $1`,
        [gameId, winnerId],
      );
    },
    async close() {
      await pool.end();
    },
    async listPlayers() {
      const result = await pool.query<PlayerRow>(
        `SELECT ${PLAYER_COLUMNS} FROM players WHERE NOT archived ORDER BY lower(name)`,
      );
      return result.rows.map(toPlayer);
    },
    getPlayer(id) {
      return run(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [id]);
    },
    async createPlayer(input) {
      const player = await run(
        `INSERT INTO players (name, nickname, photo_path, double_out) VALUES ($1, $2, $3, $4)
         RETURNING ${PLAYER_COLUMNS}`,
        [input.name, input.nickname, input.photoPath, input.doubleOut ?? false],
      );
      if (!player) throw new Error('Insert returned no row');
      return player;
    },
    updatePlayer(id, changes) {
      const keepPhoto = changes.photoPath === undefined;
      return run(
        `UPDATE players SET name = $2, nickname = $3,
           photo_path = CASE WHEN $4 THEN photo_path ELSE $5 END,
           double_out = COALESCE($6, double_out)
         WHERE id = $1 RETURNING ${PLAYER_COLUMNS}`,
        [
          id,
          changes.name,
          changes.nickname,
          keepPhoto,
          changes.photoPath ?? null,
          changes.doubleOut ?? null,
        ],
      );
    },
    archivePlayer(id) {
      return run(`UPDATE players SET archived = true WHERE id = $1 RETURNING ${PLAYER_COLUMNS}`, [
        id,
      ]);
    },
  };
}

/** Arbitrary constant identifying our migrations in PostgreSQL advisory locks. */
const MIGRATION_LOCK_ID = 727_001;

/**
 * Applies every migration not yet recorded in `schema_migrations`, in order.
 * Safe to run at every startup (already-applied migrations are skipped) and
 * from several app instances at once (an advisory lock serialises them).
 * Returns the names of the migrations applied by this call.
 */
export async function migrateDatabase(
  databaseUrl: string,
  list: readonly Migration[] = migrations,
): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           name        text PRIMARY KEY,
           applied_at  timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const done = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
      const doneNames = new Set(done.rows.map((row) => row.name));
      for (const migration of list) {
        if (doneNames.has(migration.name)) continue;
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
        applied.push(migration.name);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } finally {
    await client.end();
  }
  return applied;
}
