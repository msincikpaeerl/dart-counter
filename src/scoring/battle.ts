import { DARTS_PER_VISIT } from './game.js';
import { dartValue, type Dart } from './x01.js';

/** Starting hit points of each team. */
export const BATTLE_HIT_POINTS = [500, 1000, 2000] as const;

export interface BattleConfig {
  /** Starting hit points of each team. */
  hitPoints: number;
  /** Player ids of the two teams, each in its own throwing order. */
  teams: readonly [readonly string[], readonly string[]];
}

export interface BattleState {
  config: BattleConfig;
  darts: readonly Dart[];
}

export interface BattleVisit {
  player: string;
  /** Index (0 or 1) of the team the player belongs to. */
  team: 0 | 1;
  darts: Dart[];
  /** Points scored by the visit, taken from the opposing team. */
  scored: number;
  /** True when the visit took the opposing team down to zero. */
  finished: boolean;
}

export interface BattleView {
  /** Hit points left for each team. */
  hitPoints: [number, number];
  /** Completed visits followed by the visit in progress (if it has darts). */
  visits: BattleVisit[];
  /** Player who throws next, or null when the game is over. */
  currentPlayer: string | null;
  currentTeam: 0 | 1 | null;
  dartsLeft: number;
  /** Player who took the last hit points, or null. */
  winner: string | null;
  /** Team that won, or null. */
  winnerTeam: 0 | 1 | null;
}

export function createBattle(config: BattleConfig): BattleState {
  if (!Number.isInteger(config.hitPoints) || config.hitPoints < 1) {
    throw new Error('The hit points must be a positive integer');
  }
  if (config.teams.some((team) => team.length === 0)) {
    throw new Error('Each team needs at least one player');
  }
  return { config, darts: [] };
}

/** Who throws the n-th visit (0-based): the teams alternate, each cycling through its players. */
export function battleTurn(
  teams: BattleConfig['teams'],
  visitIndex: number,
): { player: string; team: 0 | 1 } {
  const team = (visitIndex % 2) as 0 | 1;
  const members = teams[team];
  const player = members[Math.floor(visitIndex / 2) % members.length] as string;
  return { player, team };
}

/** Rebuilds hit points, visits and turn order from the darts thrown. */
export function getBattleView(state: BattleState): BattleView {
  const { teams } = state.config;
  const hitPoints: [number, number] = [state.config.hitPoints, state.config.hitPoints];
  const visits: BattleVisit[] = [];
  let current: BattleVisit | null = null;
  let winner: string | null = null;
  let winnerTeam: 0 | 1 | null = null;

  for (const dart of state.darts) {
    const turn = battleTurn(teams, visits.length);
    current ??= { ...turn, darts: [], scored: 0, finished: false };
    current.darts.push(dart);
    current.scored += dartValue(dart);
    const target = (1 - current.team) as 0 | 1;
    const left = Math.max(0, hitPoints[target] - current.scored);

    if (left === 0) {
      current.finished = true;
      winner = current.player;
      winnerTeam = current.team;
    }
    if (current.finished || current.darts.length === DARTS_PER_VISIT) {
      hitPoints[target] = left;
      visits.push(current);
      current = null;
    }
  }

  const open = current as BattleVisit | null;
  if (open) {
    visits.push(open);
    const target = (1 - open.team) as 0 | 1;
    hitPoints[target] = hitPoints[target] - open.scored;
  }
  const next = open ?? battleTurn(teams, visits.length);
  return {
    hitPoints,
    visits,
    currentPlayer: winner ? null : next.player,
    currentTeam: winner ? null : next.team,
    dartsLeft: winner ? 0 : DARTS_PER_VISIT - (open?.darts.length ?? 0),
    winner,
    winnerTeam,
  };
}
