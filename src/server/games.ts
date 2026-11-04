import type { FastifyInstance } from 'fastify';
import {
  BATTLE_HIT_POINTS,
  DARTS_PER_VISIT,
  createBattle,
  createGame,
  dartValue,
  formatDart,
  getBattleView,
  getGameView,
  suggestCheckout,
  type BattleState,
  type Dart,
  type GameState,
  type Visit,
} from '../scoring/index.js';
import type { DartRecord, Database, Game } from './db.js';
import { present } from './players.js';

/** Players who must finish on a double: the whole game when it is set so, else those who force it. */
export function doubleOutPlayerIds(game: Game): string[] {
  return game.players.filter((p) => game.doubleOut || p.doubleOut).map((p) => String(p.id));
}

function presentGame(game: Game) {
  return {
    id: game.id,
    type: game.type,
    mode: game.mode,
    doubleOut: game.doubleOut,
    teams: game.teams,
    status: game.status,
    // `doubleOut` of a player is the finish that really applies to them in this game.
    players: game.players.map((p) => ({ ...present(p), doubleOut: game.doubleOut || p.doubleOut })),
  };
}

/** A stored dart as the scoring engine sees it (a miss is sector 0, multiplier 1). */
export function toEngineDart(record: Pick<DartRecord, 'segment' | 'multiplier'>): Dart {
  return record.segment === 0
    ? { sector: 0, multiplier: 1 }
    : { sector: record.segment, multiplier: record.multiplier as 1 | 2 | 3 };
}

export function dartLabel(dart: Dart): string {
  return dart.sector === 0 ? '0' : formatDart(dart);
}

function stateOf(game: Game, records: DartRecord[]): GameState {
  return {
    ...createGame({
      startScore: game.mode,
      players: game.players.map((p) => String(p.id)),
      doubleOutPlayers: doubleOutPlayerIds(game),
    }),
    darts: records.map(toEngineDart),
  };
}

function battleStateOf(game: Game, records: DartRecord[]): BattleState {
  const [one, two] = game.teams ?? [[], []];
  return {
    ...createBattle({
      hitPoints: game.mode,
      teams: [one.map(String), two.map(String)],
    }),
    darts: records.map(toEngineDart),
  };
}

/** What every game type tells the routes: the visits, who plays next and who won. */
function viewOf(game: Game, records: DartRecord[]) {
  if (game.type === 'battle') {
    const view = getBattleView(battleStateOf(game, records));
    return { ...view, visits: view.visits.map((visit) => ({ ...visit, bust: false })) };
  }
  return getGameView(stateOf(game, records));
}

function isComplete(visit: Pick<Visit, 'finished' | 'darts'> & { bust?: boolean }): boolean {
  return visit.bust === true || visit.finished || visit.darts.length === DARTS_PER_VISIT;
}

/** The state of a Bataille game: hit points of both teams, whose turn it is, the winning team. */
function presentBattleState(game: Game, records: DartRecord[]) {
  const view = getBattleView(battleStateOf(game, records));
  const lastVisit = view.visits[view.visits.length - 1];
  const open = lastVisit && !isComplete(lastVisit) ? lastVisit : null;
  const winnerId = view.winner ? Number(view.winner) : null;
  const shownVisit = open ?? (winnerId !== null ? (lastVisit ?? null) : null);
  const lastScores: Record<string, number | null> = {};
  for (const player of game.players) lastScores[player.id] = null;
  for (const visit of view.visits.filter((v) => isComplete(v))) {
    lastScores[visit.player] = visit.scored;
  }
  const [one, two] = game.teams ?? [[], []];
  return {
    ...presentGame(game),
    status:
      game.status === 'abandoned' ? 'abandoned' : winnerId !== null ? 'finished' : 'in_progress',
    teams: [one, two].map((playerIds, index) => ({
      number: index + 1,
      playerIds,
      hitPoints: view.hitPoints[index] as number,
    })),
    round: Math.floor((open ? view.visits.length - 1 : view.visits.length) / 2) + 1,
    currentPlayerId: view.currentPlayer ? Number(view.currentPlayer) : null,
    currentTeam: view.currentTeam === null ? null : view.currentTeam + 1,
    winnerId,
    winnerTeam: view.winnerTeam === null ? null : view.winnerTeam + 1,
    dartsLeft: view.dartsLeft,
    canUndo: records.length > 0,
    currentVisit: shownVisit
      ? {
          playerId: Number(shownVisit.player),
          darts: shownVisit.darts.map((dart) => ({
            label: dartLabel(dart),
            score: dartValue(dart),
          })),
          bust: false,
          scored: shownVisit.scored,
        }
      : null,
    lastScores,
    bust: null,
  };
}

