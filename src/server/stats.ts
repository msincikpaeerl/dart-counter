import type { FastifyInstance } from 'fastify';
import {
  computePlayerStats,
  computeWinStats,
  dartValue,
  getGameView,
  type FinishedGameInput,
  type FinishedResultInput,
  type PlayerStats,
  type WinStats,
} from '../scoring/index.js';
import type { Database, DartRecord, FinishedGame, Game, Player } from './db.js';
import { dartLabel, doubleOutPlayerIds, toEngineDart } from './games.js';
import { present } from './players.js';

type GameType = Game['type'];
const TYPES: readonly GameType[] = ['x01', 'around_the_world', 'battle'];

const LEVEL_LABELS = { beginner: 'Débutant', pro: 'Professionnel' } as const;
const TYPE_LABELS: Record<GameType, string> = {
  x01: 'X01',
  around_the_world: 'Tour du monde',
  battle: 'Bataille',
};

function parseType(value: string | undefined): GameType | null | 'invalid' {
  if (value === undefined || value === '') return null;
  return (TYPES as readonly string[]).includes(value) ? (value as GameType) : 'invalid';
}

/** Only finished games are ever read here: abandoned and unfinished ones are left out. */
async function listFinished(db: Database, type: GameType | null): Promise<FinishedGame[]> {
  const games = await db.listFinishedGames();
  return type === null ? games : games.filter((game) => game.type === type);
}

/**
 * The options of a game, e.g. "501 · Double out", "Débutant", "500 points de vie".
 * For X01 with a player given, the finish is the one that player had to make.
 */
function optionsOf(game: Game, playerId?: number): string {
  if (game.type === 'around_the_world') return LEVEL_LABELS[game.level ?? 'beginner'];
  if (game.type === 'battle') return `${game.mode ?? 500} points de vie`;
  const double =
    playerId === undefined ? game.doubleOut : doubleOutPlayerIds(game).includes(String(playerId));
  return `${game.mode ?? 501} · ${double ? 'Double out' : 'Simple out'}`;
}

/** One group of statistics = one type and one combination of options. */
function groupOf(game: Game, playerId: number) {
  const options = optionsOf(game, playerId);
  return {
    key: `${game.type}|${options}`,
    type: game.type,
    typeLabel: TYPE_LABELS[game.type],
    options,
    label: `${TYPE_LABELS[game.type]} · ${options}`,
  };
}

function x01Input(game: FinishedGame, records: DartRecord[]): FinishedGameInput {
  return {
    startScore: game.mode ?? 501,
    players: game.players.map((p) => String(p.id)),
    doubleOutPlayers: doubleOutPlayerIds(game),
    darts: records.map(toEngineDart),
    winner: game.winnerId === null ? null : String(game.winnerId),
  };
}

/** Everybody on the winning side: the winner, plus the teammates for Bataille. */
function resultOf(game: FinishedGame): FinishedResultInput {
  const winnerId = game.winnerId;
  const team = game.teams?.find((ids) => winnerId !== null && ids.includes(winnerId));
  const winners = team ?? (winnerId === null ? [] : [winnerId]);
  return { players: game.players.map((p) => String(p.id)), winners: winners.map(String) };
}

function presentPlayer(player: Player) {
  return { ...present(player), archived: player.archived };
}

function presentHistoryItem(game: FinishedGame) {
  const winner = game.players.find((p) => p.id === game.winnerId) ?? null;
  const winnerTeamIndex = (game.teams ?? []).findIndex(
    (ids) => game.winnerId !== null && ids.includes(game.winnerId),
  );
  return {
    id: game.id,
    type: game.type,
    typeLabel: TYPE_LABELS[game.type],
    options: optionsOf(game),
    mode: game.mode,
    level: game.level,
    doubleOut: game.doubleOut,
    finishedAt: game.finishedAt,
    players: game.players.map(presentPlayer),
    winner: winner ? presentPlayer(winner) : null,
    winnerTeam: winnerTeamIndex < 0 ? null : winnerTeamIndex + 1,
  };
}

type Group = ReturnType<typeof groupOf> & { stats: WinStats | PlayerStats };

