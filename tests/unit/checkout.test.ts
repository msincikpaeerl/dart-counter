import { describe, expect, it } from 'vitest';
import { applyTurn, formatDart, suggestCheckout } from '../../src/scoring/index.js';

const label = (remaining: number, darts: number, doubleOut = true) =>
  (suggestCheckout(remaining, darts, doubleOut) ?? []).map(formatDart).join(' ');

describe('checkout calculator (double out)', () => {
  it('suggests T20 T20 Bull for 170', () => {
    expect(label(170, 3)).toBe('T20 T20 Bull');
  });

  it.each([167, 160, 141, 50, 40, 3])('gives a valid finish for %i', (score) => {
    const darts = suggestCheckout(score, 3, true);
    expect(darts).not.toBeNull();
    expect(applyTurn(score, darts ?? [], true).finished).toBe(true);
    expect(darts?.length).toBeLessThanOrEqual(3);
  });

  it('prefers conventional routes', () => {
    expect(label(160, 3)).toBe('T20 T20 D20');
    expect(label(40, 3)).toBe('D20');
    expect(label(32, 3)).toBe('D16');
    expect(label(50, 3)).toBe('Bull');
    expect(label(167, 3)).toBe('T20 T19 Bull');
  });

  it('avoids the bull when another route exists', () => {
    for (let score = 2; score <= 170; score++) {
      const darts = suggestCheckout(score, 3, true);
      if (darts && score !== 50) {
        const bulls = darts.filter((d) => d.sector === 25).length;
        if (bulls > 0) expect(score).toBeGreaterThan(100);
      }
    }
  });

  it('suggests T20 Bull for 110 with 2 darts', () => {
    expect(label(110, 2)).toBe('T20 Bull');
  });

  it.each([169, 168, 166, 165, 163, 162, 159])('has no 3-dart finish for bogey %i', (score) => {
    expect(suggestCheckout(score, 3, true)).toBeNull();
  });

  it('has 2 darts as max 110', () => {
    expect(suggestCheckout(110, 2, true)).not.toBeNull();
    for (let score = 111; score <= 170; score++) {
      expect(suggestCheckout(score, 2, true)).toBeNull();
    }
  });

  it('every suggestion for 2 to 170 is valid and fits the darts left', () => {
    for (let dartsLeft = 1; dartsLeft <= 3; dartsLeft++) {
      for (let score = 2; score <= 170; score++) {
        const darts = suggestCheckout(score, dartsLeft, true);
        if (darts) {
          expect(darts.length).toBeLessThanOrEqual(dartsLeft);
          expect(applyTurn(score, darts, true).finished).toBe(true);
        }
      }
    }
  });

  it('accounts for the darts left in the visit', () => {
    expect(suggestCheckout(100, 1, true)).toBeNull();
    expect(label(40, 1)).toBe('D20');
    expect(label(100, 2)).toBe('T20 D20');
    expect(suggestCheckout(100, 3, true)).not.toBeNull();
  });

  it('gives no suggestion above 170 or for impossible inputs', () => {
    expect(suggestCheckout(171, 3, true)).toBeNull();
    expect(suggestCheckout(501, 3, true)).toBeNull();
    expect(suggestCheckout(1, 3, true)).toBeNull();
    expect(suggestCheckout(0, 3, true)).toBeNull();
    expect(suggestCheckout(40, 0, true)).toBeNull();
  });
});

describe('checkout calculator (simple out, the default)', () => {
  it('is the default rule', () => {
    expect(suggestCheckout(20, 1)).toEqual(suggestCheckout(20, 1, false));
  });

  it('can end on a single or a treble', () => {
    expect(label(60, 3, false)).toBe('T20');
    expect(label(57, 3, false)).toBe('T19');
    expect(suggestCheckout(41, 1, false)).toBeNull();
    expect(label(19, 1, false)).toBe('19');
    expect(label(1, 1, false)).toBe('1');
  });

  it('keeps a double when the finish needs as many darts', () => {
    expect(label(40, 3, false)).toBe('D20');
    expect(label(50, 3, false)).toBe('Bull');
  });

  it('suggests a finish for scores that are bogey numbers in double out', () => {
    expect(suggestCheckout(159, 3, true)).toBeNull();
    const route = suggestCheckout(159, 3, false) ?? [];
    expect(route.length).toBe(3);
    expect(applyTurn(159, route, false).finished).toBe(true);
    expect(label(180, 3, false)).toBe('T20 T20 T20');
  });

  it('every suggestion for 1 to 180 is valid in simple out and fits the darts left', () => {
    for (let dartsLeft = 1; dartsLeft <= 3; dartsLeft++) {
      for (let score = 1; score <= 180; score++) {
        const darts = suggestCheckout(score, dartsLeft, false);
        if (darts) {
          expect(darts.length).toBeLessThanOrEqual(dartsLeft);
          expect(applyTurn(score, darts, false).finished).toBe(true);
        }
      }
    }
    // Up to 162 every score can be checked out in three darts; 163 cannot (60 + 60 + 43).
    for (let score = 1; score <= 162; score++) {
      expect(suggestCheckout(score, 3, false), `score ${score}`).not.toBeNull();
    }
    expect(suggestCheckout(163, 3, false)).toBeNull();
  });

  it('gives no suggestion above 180 or at 0', () => {
    expect(suggestCheckout(181, 3, false)).toBeNull();
    expect(suggestCheckout(0, 3, false)).toBeNull();
  });
});
