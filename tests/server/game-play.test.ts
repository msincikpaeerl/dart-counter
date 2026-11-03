import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import type { Database } from '../../src/server/db.js';
import { createMemoryDb } from './memory-db.js';

interface State {
  id: number;
  mode: number;
  status: string;
  players: { id: number }[];
  remaining: Record<string, number>;
  round: number;
  currentPlayerId: number | null;
  winnerId: number | null;
  dartsLeft: number;
  canUndo: boolean;
  currentVisit: {
    playerId: number;
    darts: { label: string; score: number }[];
    scored: number;
  } | null;
  lastScores: Record<string, number | null>;
  checkout?: { label: string }[];
  bust: { playerId: number; remaining: number } | null;
}

describe('game play API', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: Database;
  let a: number;
  let b: number;
  let gameId: number;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    a = (await db.createPlayer({ name: 'Léa', nickname: null, photoPath: null })).id;
    b = (await db.createPlayer({ name: 'Max', nickname: null, photoPath: null })).id;
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: { mode: 301, playerIds: [a, b] },
    });
    gameId = created.json<{ id: number }>().id;
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  const dart = async (sector: number, multiplier: number) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/darts`,
      payload: { sector, multiplier },
    });
    return { status: response.statusCode, state: response.json<State>() };
  };
  const next = async () =>
    (await app.inject({ method: 'POST', url: `/api/games/${gameId}/next` })).json<State>();
  const undo = async () =>
    (await app.inject({ method: 'DELETE', url: `/api/games/${gameId}/darts/last` })).json<State>();
  const get = async () =>
    (await app.inject({ method: 'GET', url: `/api/games/${gameId}` })).json<State>();

  it('starts with full scores and the first player to throw', async () => {
    const state = await get();
    expect(state.remaining).toEqual({ [a]: 301, [b]: 301 });
    expect(state.currentPlayerId).toBe(a);
    expect(state.round).toBe(1);
    expect(state.canUndo).toBe(false);
  });

  it('records a dart with the right score and stores it at once', async () => {
    const { state } = await dart(20, 3);
    expect(state.remaining[a]).toBe(241);
    expect(state.currentVisit?.darts).toEqual([{ label: 'T20', score: 60 }]);
    expect(state.dartsLeft).toBe(2);
    expect(await db.listDarts(gameId)).toEqual([
      {
        playerId: a,
        visitNumber: 1,
        dartNumber: 1,
        segment: 20,
        multiplier: 3,
        score: 60,
        bust: false,
      },
    ]);
    // Reloading the page gives the same state.
    expect((await get()).remaining[a]).toBe(241);
  });

  it('scores the 25 and the bull', async () => {
    expect((await dart(25, 1)).state.remaining[a]).toBe(276);
    expect((await dart(25, 2)).state.remaining[a]).toBe(226);
  });

  it('records a miss as a stored dart worth 0', async () => {
    const { state } = await dart(0, 0);
    expect(state.remaining[a]).toBe(301);
    expect(state.currentVisit?.darts).toEqual([{ label: '0', score: 0 }]);
    const [stored] = await db.listDarts(gameId);
    expect(stored).toMatchObject({ segment: 0, multiplier: 0, score: 0 });
  });

  it('passes the turn after three darts', async () => {
    await dart(20, 1);
    await dart(20, 1);
    const { state } = await dart(20, 1);
    expect(state.remaining[a]).toBe(241);
    expect(state.currentPlayerId).toBe(b);
    expect(state.lastScores[a]).toBe(60);
    expect(state.currentVisit).toBeNull();
    const darts = await db.listDarts(gameId);
    expect(darts.map((d) => [d.visitNumber, d.dartNumber])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it('"Joueur suivant" ends the visit early with misses', async () => {
    await dart(20, 3);
    const state = await next();
    expect(state.remaining[a]).toBe(241);
    expect(state.currentPlayerId).toBe(b);
    expect(state.lastScores[a]).toBe(60);
    expect(await db.listDarts(gameId)).toHaveLength(3);
  });

  it('counts the rounds', async () => {
    await next();
    expect((await get()).round).toBe(1);
    await next();
    expect((await get()).round).toBe(2);
  });

  it('busts: the visit scores 0 and play passes to the next player', async () => {
    await dart(20, 3);
    await dart(20, 3);
    await dart(20, 3); // 121 left
    await next(); // Max passes
    await dart(20, 3); // 61
    const { state } = await dart(20, 3); // 1 left: bust
    expect(state.remaining[a]).toBe(121);
    expect(state.currentPlayerId).toBe(b);
    expect(state.bust).toEqual({ playerId: a, remaining: 121 });
    expect(state.lastScores[a]).toBe(0);
    const darts = await db.listDarts(gameId);
    expect(darts[darts.length - 1]?.bust).toBe(true);
    // The message goes away with the next dart.
    expect((await dart(1, 1)).state.bust).toBeNull();
  });

  it('undoes darts one by one, across visits and busts', async () => {
    await dart(20, 3);
    await dart(20, 3);
    await dart(20, 3);
    await next();
    await dart(20, 3);
    await dart(20, 3); // bust
    expect((await get()).bust).not.toBeNull();

    let state = await undo(); // removes the bust dart
    expect(state.bust).toBeNull();
    expect(state.remaining[a]).toBe(61);
    expect(state.currentPlayerId).toBe(a);

    state = await undo();
    expect(state.remaining[a]).toBe(121);
    state = await undo(); // removes Max's last miss, back to Max's visit
    expect(state.currentPlayerId).toBe(b);
    expect(state.dartsLeft).toBe(1);
    await undo();
    state = await undo(); // Max's visit is empty again
    expect(state.currentPlayerId).toBe(b);
    expect(state.dartsLeft).toBe(3);
    state = await undo(); // back to Léa's third dart
    expect(state.currentPlayerId).toBe(a);
    expect(state.remaining[a]).toBe(181);
    expect(state.dartsLeft).toBe(1);
    await undo();
    state = await undo();
    expect(state.remaining[a]).toBe(301);
    expect(state.dartsLeft).toBe(3);
    expect(state.currentPlayerId).toBe(a);
    expect(state.canUndo).toBe(false);
    expect((await undo()).remaining[a]).toBe(301);
    expect(await db.listDarts(gameId)).toEqual([]);
  });

  it('ends the game on a double, stores the winner and refuses more darts', async () => {
    await dart(20, 3);
    await dart(20, 3);
    await dart(20, 3);
    await next();
    await dart(20, 3);
    await dart(11, 3);
    const { state } = await dart(14, 2);
    expect(state.winnerId).toBe(a);
    expect(state.remaining[a]).toBe(0);
    expect(state.status).toBe('finished');
    expect((await dart(20, 1)).status).toBe(409);
    expect(
      (await app.inject({ method: 'POST', url: `/api/games/${gameId}/next` })).statusCode,
    ).toBe(409);

    const undone = await undo();
    expect(undone.winnerId).toBeNull();
    expect(undone.status).toBe('in_progress');
    expect(undone.remaining[a]).toBe(28);
  });

  it('busts when the score reaches 0 without a double', async () => {
    await dart(20, 3);
    await dart(20, 3);
    await dart(20, 3);
    await next();
    await dart(20, 3); // 61
    await dart(11, 3); // 28
    await dart(0, 0);
    await next(); // Max passes
    await dart(14, 1); // 14
    const { state } = await dart(14, 1); // 0 on a single: bust
    expect(state.winnerId).toBeNull();
    expect(state.bust).toEqual({ playerId: a, remaining: 28 });
    expect(state.currentPlayerId).toBe(b);
  });

  it('suggests a checkout for the current player', async () => {
    await dart(20, 3);
    await dart(20, 3);
    await dart(20, 3);
    await next();
    const { state } = await dart(20, 3); // 61, two darts left
    expect(state.checkout?.length).toBeGreaterThan(0);
  });

  it('refuses invalid darts', async () => {
    expect((await dart(25, 3)).status).toBe(400);
    expect((await dart(21, 1)).status).toBe(400);
    expect((await dart(5, 4)).status).toBe(400);
    expect((await dart(5, 0)).status).toBe(400);
  });

  it('answers 404 for an unknown game', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/games/99/darts',
          payload: { sector: 1, multiplier: 1 },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: '/api/games/99/darts/last' })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/games/99/rematch' })).statusCode).toBe(
      404,
    );
  });

  it('"Rejouer" creates a new game with the same players and mode', async () => {
    const response = await app.inject({ method: 'POST', url: `/api/games/${gameId}/rematch` });
    expect(response.statusCode).toBe(201);
    const game = response.json<State>();
    expect(game.id).not.toBe(gameId);
    expect(game.mode).toBe(301);
    expect(game.players.map((p) => p.id).sort()).toEqual([a, b].sort());
    const fresh = await app.inject({ method: 'GET', url: `/api/games/${game.id}` });
    expect(fresh.json<State>().remaining[a]).toBe(301);
  });

  it('serves the game page with the board and the buttons', async () => {
    const page = await app.inject({ method: 'GET', url: '/partie/1' });
    expect(page.body).toContain('Raté · 0');
    expect(page.body).toContain('Joueur suivant');
    expect(page.body).toContain('Rejouer');
    expect(page.body).toContain('Annuler');
  });
});
