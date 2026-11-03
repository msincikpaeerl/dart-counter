import { dartValue, type Dart } from './x01.js';

export const DARTS_PER_VISIT = 3;

export interface GameConfig {
  /** Starting score, usually 301 or 501. */
  startScore: number;
  /** Player ids in throwing order. */
  players: readonly string[];
}

/** A game is its configuration plus every dart thrown so far, in order. */
export interface GameState {
  config: GameConfig;
  darts: readonly Dart[];
}

export interface Visit {
  player: string;
  darts: Dart[];
  bust: boolean;
  /** Points scored by the visit: 0 for a bust. */
  scored: number;
  finished: boolean;
}

export interface GameView {
  remaining: Record<string, number>;
  /** Completed visits followed by the visit in progress (if it has darts). */
  visits: Visit[];
  /** Player who throws next, or null when the game is won. */
  currentPlayer: string | null;
  /** Darts left in the current visit (0 when the game is won). */
  dartsLeft: number;
  /** First player to have checked out, or null. */
  winner: string | null;
}

export function createGame(config: GameConfig): GameState {
  if (config.players.length === 0) throw new Error('A game needs at least one player');
  if (!Number.isInteger(config.startScore) || config.startScore < 2) {
    throw new Error('The starting score must be an integer of at least 2');
  }
  return { config, darts: [] };
}

/** Rebuilds scores, visits and turn order from the darts thrown. */
export function getGameView(state: GameState): GameView {
  const { startScore, players } = state.config;
  const remaining: Record<string, number> = {};
  for (const p of players) remaining[p] = startScore;

  const visits: Visit[] = [];
  let turn = 0;
  let current: Visit | null = null;
  let winner: string | null = null;

  for (const dart of state.darts) {
    const player = players[turn % players.length] as string;
    current ??= { player, darts: [], bust: false, scored: 0, finished: false };
    current.darts.push(dart);
    const before = remaining[player] as number;
    const after = before - current.darts.reduce((sum, d) => sum + dartValue(d), 0);

    if (after < 0 || after === 1 || (after === 0 && dart.multiplier !== 2)) {
      current.bust = true;
    } else if (after === 0) {
      current.finished = true;
      winner = player;
    }

    if (current.bust) {
      current.scored = 0;
    } else {
      current.scored = current.darts.reduce((sum, d) => sum + dartValue(d), 0);
    }

    if (current.bust || current.finished || current.darts.length === DARTS_PER_VISIT) {
      remaining[player] = current.bust ? before : before - current.scored;
      visits.push(current);
      current = null;
      turn++;
    }
  }

  if (current) visits.push(current);
  const open = current as Visit | null;
  return {
    remaining: open
      ? { ...remaining, [open.player]: (remaining[open.player] as number) - open.scored }
      : remaining,
    visits,
    currentPlayer: winner ? null : (open?.player ?? (players[turn % players.length] as string)),
    dartsLeft: winner ? 0 : DARTS_PER_VISIT - (open?.darts.length ?? 0),
    winner,
  };
}

/** Records one dart. Throws when the game is already won. */
export function throwDart(state: GameState, dart: Dart): GameState {
  if (getGameView(state).winner) throw new Error('The game is already won');
  return { ...state, darts: [...state.darts, dart] };
}

/** Removes the last dart, across visit boundaries and including a bust. No-op on an empty game. */
export function undoDart(state: GameState): GameState {
  return { ...state, darts: state.darts.slice(0, -1) };
}
