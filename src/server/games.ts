import type { FastifyInstance } from 'fastify';
import type { Database, Game } from './db.js';
import { present } from './players.js';

function presentGame(game: Game) {
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    players: game.players.map(present),
  };
}

interface CreateBody {
  mode?: unknown;
  playerIds?: unknown;
}

export function registerGameRoutes(app: FastifyInstance, db: Database): void {
  app.post<{ Body: CreateBody }>('/api/games', async (request, reply) => {
    const { mode, playerIds } = request.body ?? {};
    if (mode !== 301 && mode !== 501) {
      return reply.code(400).send({ error: 'Choisissez 301 ou 501.' });
    }
    if (
      !Array.isArray(playerIds) ||
      playerIds.length === 0 ||
      !playerIds.every((id) => Number.isSafeInteger(id)) ||
      new Set(playerIds).size !== playerIds.length
    ) {
      return reply.code(400).send({ error: 'Sélectionnez au moins un joueur.' });
    }
    const ids = playerIds as number[];
    for (const id of ids) {
      const player = await db.getPlayer(id);
      if (!player || player.archived) {
        return reply.code(400).send({ error: 'Un des joueurs choisis n’est plus disponible.' });
      }
    }
    const game = await db.createGame(mode, ids);
    return reply.code(201).send(presentGame(game));
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const game = Number.isSafeInteger(id) ? await db.getGame(id) : null;
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    return presentGame(game);
  });
}
