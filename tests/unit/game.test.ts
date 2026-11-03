import { describe, expect, it } from 'vitest';
import {
  createGame,
  getGameView,
  throwDart,
  undoDart,
  type Dart,
  type GameState,
} from '../../src/scoring/index.js';

const S = (sector: number): Dart => ({ sector, multiplier: 1 });
const D = (sector: number): Dart => ({ sector, multiplier: 2 });
const T = (sector: number): Dart => ({ sector, multiplier: 3 });
const BULL = D(25);

function play(state: GameState, ...darts: Dart[]): GameState {
  return darts.reduce(throwDart, state);
}

const newGame = (start = 501) => createGame({ startScore: start, players: ['A', 'B'] });

describe('game flow', () => {
  it('passes the turn after three darts and scores the visit', () => {
    const view = getGameView(play(newGame(), T(20), T(20), T(20)));
    expect(view.remaining).toEqual({ A: 321, B: 501 });
    expect(view.currentPlayer).toBe('B');
    expect(view.dartsLeft).toBe(3);
  });

  it('shows the visit in progress', () => {
    const view = getGameView(play(newGame(), T(20), S(1)));
    expect(view.remaining.A).toBe(440);
    expect(view.currentPlayer).toBe('A');
    expect(view.dartsLeft).toBe(1);
  });

  it('rejects darts after the game is won', () => {
    const won = play(newGame(40), D(20));
    expect(() => throwDart(won, S(1))).toThrow();
  });
});

describe('bust', () => {
  it('busts below 0 and scores 0', () => {
    const view = getGameView(play(newGame(40), T(20), S(5)));
    expect(view.visits[0]).toMatchObject({ bust: true, scored: 0 });
    expect(view.remaining.A).toBe(40);
    expect(view.currentPlayer).toBe('B');
  });

  it('busts when exactly 1 is left, even after earlier darts in the visit', () => {
    const view = getGameView(play(newGame(40), S(20), S(19)));
    expect(view.visits[0]).toMatchObject({ bust: true, scored: 0 });
    expect(view.remaining.A).toBe(40);
    expect(view.currentPlayer).toBe('B');
  });

  it('busts on 0 with a non-double and passes the turn without waiting for more darts', () => {
    const view = getGameView(play(newGame(40), S(20), S(20)));
    expect(view.visits[0]).toMatchObject({ bust: true, scored: 0 });
    expect(view.remaining.A).toBe(40);
    expect(view.currentPlayer).toBe('B');
    expect(view.winner).toBeNull();
  });

  it('treats a treble finish as a bust', () => {
    const view = getGameView(play(newGame(60), T(20)));
    expect(view.visits[0]?.bust).toBe(true);
    expect(view.winner).toBeNull();
  });
});

describe('double out', () => {
  it('wins on a double', () => {
    const view = getGameView(play(newGame(100), T(20), D(20)));
    expect(view.winner).toBe('A');
    expect(view.remaining.A).toBe(0);
    expect(view.currentPlayer).toBeNull();
    expect(view.dartsLeft).toBe(0);
  });

  it('wins on the bull (50)', () => {
    const view = getGameView(play(newGame(170), T(20), T(20), BULL));
    expect(view.winner).toBe('A');
    expect(view.visits[0]).toMatchObject({ finished: true, scored: 170, bust: false });
  });

  it('lets the other player win after a failed visit', () => {
    const view = getGameView(play(newGame(32), S(1), S(1), S(1), D(16)));
    expect(view.winner).toBe('B');
  });
});

describe('undo', () => {
  it('does nothing on an empty game', () => {
    expect(undoDart(newGame()).darts).toHaveLength(0);
  });

  it('undoes a dart within a visit', () => {
    const view = getGameView(undoDart(play(newGame(), T(20), T(20))));
    expect(view.remaining.A).toBe(441);
    expect(view.dartsLeft).toBe(2);
  });

  it('undoes across a visit boundary', () => {
    const state = play(newGame(), T(20), T(20), T(20), S(5));
    const back = undoDart(undoDart(state));
    const view = getGameView(back);
    expect(view.currentPlayer).toBe('A');
    expect(view.dartsLeft).toBe(1);
    expect(view.remaining).toEqual({ A: 381, B: 501 });
    expect(view.visits).toHaveLength(1);
  });

  it('undoes a bust and restores the visit', () => {
    const busted = play(newGame(40), S(20), S(20));
    expect(getGameView(busted).currentPlayer).toBe('B');
    const view = getGameView(undoDart(busted));
    expect(view.currentPlayer).toBe('A');
    expect(view.remaining.A).toBe(20);
    expect(view.dartsLeft).toBe(2);
    expect(view.visits[0]?.bust).toBe(false);
  });

  it('undoes a winning dart', () => {
    const view = getGameView(undoDart(play(newGame(40), D(20))));
    expect(view.winner).toBeNull();
    expect(view.remaining.A).toBe(40);
  });
});
