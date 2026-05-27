import { getMatchOutcome, type FairMatch, type MatchClockView, type MatchOutcome } from "@fairgame/domain";
import type { SeatId } from "@fairgame/shared";

import {
  getGameDefinition,
  type MatchBoardView,
  type SupportedGameState,
  type SupportedGameType
} from "./gameRegistry";

export type MatchView = {
  readonly id: string;
  readonly gameType: SupportedGameType;
  readonly gameLabel: string;
  readonly seats: readonly SeatId[];
  readonly outcome: MatchOutcome;
  readonly clock: MatchClockView | null;
  readonly boards: readonly MatchBoardView[];
};

export function toMatchView(match: FairMatch<SupportedGameState>, clock: MatchClockView | null = null): MatchView {
  const game = getGameDefinition(match.gameType);
  if (!game) {
    throw new Error(`Unsupported game type in match view: ${match.gameType}`);
  }

  return {
    id: match.id,
    gameType: game.gameType,
    gameLabel: game.label,
    seats: match.seats,
    outcome: getMatchOutcome(match),
    clock,
    boards: match.boards.map((board) => game.toBoardView(board))
  };
}
