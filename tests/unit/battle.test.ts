import { describe, expect, it } from 'vitest';
import { battleTurn, createBattle, getBattleView, type Dart } from '../../src/scoring/index.js';

const t20: Dart = { sector: 20, multiplier: 3 }; // 60
const s20: Dart = { sector: 20, multiplier: 1 }; // 20
const miss: Dart = { sector: 0, multiplier: 1 };

function game(hitPoints: number, darts: Dart[], teams: [string[], string[]] = [['a'], ['b']]) {
  return getBattleView({ ...createBattle({ hitPoints, teams }), darts });
}

describe('battle scoring', () => {
  it('starts both teams at the chosen hit points with the first player of team 1', () => {
    const view = game(500, []);
    expect(view.hitPoints).toEqual([500, 500]);
    expect(view.currentPlayer).toBe('a');
    expect(view.currentTeam).toBe(0);
    expect(view.dartsLeft).toBe(3);
  });

  it('takes the score of a visit from the opposing team only', () => {
    const view = game(500, [t20, t20, s20]); // 140 from team 2
    expect(view.hitPoints).toEqual([500, 360]);
    expect(view.currentPlayer).toBe('b');
    const next = game(500, [t20, t20, s20, s20, miss, miss]); // 20 from team 1
    expect(next.hitPoints).toEqual([480, 360]);
  });

  it('shows the hit points live while a visit is in progress', () => {
    const view = game(500, [t20]);
    expect(view.hitPoints).toEqual([500, 440]);
    expect(view.currentPlayer).toBe('a');
    expect(view.dartsLeft).toBe(2);
  });

  it('alternates teams, each cycling through its own players', () => {
    const teams: [string[], string[]] = [['a1', 'a2'], ['b1']];
    const order = [0, 1, 2, 3, 4, 5].map((i) => battleTurn(teams, i).player);
    expect(order).toEqual(['a1', 'b1', 'a2', 'b1', 'a1', 'b1']);
  });

  it('ends the game when a team has no hit points left, and names the winners', () => {
    const view = game(500, [
      ...Array<Dart>(3).fill(t20), // team 2: 320
      miss,
      miss,
      miss,
      ...Array<Dart>(3).fill(t20), // 140
      miss,
      miss,
      miss,
      t20,
      t20,
      t20, // 0 (180 over 140)
    ]);
    expect(view.hitPoints).toEqual([500, 0]);
    expect(view.winner).toBe('a');
    expect(view.winnerTeam).toBe(0);
    expect(view.currentPlayer).toBeNull();
    expect(view.dartsLeft).toBe(0);
  });

  it('stops the visit at the dart that takes the last hit points and never goes below zero', () => {
    const view = game(100, [t20, t20]);
    expect(view.hitPoints).toEqual([100, 0]);
    expect(view.winnerTeam).toBe(0);
    expect(view.visits[0]?.darts).toHaveLength(2);
  });

  it('lets the second team win too', () => {
    const view = game(100, [miss, miss, miss, t20, t20]);
    expect(view.winner).toBe('b');
    expect(view.winnerTeam).toBe(1);
    expect(view.hitPoints).toEqual([0, 100]);
  });

  it('refuses invalid setups', () => {
    expect(() => createBattle({ hitPoints: 500, teams: [[], ['b']] })).toThrow();
    expect(() => createBattle({ hitPoints: 0, teams: [['a'], ['b']] })).toThrow();
  });
});