/** The whole state of a game, computed by the scoring engine, as sent to the game page. */
function presentState(game: Game, records: DartRecord[]) {
  if (game.type === 'battle') return presentBattleState(game, records);
  const view = getGameView(stateOf(game, records));
  const playerCount = game.players.length;
  const lastVisit = view.visits[view.visits.length - 1];
  const open = lastVisit && !isComplete(lastVisit) ? lastVisit : null;
  const visitIndex = open ? view.visits.length - 1 : view.visits.length;
  const winnerId = view.winner ? Number(view.winner) : null;
  const currentPlayerId = view.currentPlayer ? Number(view.currentPlayer) : null;

  const shownVisit = open ?? (winnerId !== null ? (lastVisit ?? null) : null);
  const completed = view.visits.filter((visit) => isComplete(visit));
  const lastScores: Record<string, number | null> = {};
  for (const player of game.players) lastScores[player.id] = null;
  for (const visit of completed) lastScores[visit.player] = visit.scored;

  const remaining: Record<string, number> = {};
  for (const [id, value] of Object.entries(view.remaining)) remaining[id] = value;

  const checkout =
    currentPlayerId !== null
      ? suggestCheckout(
          remaining[String(currentPlayerId)] as number,
          view.dartsLeft,
          doubleOutPlayerIds(game).includes(String(currentPlayerId)),
        )
      : null;
  const justBust = !open && lastVisit?.bust ? lastVisit : null;

  return {
    ...presentGame(game),
    // The game was loaded before this dart: the status follows the darts.
    status:
      game.status === 'abandoned' ? 'abandoned' : winnerId !== null ? 'finished' : 'in_progress',
    remaining,
    round: Math.floor(visitIndex / playerCount) + 1,
    currentPlayerId,
    winnerId,
    dartsLeft: view.dartsLeft,
    canUndo: records.length > 0,
    currentVisit: shownVisit
      ? {
          playerId: Number(shownVisit.player),
          darts: shownVisit.darts.map((dart) => ({
            label: dartLabel(dart),
            score: dartValue(dart),
          })),
          bust: shownVisit.bust,
          scored: shownVisit.scored,
        }
      : null,
    lastScores,
    checkout: checkout?.map((dart) => ({
      sector: dart.sector,
      multiplier: dart.multiplier,
      label: formatDart(dart).toUpperCase(),
    })),
    bust: justBust
      ? {
          playerId: Number(justBust.player),
          remaining: remaining[justBust.player] as number,
        }
      : null,
  };
}

/** Where the next dart goes (player, visit number, dart number) for the current state. */
function nextSlot(game: Game, records: DartRecord[]) {
  const view = viewOf(game, records);
  const used = view.winner ? DARTS_PER_VISIT : DARTS_PER_VISIT - view.dartsLeft;
  const last = view.visits[view.visits.length - 1];
  const open = last && !isComplete(last);
  return {
    won: view.winner !== null,
    playerId: Number(view.currentPlayer),
    visitNumber: open ? view.visits.length : view.visits.length + 1,
    dartNumber: open ? used + 1 : 1,
  };
}

/** Saves one dart and updates the game status; returns the new state. */
async function recordDart(db: Database, game: Game, dart: Dart): Promise<DartRecord[]> {
  const records = await db.listDarts(game.id);
  const slot = nextSlot(game, records);
  const record: DartRecord = {
    playerId: slot.playerId,
    visitNumber: slot.visitNumber,
    dartNumber: slot.dartNumber,
    segment: dart.sector,
    multiplier: dart.sector === 0 ? 0 : dart.multiplier,
    score: dartValue(dart),
    bust: false,
  };
  const after = viewOf(game, [...records, record]);
  const visit = after.visits[after.visits.length - 1];
  record.bust = visit?.bust === true && visit.darts.length === slot.dartNumber;
  await db.addDart(game.id, record);
  if (after.winner) await db.setWinner(game.id, Number(after.winner));
  return [...records, record];
}

function parseDart(body: { sector?: unknown; multiplier?: unknown } | undefined): Dart | null {
  const sector = body?.sector;
  const multiplier = body?.multiplier;
  if (sector === 0) return { sector: 0, multiplier: 1 };
  if (typeof sector !== 'number' || typeof multiplier !== 'number') return null;
  if (multiplier !== 1 && multiplier !== 2 && multiplier !== 3) return null;
  if (Number.isInteger(sector) && sector >= 1 && sector <= 20) return { sector, multiplier };
  if (sector === 25 && multiplier !== 3) return { sector, multiplier };
  return null;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

interface CreateBody {
  type?: unknown;
  /** X01 options. */
  mode?: unknown;
  doubleOut?: unknown;
  playerIds?: unknown;
  /** Battle: the player ids of team 1 and of team 2. */
  teams?: unknown;
}

/** Two non-empty lists of distinct player ids, or null. */
function parseTeams(value: unknown): [number[], number[]] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [one, two] = value as unknown[];
  if (!Array.isArray(one) || !Array.isArray(two) || one.length === 0 || two.length === 0) {
    return null;
  }
  const all = [...one, ...two];
  if (!all.every((id) => Number.isSafeInteger(id)) || new Set(all).size !== all.length) {
    return null;
  }
  return [one as number[], two as number[]];
}

