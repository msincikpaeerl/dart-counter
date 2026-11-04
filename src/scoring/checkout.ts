import { dartValue, type Dart } from './x01.js';

/** Highest score that can be checked out with three darts (T20 T20 Bull). */
export const MAX_CHECKOUT = 170;

const BULL: Dart = { sector: 25, multiplier: 2 };

/** Final doubles, most preferred first: D20, D16, D8, then the usual halving ladder, bull last. */
const DOUBLE_PREFERENCE = [20, 16, 8, 10, 12, 18, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];

const SETUP_DARTS: readonly Dart[] = buildSetupDarts();

function buildSetupDarts(): Dart[] {
  const darts: Dart[] = [];
  for (let sector = 1; sector <= 20; sector++) {
    darts.push({ sector, multiplier: 3 }, { sector, multiplier: 2 }, { sector, multiplier: 1 });
  }
  darts.push({ sector: 25, multiplier: 1 }, BULL);
  // Highest value first, so that the search meets the conventional routes first.
  return darts.sort((a, b) => dartValue(b) - dartValue(a));
}

const DOUBLE_FINALS: readonly Dart[] = [
  ...DOUBLE_PREFERENCE.map((sector): Dart => ({ sector, multiplier: 2 })),
  BULL,
];

/** Simple out: the doubles first (so the usual routes stay), then any other dart. */
const SIMPLE_FINALS: readonly Dart[] = [
  ...DOUBLE_FINALS,
  ...SETUP_DARTS.filter((dart) => dart.multiplier !== 2),
];

interface Route {
  darts: Dart[];
  /** Lower is better: [bull/25 darts used, final double rank, setup ranks...]. */
  rank: number[];
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isBullish(dart: Dart): boolean {
  return dart.sector === 25;
}

function search(remaining: number, dartCount: number, doubleOut: boolean): Dart[] | null {
  const finals = doubleOut ? DOUBLE_FINALS : SIMPLE_FINALS;
  // Double out must leave at least 2 for the final double; simple out at least 1.
  const minLeft = doubleOut ? 2 : 1;
  let best: Route | null = null;

  const visit = (setup: Dart[], left: number): void => {
    if (setup.length === dartCount - 1) {
      finals.forEach((last, finalRank) => {
        if (dartValue(last) !== left) return;
        const darts = [...setup, last];
        const rank = [
          darts.filter(isBullish).length,
          finalRank,
          ...setup.map((d) => SETUP_DARTS.indexOf(d)),
        ];
        if (!best || compareRank(rank, best.rank) < 0) best = { darts, rank };
      });
      return;
    }
    for (const dart of SETUP_DARTS) {
      const value = dartValue(dart);
      if (left - value >= minLeft) visit([...setup, dart], left - value);
    }
  };

  visit([], remaining);
  return (best as Route | null)?.darts ?? null;
}

/** Highest score that can be checked out with three darts in simple out (T20 T20 T20). */
export const MAX_SIMPLE_CHECKOUT = 180;

const cache = new Map<string, Dart[] | null>();

/**
 * Suggests how to check out `remaining` within `dartsLeft` darts (1 to 3) of the current visit.
 * Uses the fewest darts possible, prefers D20, D16, D8 and avoids the bull unless needed.
 * With `doubleOut` the last dart is a double or the bull; otherwise (simple out, the default) it can
 * be any dart. Returns null above 170 (180 in simple out), for bogey numbers in double out, or when
 * it cannot be done in the darts left.
 */
export function suggestCheckout(
  remaining: number,
  dartsLeft: number,
  doubleOut = false,
): Dart[] | null {
  if (!Number.isInteger(remaining) || !Number.isInteger(dartsLeft)) return null;
  const min = doubleOut ? 2 : 1;
  const max = doubleOut ? MAX_CHECKOUT : MAX_SIMPLE_CHECKOUT;
  if (remaining < min || remaining > max || dartsLeft < 1 || dartsLeft > 3) return null;
  const key = `${remaining}:${dartsLeft}:${doubleOut}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached ? [...cached] : null;
  let found: Dart[] | null = null;
  for (let count = 1; count <= dartsLeft && !found; count++)
    found = search(remaining, count, doubleOut);
  cache.set(key, found);
  return found ? [...found] : null;
}

/** Short label of a dart: "T20", "D16", "20", "25" or "Bull". */
export function formatDart(dart: Dart): string {
  if (dart.sector === 0) return 'Miss';
  if (dart.sector === 25) return dart.multiplier === 2 ? 'Bull' : '25';
  return `${dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : ''}${dart.sector}`;
}
