import { describe, expect, it } from 'vitest';
import { computePlayerStats, type Dart, type FinishedGameInput } from '../../src/scoring/index.js';

const T = (sector: number): Dart => ({ sector, multiplier: 3 });
const D = (sector: number): Dart => ({ sector, multiplier: 2 });
const S = (sector: number): Dart => ({ sector, multiplier: 1 });
const MISS: Dart = { sector: 0, multiplier: 1 };

/** One player, 301: 180, a bust after two darts, then a 121 checkout. */
const soloGame: FinishedGameInput = {
  startScore: 301,
  players: ['1'],
  doubleOutPlayers: ['1'],
  darts: [
    // 180: 121 left.
    T(20),
    T(20),
    T(20),
    // T20 leaves 61, the second T20 leaves 1: a bust after two darts.
    T(20),
    T(20),
    // T20 T19 D2 checks out 121.
    T(20),
    T(19),
    D(2),
  ],
  winner: '1',
};

describe('computePlayerStats', () => {
  it('counts bust darts with 0 points in the 3-dart average', () => {
    const stats = computePlayerStats('1', [soloGame]);
    // 180 + 0 (bust, 2 darts) + 121 = 301 points over 8 darts.
    expect(stats.threeDartAverage).toBe(112.9);
  });

  it('reports best visit, 180s, 100+ visits and highest checkout', () => {
    const stats = computePlayerStats('1', [soloGame]);
    expect(stats.bestVisit).toBe(180);
    expect(stats.count180).toBe(1);
    expect(stats.visits100Plus).toBe(2);
    expect(stats.highestCheckout).toBe(121);
  });

  it('counts games played, won and the win percentage', () => {
    const lost: FinishedGameInput = {
      startScore: 301,
      players: ['1', '2'],
      // Player 1 misses three times, player 2 scores 80.
      darts: [MISS, MISS, MISS, T(20), S(20), MISS],
      winner: '2',
    };
    const stats = computePlayerStats('1', [soloGame, lost, { ...lost, winner: '2' }]);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(1);
    expect(stats.winPercent).toBe(33.3);
  });

  it('ignores games the player did not play', () => {
    const stats = computePlayerStats('9', [soloGame]);
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.winPercent).toBe(0);
    expect(stats.threeDartAverage).toBeNull();
    expect(stats.highestCheckout).toBeNull();
    expect(stats.bestVisit).toBe(0);
  });

  it('has no checkout for a player who never won', () => {
    const lost: FinishedGameInput = {
      startScore: 301,
      players: ['1', '2'],
      darts: [S(20), S(20), S(20)],
      winner: '2',
    };
    const stats = computePlayerStats('1', [lost]);
    expect(stats.highestCheckout).toBeNull();
    expect(stats.threeDartAverage).toBe(60);
  });
});