export function registerGameRoutes(app: FastifyInstance, db: Database): void {
  app.post<{ Body: CreateBody }>('/api/games', async (request, reply) => {
    const { type = 'x01', mode, doubleOut = false, playerIds, teams } = request.body ?? {};
    if (type === 'battle') {
      if (!(BATTLE_HIT_POINTS as readonly unknown[]).includes(mode)) {
        return reply.code(400).send({ error: 'Choisissez 500, 1000 ou 2000 points de vie.' });
      }
      const parsed = parseTeams(teams);
      if (!parsed) {
        return reply
          .code(400)
          .send({ error: 'Répartissez les joueurs en deux équipes d’au moins un joueur.' });
      }
      for (const id of parsed.flat()) {
        const player = await db.getPlayer(id);
        if (!player || player.archived) {
          return reply.code(400).send({ error: 'Un des joueurs choisis n’est plus disponible.' });
        }
      }
      const game = await db.createGame(mode as 500 | 1000 | 2000, parsed.flat(), {
        teams: parsed,
      });
      return reply.code(201).send(presentGame(game));
    }
    if (type !== 'x01') {
      return reply.code(400).send({ error: 'Type de partie inconnu.' });
    }
    if (mode !== 301 && mode !== 501 && mode !== 701) {
      return reply.code(400).send({ error: 'Choisissez 301, 501 ou 701.' });
    }
    if (typeof doubleOut !== 'boolean') {
      return reply.code(400).send({ error: 'Choisissez simple out ou double out.' });
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
    const game = await db.createGame(mode, ids, { doubleOut });
    return reply.code(201).send(presentGame(game));
  });

  async function load(idParam: string) {
    const id = Number(idParam);
    const game = Number.isSafeInteger(id) ? await db.getGame(id) : null;
    return game;
  }

  const ABANDONED = { error: 'La partie a été abandonnée.' };

  // The game to offer on opening the app: "Reprendre la partie" or "Abandonner".
  app.get('/api/games/unfinished', async () => {
    const game = await db.getUnfinishedGame();
    return { game: game ? presentState(game, await db.listDarts(game.id)) : null };
  });

  app.post<{ Params: { id: string } }>('/api/games/:id/abandon', async (request, reply) => {
    const game = await load(request.params.id);
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    const records = await db.listDarts(game.id);
    if (game.status === 'finished' || nextSlot(game, records).won) {
      return reply.code(409).send({ error: 'La partie est terminée.' });
    }
    await db.abandonGame(game.id);
    return presentState({ ...game, status: 'abandoned' }, records);
  });

  app.get<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    const game = await load(request.params.id);
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    return presentState(game, await db.listDarts(game.id));
  });

  app.post<{ Params: { id: string }; Body: { sector?: unknown; multiplier?: unknown } }>(
    '/api/games/:id/darts',
    async (request, reply) => {
      const game = await load(request.params.id);
      if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
      const dart = parseDart(request.body);
      if (!dart) return reply.code(400).send({ error: 'Fléchette invalide.' });
      if (game.status === 'abandoned') return reply.code(409).send(ABANDONED);
      if (nextSlot(game, await db.listDarts(game.id)).won) {
        return reply.code(409).send({ error: 'La partie est terminée.' });
      }
      return presentState(game, await recordDart(db, game, dart));
    },
  );

  // "Joueur suivant": the darts left in the visit are recorded as misses.
  app.post<{ Params: { id: string } }>('/api/games/:id/next', async (request, reply) => {
    const game = await load(request.params.id);
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    if (game.status === 'abandoned') return reply.code(409).send(ABANDONED);
    let records = await db.listDarts(game.id);
    if (nextSlot(game, records).won) {
      return reply.code(409).send({ error: 'La partie est terminée.' });
    }
    const left = viewOf(game, records).dartsLeft;
    for (let i = 0; i < left; i++) {
      records = await recordDart(db, game, { sector: 0, multiplier: 1 });
    }
    return presentState(game, records);
  });

  // Undo: removes the last dart, across visits.
  app.delete<{ Params: { id: string } }>('/api/games/:id/darts/last', async (request, reply) => {
    const game = await load(request.params.id);
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    if (game.status === 'abandoned') return reply.code(409).send(ABANDONED);
    const records = await db.listDarts(game.id);
    if (records.length === 0) return presentState(game, records);
    await db.removeLastDart(game.id);
    const remaining = records.slice(0, -1);
    if (viewOf(game, records).winner) await db.setWinner(game.id, null);
    return presentState(game, remaining);
  });

  // "Rejouer": same players and mode, new random order.
  app.post<{ Params: { id: string } }>('/api/games/:id/rematch', async (request, reply) => {
    const game = await load(request.params.id);
    if (!game) return reply.code(404).send({ error: 'Partie introuvable.' });
    // A Bataille rematch keeps the teams and shuffles the order inside each team.
    const next = game.teams
      ? await db.createGame(game.mode, game.teams.flat(), {
          teams: [shuffled(game.teams[0]), shuffled(game.teams[1])],
        })
      : await db.createGame(game.mode, shuffled(game.players.map((player) => player.id)), {
          doubleOut: game.doubleOut,
        });
    return reply.code(201).send(presentGame(next));
  });
}
