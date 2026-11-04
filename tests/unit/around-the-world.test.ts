import { describe, expect, it } from 'vitest';
import {
  aroundTheWorldTargets,
  getAroundTheWorldView,
  type AroundTheWorldLevel,
  type Dart,
} from '../../src/scoring/index.js';

const d = (sector: number, multiplier: 1 | 2 | 3 = 1): Dart => ({ sector, multiplier });
const miss = d(0);
const view = (level: AroundTheWorldLevel, darts: Dart[], players = ['A', 'B']) =>
  getAroundTheWorldView({ config: { level, players }, darts });

describe('around the world targets', () => {
  it('beginner: 1 to 20 then the bull', () => {
    const labels = aroundTheWorldTargets('beginner').map((t) => t.label);
    expect(labels).toHaveLength(21);
    expect(labels.slice(0, 3)).toEqual(['1', '2', '3']);
    expect(labels.at(-2)).toBe('20');
    expect(labels.at(-1)).toBe('Bull');
  });

  it('pro: S1, D1, T1 ... S20, D20, T20', () => {
    const labels = aroundTheWorldTargets('pro').map((t) => t.label);
    expect(labels).toHaveLength(60);
    expect(labels.slice(0, 4)).toEqual(['S1', 'D1', 'T1', 'S2']);
    expect(labels.at(-1)).toBe('T20');
  });
});

describe('around the world play', () => {
  it('beginner: single, double and triple all count', () => {
    const v = view('beginner', [d(1, 3), d(2, 2), d(3, 1)]);
    expect(v.remaining.A).toBe(3);
  });

  it('beginner: a miss or another number keeps the same target', () => {
    const v = view('beginner', [miss, d(5), d(1)]);
    expect(v.remaining.A).toBe(1);
  });

  it('pro: only the exact combination advances', () => {
    expect(view('pro', [d(1, 2), d(1, 3), d(2)]).remaining.A).toBe(0);
    expect(view('pro', [d(1), d(1, 2), d(1, 3)]).remaining.A).toBe(3);
  });

  it('a dart that hits lets the player keep throwing, even at the next target', () => {
    const v = view('beginner', [d(1), d(2), d(2)]);
    expect(v.remaining.A).toBe(2);
    expect(v.currentPlayer).toBe('B');
  });

  it('players take turns of three darts', () => {
    const one = view('beginner', [d(1), miss]);
    expect(one.currentPlayer).toBe('A');
    expect(one.dartsLeft).toBe(1);
    const two = view('beginner', [d(1), miss, miss, d(1)]);
    expect(two.currentPlayer).toBe('B');
    expect(two.dartsLeft).toBe(2);
    expect(two.remaining).toEqual({ A: 1, B: 1 });
  });

  it('the first player to hit the last target wins and the game ends', () => {
    const sequence = Array.from({ length: 20 }, (_, i) => d(i + 1));
    // A throws 1-3, B misses, and so on; keep A hitting one dart per turn.
    const darts: Dart[] = [];
    sequence.forEach((dart) => darts.push(dart, miss, miss, miss, miss, miss));
    const almost = view('beginner', darts);
    expect(almost.winner).toBeNull();
    expect(almost.remaining.A).toBe(20);
    const won = view('beginner', [...darts, d(25, 2)]);
    expect(won.winner).toBe('A');
    expect(won.currentPlayer).toBeNull();
    expect(won.dartsLeft).toBe(0);
  });

  it('pro: T20 wins', () => {
    const darts = aroundTheWorldTargets('pro').map((t) => d(t.sector, t.multiplier ?? 1));
    const v = view('pro', darts, ['A']);
    expect(v.winner).toBe('A');
  });
});
