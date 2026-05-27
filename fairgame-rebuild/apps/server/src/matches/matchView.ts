import { getMatchOutcome, type FairMatch, type MatchOutcome, type TicTacToeState } from "@fairgame/domain";
import type { BoardId, BoardOutcome, SeatId } from "@fairgame/shared";

export type TicTacToeBoardView = {
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly cells: readonly (SeatId | null)[];
  readonly seatsToAct: readonly SeatId[];
  readonly outcome: BoardOutcome;
};

export type MatchView = {
  readonly id: string;
  readonly gameType: string;
  readonly seats: readonly SeatId[];
  readonly outcome: MatchOutcome;
  readonly boards: readonly TicTacToeBoardView[];
};

export function toMatchView(match: FairMatch<TicTacToeState>): MatchView {
  return {
    id: match.id,
    gameType: match.gameType,
    seats: match.seats,
    outcome: getMatchOutcome(match),
    boards: match.boards.map((board) => ({
      id: board.id,
      firstSeat: board.firstSeat,
      cells: board.state.cells,
      seatsToAct: board.state.nextSeat ? [board.state.nextSeat] : [],
      outcome: board.outcome
    }))
  };
}
