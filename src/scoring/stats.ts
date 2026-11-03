import { getGameView } from './game.js';
import type { Dart } from './x01.js';

/** A finished game, as the statistics need it. Player ids are strings, as in the engine. */
export interface FinishedGameInput {
  startScore: number;
  /** Player ids in throwing order. */
  players: readonly string[];
  /** Every dart of the game, in throwing order. */
  darts: readonly Dart[];
  winner: string | null;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  /** Share of games won, 0-100, rounded to one decimal; 0 without any game. */
  winPercent: number;
  /** Points ÷ darts × 3, bust darts counted with 0 points; null without any dart. */
  threeDartAverage: number | null;
  bestVisit: number;
  /** Visits of exactly 180. */
  count180: number;
  /** Visits of 100 points or more (the 180s included). */
  visits100Plus: number;
  /** Points of the best finishing visit; null when the player never won. */
  highestCheckout: number | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Statistics of one player over the finished games he or she took part in. */
export function computePlayerStats(
  playerId: string,
  games: readonly FinishedGameInput[],
): PlayerStats {
  let gamesPlayed = 0;
  let gamesWon = 0;
  let points = 0;
  let darts = 0;
  let bestVisit = 0;
  let count180 = 0;
  let visits100Plus = 0;
  let highestCheckout: number | null = null;

  for (const game of games) {
    if (!game.players.includes(playerId)) continue;
    gamesPlayed++;
    if (game.winner === playerId) gamesWon++;
    const view = getGameView({
      config: { startScore: game.startScore, players: game.players },
      darts: game.darts,
    });
    for (const visit of view.visits) {
      if (visit.player !== playerId) continue;
      darts += visit.darts.length;
      points += visit.scored;
      bestVisit = Math.max(bestVisit, visit.scored);
      if (visit.scored === 180) count180++;
      if (visit.scored >= 100) visits100Plus++;
      if (visit.finished) highestCheckout = Math.max(highestCheckout ?? 0, visit.scored);
    }
  }

  return {
    gamesPlayed,
    gamesWon,
    winPercent: gamesPlayed === 0 ? 0 : round1((gamesWon / gamesPlayed) * 100),
    threeDartAverage: darts === 0 ? null : round1((points / darts) * 3),
    bestVisit,
    count180,
    visits100Plus,
    highestCheckout,
  };
}
