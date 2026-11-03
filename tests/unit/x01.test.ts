import { describe, expect, it } from 'vitest';
import { applyTurn, dartValue } from '../../src/scoring/index.js';

describe('x01 scoring', () => {
  it('multiplies the sector by the multiplier', () => {
    expect(dartValue({ sector: 20, multiplier: 3 })).toBe(60);
    expect(dartValue({ sector: 25, multiplier: 2 })).toBe(50);
    expect(dartValue({ sector: 0, multiplier: 1 })).toBe(0);
  });

  it('subtracts a normal turn', () => {
    const result = applyTurn(501, [
      { sector: 20, multiplier: 3 },
      { sector: 20, multiplier: 3 },
      { sector: 20, multiplier: 3 },
    ]);
    expect(result).toEqual({ remaining: 321, bust: false, finished: false });
  });

  it('finishes on a double', () => {
    const result = applyTurn(40, [{ sector: 20, multiplier: 2 }]);
    expect(result).toEqual({ remaining: 0, bust: false, finished: true });
  });

  it('busts when reaching 0 without a double and keeps the score', () => {
    const result = applyTurn(20, [{ sector: 20, multiplier: 1 }]);
    expect(result).toEqual({ remaining: 20, bust: true, finished: false });
  });

  it('busts when leaving 1 or going below 0', () => {
    expect(applyTurn(21, [{ sector: 20, multiplier: 1 }]).bust).toBe(true);
    expect(applyTurn(10, [{ sector: 20, multiplier: 1 }]).bust).toBe(true);
  });
});