/** The statistics of one player, one group per type and combination of options. */
async function statsGroups(
  db: Database,
  games: FinishedGame[],
  playerId: number,
): Promise<Group[]> {
  const buckets = new Map<string, { group: ReturnType<typeof groupOf>; games: FinishedGame[] }>();
  for (const game of games) {
    if (!game.players.some((p) => p.id === playerId)) continue;
    const group = groupOf(game, playerId);
    const bucket = buckets.get(group.key) ?? { group, games: [] };
    bucket.games.push(game);
    buckets.set(group.key, bucket);
  }
  const groups: Group[] = [];
  for (const { group, games: inGroup } of buckets.values()) {
    const id = String(playerId);
    let stats: WinStats | PlayerStats;
    if (group.type === 'x01') {
      const inputs: FinishedGameInput[] = [];
      for (const game of inGroup) inputs.push(x01Input(game, await db.listDarts(game.id)));
      stats = computePlayerStats(id, inputs);
    } else {
      stats = computeWinStats(id, inGroup.map(resultOf));
    }
    groups.push({ ...group, stats });
  }
  return groups.sort(
    (a, b) =>
      TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.options.localeCompare(b.options, 'fr'),
  );
}

const UNKNOWN_TYPE = { error: 'Type de partie inconnu.' };

export function registerStatsRoutes(app: FastifyInstance, db: Database): void {
  // Every player with at least one finished game (of the given type), archived ones included.
  app.get<{ Querystring: { type?: string } }>('/api/stats/players', async (request, reply) => {
    const type = parseType(request.query.type);
    if (type === 'invalid') return reply.code(400).send(UNKNOWN_TYPE);
    const players = new Map<number, Player>();
    const counts = new Map<number, number>();
    for (const game of await listFinished(db, type)) {
      for (const p of game.players) {
        players.set(p.id, p);
        counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      }
    }
    return [...players.values()]
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((player) => ({
        player: presentPlayer(player),
        gamesPlayed: counts.get(player.id) ?? 0,
      }));
  });

  // Statistics of one player, split by type and by combination of options.
  app.get<{ Params: { id: string }; Querystring: { type?: string } }>(
    '/api/stats/players/:id',
    async (request, reply) => {
      const id = Number(request.params.id);
      const player = Number.isSafeInteger(id) ? await db.getPlayer(id) : null;
      if (!player) return reply.code(404).send({ error: 'Joueur introuvable.' });
      const type = parseType(request.query.type);
      if (type === 'invalid') return reply.code(400).send(UNKNOWN_TYPE);
      return {
        player: presentPlayer(player),
        groups: await statsGroups(db, await listFinished(db, type), id),
      };
    },
  );

  app.get<{ Querystring: { playerId?: string; type?: string } }>(
    '/api/history',
    async (request, reply) => {
      const filter = request.query.playerId === undefined ? null : Number(request.query.playerId);
      const type = parseType(request.query.type);
      if (type === 'invalid') return reply.code(400).send(UNKNOWN_TYPE);
      const games = await listFinished(db, type);
      return games
        .filter((game) => filter === null || game.players.some((p) => p.id === filter))
        .map(presentHistoryItem);
    },
  );

  app.get<{ Params: { id: string } }>('/api/history/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const game = Number.isSafeInteger(id)
      ? (await listFinished(db, null)).find((g) => g.id === id)
      : undefined;
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    // The visit by visit detail only exists for X01.
    if (game.type !== 'x01') return { ...presentHistoryItem(game), visits: [] };
    const startScore = game.mode ?? 501;
    const records = await db.listDarts(game.id);
    const view = getGameView({
      config: {
        startScore,
        players: game.players.map((p) => String(p.id)),
        doubleOutPlayers: doubleOutPlayerIds(game),
      },
      darts: records.map(toEngineDart),
    });
    const remaining: Record<string, number> = {};
    for (const p of game.players) remaining[p.id] = startScore;
    const visits = view.visits.map((visit, index) => {
      remaining[visit.player] = (remaining[visit.player] as number) - visit.scored;
      return {
        number: index + 1,
        round: Math.floor(index / game.players.length) + 1,
        playerId: Number(visit.player),
        darts: visit.darts.map((dart) => ({ label: dartLabel(dart), score: dartValue(dart) })),
        scored: visit.scored,
        bust: visit.bust,
        finished: visit.finished,
        remaining: remaining[visit.player] as number,
      };
    });
    return { ...presentHistoryItem(game), visits };
  });
}
