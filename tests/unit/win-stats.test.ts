import { describe, expect, it } from 'vitest';
import { computeWinStats } from '../../src/scoring/index.js';

describe('computeWinStats', () => {
  const games = [
    { players: ['1', '2'], winners: ['1'] },
    { players: ['1', '2', '3'], winners: ['2', '3'] },
    { players: ['2', '3'], winners: ['3'] },
  ];

  it('counts games played and won, with the win percentage', () => {
    expect(computeWinStats('1', games)).toEqual({ gamesPlayed: 2, gamesWon: 1, winPercent: 50 });
    expect(computeWinStats('2', games)).toEqual({ gamesPlayed: 3, gamesWon: 1, winPercent: 33.3 });
  });

  it('gives every member of a winning team the win', () => {
    expect(computeWinStats('3', games).gamesWon).toBe(2);
  });

  it('is empty for a player without any game', () => {
    expect(computeWinStats('9', games)).toEqual({ gamesPlayed: 0, gamesWon: 0, winPercent: 0 });
  });
});
