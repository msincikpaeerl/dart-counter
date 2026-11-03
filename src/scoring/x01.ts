/** Pure X01 scoring rules. No UI, no database, no I/O: keep it that way (enforced by ESLint). */

export interface Dart {
  /** Sector hit: 1-20, 25 (bull) or 0 (miss). */
  sector: number;
  multiplier: 1 | 2 | 3;
}

export interface TurnResult {
  /** Score left after the turn (unchanged when the turn is a bust). */
  remaining: number;
  bust: boolean;
  finished: boolean;
}

export function dartValue(dart: Dart): number {
  return dart.sector * dart.multiplier;
}

/**
 * Applies up to three darts to a remaining score (double-out rule).
 * A turn is a bust when it goes below 0, leaves 1, or reaches 0 without a double.
 */
export function applyTurn(remaining: number, darts: readonly Dart[]): TurnResult {
  let left = remaining;
  for (const dart of darts) {
    left -= dartValue(dart);
    if (left < 0 || left === 1) return { remaining, bust: true, finished: false };
    if (left === 0) {
      if (dart.multiplier !== 2) return { remaining, bust: true, finished: false };
      return { remaining: 0, bust: false, finished: true };
    }
  }
  return { remaining: left, bust: false, finished: false };
}
