import { describe, expect, it } from 'vitest';
import { applyTurn, formatDart, suggestCheckout } from '../../src/scoring/index.js';

const label = (remaining: number, darts: number) =>
  (suggestCheckout(remaining, darts) ?? []).map(formatDart).join(' ');

describe('checkout calculator', () => {
  it('suggests T20 T20 Bull for 170', () => {
    expect(label(170, 3)).toBe('T20 T20 Bull');
  });

  it.each([167, 160, 141, 50, 40, 3])('gives a valid finish for %i', (score) => {
    const darts = suggestCheckout(score, 3);
    expect(darts).not.toBeNull();
    expect(applyTurn(score, darts ?? []).finished).toBe(true);
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
      const darts = suggestCheckout(score, 3);
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
    expect(suggestCheckout(score, 3)).toBeNull();
  });

  it('has 2 darts as max 110', () => {
    expect(suggestCheckout(110, 2)).not.toBeNull();
    for (let score = 111; score <= 170; score++) {
      expect(suggestCheckout(score, 2)).toBeNull();
    }
  });

  it('every suggestion for 2 to 170 is valid and fits the darts left', () => {
    for (let dartsLeft = 1; dartsLeft <= 3; dartsLeft++) {
      for (let score = 2; score <= 170; score++) {
        const darts = suggestCheckout(score, dartsLeft);
        if (darts) {
          expect(darts.length).toBeLessThanOrEqual(dartsLeft);
          expect(applyTurn(score, darts).finished).toBe(true);
        }
      }
    }
  });

  it('accounts for the darts left in the visit', () => {
    expect(suggestCheckout(100, 1)).toBeNull();
    expect(label(40, 1)).toBe('D20');
    expect(label(100, 2)).toBe('T20 D20');
    expect(suggestCheckout(100, 3)).not.toBeNull();
  });

  it('gives no suggestion above 170 or for impossible inputs', () => {
    expect(suggestCheckout(171, 3)).toBeNull();
    expect(suggestCheckout(501, 3)).toBeNull();
    expect(suggestCheckout(1, 3)).toBeNull();
    expect(suggestCheckout(0, 3)).toBeNull();
    expect(suggestCheckout(40, 0)).toBeNull();
  });
});
