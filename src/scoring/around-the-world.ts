import { DARTS_PER_VISIT, type GameView, type Visit } from './game.js';
import type { Dart } from './x01.js';

/** Beginner: 1 to 20 then the bull, any ring counts. Pro: S1, D1, T1 ... T20, exact ring only. */
export type AroundTheWorldLevel = 'beginner' | 'pro';

export interface AroundTheWorldConfig {
  level: AroundTheWorldLevel;
  /** Player ids in throwing order. */
  players: readonly string[];
}

export interface AroundTheWorldState {
  config: AroundTheWorldConfig;
  darts: readonly Dart[];
}

export interface Target {
  sector: number;
  /** Ring that must be hit, or null when any ring of the sector counts. */
  multiplier: 1 | 2 | 3 | null;
  /** Short label: "7" or "Bull" (beginner), "S7", "D7", "T7" (pro). */
  label: string;
}

const PREFIX = { 1: 'S', 2: 'D', 3: 'T' } as const;

/** The ordered targets a player has to hit. */
export function aroundTheWorldTargets(level: AroundTheWorldLevel): Target[] {
  const targets: Target[] = [];
  for (let sector = 1; sector <= 20; sector++) {
    if (level === 'beginner') {
      targets.push({ sector, multiplier: null, label: String(sector) });
    } else {
      for (const multiplier of [1, 2, 3] as const) {
        targets.push({ sector, multiplier, label: `${PREFIX[multiplier]}${sector}` });
      }
    }
  }
  if (level === 'beginner') targets.push({ sector: 25, multiplier: null, label: 'Bull' });
  return targets;
}

/** Whether the dart hits the target (a miss is sector 0 and never hits). */
export function hitsTarget(dart: Dart, target: Target): boolean {
  if (dart.sector !== target.sector) return false;
  return target.multiplier === null || dart.multiplier === target.multiplier;
}

/**
 * Rebuilds the game from the darts thrown, in the shape of an X01 `GameView`:
 * `remaining[player]` is the number of targets the player has already hit
 * (their progress), and `Visit.scored` is the number of targets hit in the visit.
 */
export function getAroundTheWorldView(state: AroundTheWorldState): GameView {
  const { level, players } = state.config;
  if (players.length === 0) throw new Error('A game needs at least one player');
  const targets = aroundTheWorldTargets(level);
  const progress: Record<string, number> = {};
  for (const p of players) progress[p] = 0;

  const visits: Visit[] = [];
  let turn = 0;
  let current: Visit | null = null;
  let winner: string | null = null;

  for (const dart of state.darts) {
    if (winner) break;
    const player = players[turn % players.length] as string;
    current ??= { player, darts: [], bust: false, scored: 0, finished: false };
    current.darts.push(dart);
    const target = targets[progress[player] as number] as Target;
    if (hitsTarget(dart, target)) {
      progress[player] = (progress[player] as number) + 1;
      current.scored += 1;
      if (progress[player] === targets.length) {
        current.finished = true;
        winner = player;
      }
    }
    if (current.finished || current.darts.length === DARTS_PER_VISIT) {
      visits.push(current);
      current = null;
      turn++;
    }
  }

  if (current) visits.push(current);
  const open = current as Visit | null;
  return {
    remaining: progress,
    visits,
    currentPlayer: winner ? null : (open?.player ?? (players[turn % players.length] as string)),
    dartsLeft: winner ? 0 : DARTS_PER_VISIT - (open?.darts.length ?? 0),
    winner,
  };
}
