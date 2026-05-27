import { getMatchOutcome, type FairMatch, type MatchOutcome } from "@fairgame/domain";
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
  readonly boards: readonly MatchBoardView[];
};

export function toMatchView(match: FairMatch<SupportedGameState>): MatchView {
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
    boards: match.boards.map((board) => game.toBoardView(board))
  };
}
