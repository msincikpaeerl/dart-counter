import type { FastifyInstance } from 'fastify';
import {
  computePlayerStats,
  dartValue,
  getGameView,
  type FinishedGameInput,
} from '../scoring/index.js';
import type { Database, FinishedGame, Player } from './db.js';
import { dartLabel, toEngineDart } from './games.js';
import { present } from './players.js';

/** Only finished games are ever read here: abandoned and unfinished ones are left out. */
async function loadFinished(db: Database) {
  const games = await db.listFinishedGames();
  const inputs = new Map<number, FinishedGameInput>();
  for (const game of games) {
    const records = await db.listDarts(game.id);
    inputs.set(game.id, {
      startScore: game.mode,
      players: game.players.map((p) => String(p.id)),
      darts: records.map(toEngineDart),
      winner: game.winnerId === null ? null : String(game.winnerId),
    });
  }
  return { games, inputs };
}

function presentPlayer(player: Player) {
  return { ...present(player), archived: player.archived };
}

function presentHistoryItem(game: FinishedGame) {
  const winner = game.players.find((p) => p.id === game.winnerId) ?? null;
  return {
    id: game.id,
    mode: game.mode,
    finishedAt: game.finishedAt,
    players: game.players.map(presentPlayer),
    winner: winner ? presentPlayer(winner) : null,
  };
}

export function registerStatsRoutes(app: FastifyInstance, db: Database): void {
  // Every player with at least one finished game, archived ones included.
  app.get('/api/stats/players', async () => {
    const { games, inputs } = await loadFinished(db);
    const players = new Map<number, Player>();
    for (const game of games) for (const p of game.players) players.set(p.id, p);
    const all = [...inputs.values()];
    return [...players.values()]
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((player) => ({
        player: presentPlayer(player),
        stats: computePlayerStats(String(player.id), all),
      }));
  });

  app.get<{ Params: { id: string } }>('/api/stats/players/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const player = Number.isSafeInteger(id) ? await db.getPlayer(id) : null;
    if (!player) return reply.code(404).send({ error: 'Joueur introuvable.' });
    const { inputs } = await loadFinished(db);
    return {
      player: presentPlayer(player),
      stats: computePlayerStats(String(id), [...inputs.values()]),
    };
  });

  app.get<{ Querystring: { playerId?: string } }>('/api/history', async (request) => {
    const filter = request.query.playerId === undefined ? null : Number(request.query.playerId);
    const games = await db.listFinishedGames();
    return games
      .filter((game) => filter === null || game.players.some((p) => p.id === filter))
      .map(presentHistoryItem);
  });

  app.get<{ Params: { id: string } }>('/api/history/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const game = Number.isSafeInteger(id)
      ? (await db.listFinishedGames()).find((g) => g.id === id)
      : undefined;
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    const records = await db.listDarts(game.id);
    const view = getGameView({
      config: { startScore: game.mode, players: game.players.map((p) => String(p.id)) },
      darts: records.map(toEngineDart),
    });
    const remaining: Record<string, number> = {};
    for (const p of game.players) remaining[p.id] = game.mode;
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
