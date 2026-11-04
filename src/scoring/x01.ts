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
 * Whether a score left after a dart is a bust. Simple out (default): only going below 0.
 * Forced double out: also leaving 1, or reaching 0 with a dart that is not a double (or bullseye).
 */
export function isBust(left: number, dart: Dart, doubleOut: boolean): boolean {
  if (left < 0) return true;
  if (!doubleOut) return false;
  return left === 1 || (left === 0 && dart.multiplier !== 2);
}

/**
 * Applies up to three darts to a remaining score.
 * Simple out by default: any dart reaching exactly 0 wins. With `doubleOut`, the turn is a bust
 * when it goes below 0, leaves 1, or reaches 0 without a double.
 */
export function applyTurn(
  remaining: number,
  darts: readonly Dart[],
  doubleOut = false,
): TurnResult {
  let left = remaining;
  for (const dart of darts) {
    left -= dartValue(dart);
    if (isBust(left, dart, doubleOut)) return { remaining, bust: true, finished: false };
    if (left === 0) return { remaining: 0, bust: false, finished: true };
  }
  return { remaining: left, bust: false, finished: false };
}
