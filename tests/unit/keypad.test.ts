import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { dartValue, formatDart, suggestCheckout, type Dart } from '../../src/scoring/index.js';

type Key = number | 'bull';
interface KeypadApi {
  dartFor(key: Key, modifier: number): Dart | null;
  keyFor(dart: Dart): { key: Key; modifier: number };
}

// public/keypad.js is a plain browser script: run it in a sandbox, as the browser does.
const sandbox: { Keypad?: KeypadApi } = {};
runInNewContext(readFileSync('public/keypad.js', 'utf8'), sandbox);
const keypad = sandbox.Keypad as KeypadApi;

describe('keypad input', () => {
  it('records Simple, Double and Triple for 1 to 20', () => {
    for (let n = 1; n <= 20; n++) {
      expect(keypad.dartFor(n, 1)).toEqual({ sector: n, multiplier: 1 });
      expect(keypad.dartFor(n, 2)).toEqual({ sector: n, multiplier: 2 });
      expect(keypad.dartFor(n, 3)).toEqual({ sector: n, multiplier: 3 });
    }
  });

  it('scores like the board for every key', () => {
    // The board sends { sector, multiplier } for the segment it shows: the keypad sends the same.
    expect(dartValue(keypad.dartFor(20, 3) as Dart)).toBe(60);
    expect(dartValue(keypad.dartFor(16, 2) as Dart)).toBe(32);
    expect(dartValue(keypad.dartFor(7, 1) as Dart)).toBe(7);
  });

  it('handles 25 and Bull', () => {
    expect(keypad.dartFor(25, 1)).toEqual({ sector: 25, multiplier: 1 });
    expect(keypad.dartFor(25, 2)).toEqual({ sector: 25, multiplier: 2 });
    expect(keypad.dartFor('bull', 1)).toEqual({ sector: 25, multiplier: 2 });
    expect(keypad.dartFor('bull', 3)).toEqual({ sector: 25, multiplier: 2 });
  });

  it('refuses Triple 25 and unknown keys', () => {
    expect(keypad.dartFor(25, 3)).toBeNull();
    expect(keypad.dartFor(21, 1)).toBeNull();
    expect(keypad.dartFor(0, 1)).toBeNull();
  });

  it('finds the key and modifier to blink for each checkout target', () => {
    const route = suggestCheckout(170, 3) as Dart[];
    expect(route.map(formatDart).join(' ')).toBe('T20 T20 Bull');
    expect(keypad.keyFor(route[0] as Dart)).toEqual({ key: 20, modifier: 3 });
    expect(keypad.keyFor(route[2] as Dart)).toEqual({ key: 'bull', modifier: 1 });
    expect(keypad.keyFor({ sector: 25, multiplier: 1 })).toEqual({ key: 25, modifier: 1 });
    expect(keypad.keyFor({ sector: 18, multiplier: 2 })).toEqual({ key: 18, modifier: 2 });
  });

  it('every checkout target maps back to the same dart through the keypad', () => {
    for (let score = 2; score <= 170; score++) {
      for (const dart of suggestCheckout(score, 3) ?? []) {
        const { key, modifier } = keypad.keyFor(dart);
        expect(keypad.dartFor(key, modifier)).toEqual(dart);
      }
    }
  });

  it('shows no suggestion above 170 or for bogey scores', () => {
    expect(suggestCheckout(171, 3)).toBeNull();
    expect(suggestCheckout(180, 3)).toBeNull();
    expect(suggestCheckout(169, 3)).toBeNull();
  });
});
