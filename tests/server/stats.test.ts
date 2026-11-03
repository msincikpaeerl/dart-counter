import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { createMemoryDb } from './memory-db.js';

type Throw = [segment: number, multiplier: number];

describe('statistics and history API', () => {
  let uploadDir: string;
  let app: FastifyInstance;
  let db: ReturnType<typeof createMemoryDb>;
  let alice: number;
  let bob: number;
  let cleo: number;

  /** Records the darts of a game, three per visit, alternating between the two players. */
  async function play(gameId: number, order: number[], throws: Throw[]) {
    for (const [index, [segment, multiplier]] of throws.entries()) {
      const visit = Math.floor(index / 3);
      await db.addDart(gameId, {
        playerId: order[visit % order.length] as number,
        visitNumber: visit + 1,
        dartNumber: (index % 3) + 1,
        segment,
        multiplier: segment === 0 ? 0 : multiplier,
        score: segment * multiplier,
        bust: false,
      });
    }
  }

  /** 301: Alice 180 then checks out 121 with T20 T19 D2; Bob throws 3 × 20. */
  async function finishedGame() {
    const game = await db.createGame(301, [alice, bob]);
    await play(
      game.id,
      [alice, bob],
      [
        [20, 3],
        [20, 3],
        [20, 3],
        [20, 1],
        [20, 1],
        [20, 1],
        [20, 3],
        [19, 3],
        [2, 2],
      ],
    );
    await db.setWinner(game.id, alice);
    return game;
  }

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'dart-uploads-'));
    db = createMemoryDb();
    app = await buildApp({ db, uploadDir });
    const make = async (name: string) =>
      (await db.createPlayer({ name, nickname: null, photoPath: null })).id;
    alice = await make('Alice');
    bob = await make('Bob');
    cleo = await make('Cléo');
  });

  afterEach(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('serves the page', async () => {
    const response = await app.inject({ method: 'GET', url: '/statistiques' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('computes one player’s statistics from finished games', async () => {
    await finishedGame();
    const response = await app.inject({ method: 'GET', url: `/api/stats/players/${alice}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().stats).toEqual({
      gamesPlayed: 1,
      gamesWon: 1,
      winPercent: 100,
      threeDartAverage: 150.5, // 301 points over 6 darts
      bestVisit: 180,
      count180: 1,
      visits100Plus: 2,
      highestCheckout: 121,
    });
    const bobStats = (await app.inject({ method: 'GET', url: `/api/stats/players/${bob}` })).json();
    expect(bobStats.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 0, winPercent: 0 });
    expect(bobStats.stats.threeDartAverage).toBe(60);
    expect(bobStats.stats.highestCheckout).toBeNull();
  });

  it('excludes abandoned and unfinished games from statistics and history', async () => {
    await finishedGame();
    const abandoned = await db.createGame(501, [alice, cleo]);
    await play(
      abandoned.id,
      [alice, cleo],
      [
        [20, 3],
        [20, 3],
        [20, 3],
      ],
    );
    await db.abandonGame(abandoned.id);
    const running = await db.createGame(501, [alice, cleo]);
    await play(
      running.id,
      [alice, cleo],
      [
        [20, 3],
        [20, 3],
        [20, 3],
      ],
    );

    const stats = (await app.inject({ method: 'GET', url: `/api/stats/players/${alice}` })).json();
    expect(stats.stats.gamesPlayed).toBe(1);
    expect(stats.stats.count180).toBe(1);

    const history = (await app.inject({ method: 'GET', url: '/api/history' })).json();
    expect(history).toHaveLength(1);
    const list = (await app.inject({ method: 'GET', url: '/api/stats/players' })).json();
    expect(list.map((entry: { player: { name: string } }) => entry.player.name)).toEqual([
      'Alice',
      'Bob',
    ]);
    for (const id of [abandoned.id, running.id]) {
      const detail = await app.inject({ method: 'GET', url: `/api/history/${id}` });
      expect(detail.statusCode).toBe(404);
    }
  });

  it('lists finished games with date, mode, players and winner', async () => {
    const game = await finishedGame();
    const history = (await app.inject({ method: 'GET', url: '/api/history' })).json();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: game.id, mode: 301 });
    expect(Number.isNaN(Date.parse(history[0].finishedAt))).toBe(false);
    expect(history[0].players.map((p: { name: string }) => p.name)).toEqual(['Alice', 'Bob']);
    expect(history[0].winner.name).toBe('Alice');
  });

  it('filters the history by player', async () => {
    await finishedGame();
    const other = await db.createGame(301, [bob, cleo]);
    await play(other.id, [bob, cleo], [[20, 1]]);
    await db.setWinner(other.id, cleo);
    const history = (
      await app.inject({ method: 'GET', url: `/api/history?playerId=${cleo}` })
    ).json();
    expect(history.map((g: { id: number }) => g.id)).toEqual([other.id]);
  });

  it('shows each visit of a finished game', async () => {
    const game = await finishedGame();
    const detail = (await app.inject({ method: 'GET', url: `/api/history/${game.id}` })).json();
    expect(detail.visits).toHaveLength(3);
    expect(detail.visits[0]).toMatchObject({
      playerId: alice,
      scored: 180,
      bust: false,
      remaining: 121,
    });
    expect(detail.visits[0].darts.map((d: { label: string }) => d.label)).toEqual([
      'T20',
      'T20',
      'T20',
    ]);
    expect(detail.visits[1]).toMatchObject({ playerId: bob, scored: 60, remaining: 241 });
    expect(detail.visits[2]).toMatchObject({
      playerId: alice,
      scored: 121,
      finished: true,
      remaining: 0,
    });
  });

  it('keeps the history and statistics of archived players', async () => {
    const game = await finishedGame();
    await app.inject({ method: 'POST', url: `/api/players/${alice}/archive` });

    const stats = (await app.inject({ method: 'GET', url: `/api/stats/players/${alice}` })).json();
    expect(stats.player.archived).toBe(true);
    expect(stats.stats.gamesWon).toBe(1);
    const list = (await app.inject({ method: 'GET', url: '/api/stats/players' })).json();
    expect(list.map((e: { player: { name: string } }) => e.player.name)).toContain('Alice');
    const detail = (await app.inject({ method: 'GET', url: `/api/history/${game.id}` })).json();
    expect(detail.winner.name).toBe('Alice');
    const history = (
      await app.inject({ method: 'GET', url: `/api/history?playerId=${alice}` })
    ).json();
    expect(history).toHaveLength(1);
  });

  it('answers 404 for an unknown player or game', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/stats/players/999' })).statusCode).toBe(
      404,
    );
    expect((await app.inject({ method: 'GET', url: '/api/history/999' })).statusCode).toBe(404);
  });
});
