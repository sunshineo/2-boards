import type { BoardId, SeatId } from "@fairgame/shared";

import { getMatchOutcome } from "./scoring.js";
import type { ApplyMoveCommand, ApplyMoveResult, FairBoard, FairMatch, GameRules } from "./types.js";

const seats = ["seat1", "seat2"] as const;

const boardAssignments = [
  { boardId: "A", firstSeat: "seat1" },
  { boardId: "B", firstSeat: "seat2" }
] as const satisfies readonly { readonly boardId: BoardId; readonly firstSeat: SeatId }[];

export type BootstrapBoardAssignment = (typeof boardAssignments)[number];

export function createBootstrapBoardAssignments(): BootstrapBoardAssignment[] {
  return boardAssignments.map((assignment) => ({ ...assignment }));
}

export function createFairMatch<TState, TMove>(input: {
  readonly id: string;
  readonly rules: GameRules<TState, TMove>;
}): FairMatch<TState> {
  return {
    id: input.id,
    gameType: input.rules.gameType,
    seats,
    boards: boardAssignments.map((assignment) =>
      createBoard({
        id: assignment.boardId,
        firstSeat: assignment.firstSeat,
        rules: input.rules
      })
    ) as [FairBoard<TState>, FairBoard<TState>]
  };
}

export function applyMoveToMatch<TState, TMove>(
  match: FairMatch<TState>,
  rules: GameRules<TState, TMove>,
  command: ApplyMoveCommand<TMove>
): ApplyMoveResult<TState> {
  if (getMatchOutcome(match).status !== "in_progress") {
    return { ok: false, reason: "match-not-active", match };
  }

  const boardIndex = match.boards.findIndex((board) => board.id === command.boardId);
  if (boardIndex === -1) {
    return { ok: false, reason: "board-not-found", match };
  }

  const board = match.boards[boardIndex];
  if (!board) {
    return { ok: false, reason: "board-not-found", match };
  }

  if (board.outcome.status !== "in_progress") {
    return { ok: false, reason: "board-not-active", match };
  }

  if (!rules.getSeatsToAct(board.state).includes(command.seat)) {
    return { ok: false, reason: "seat-not-to-act", match };
  }

  const validation = rules.validateMove({
    state: board.state,
    move: command.move,
    seat: command.seat
  });

  if (!validation.ok) {
    return { ok: false, reason: validation.reason, match };
  }

  const nextState = rules.applyMove({
    state: board.state,
    move: command.move,
    seat: command.seat
  });

  const nextBoard: FairBoard<TState> = {
    ...board,
    state: nextState,
    outcome: rules.getOutcome(nextState)
  };

  const nextBoards = match.boards.map((candidate, index) =>
    index === boardIndex ? nextBoard : candidate
  ) as [FairBoard<TState>, FairBoard<TState>];

  return {
    ok: true,
    match: {
      ...match,
      boards: nextBoards
    }
  };
}

export function getBoard<TState>(match: FairMatch<TState>, boardId: BoardId): FairBoard<TState> | null {
  return match.boards.find((board) => board.id === boardId) ?? null;
}

function createBoard<TState, TMove>(input: {
  readonly id: BoardId;
  readonly firstSeat: SeatId;
  readonly rules: GameRules<TState, TMove>;
}): FairBoard<TState> {
  const state = input.rules.createInitialState({
    firstSeat: input.firstSeat,
    seats
  });

  return {
    id: input.id,
    firstSeat: input.firstSeat,
    state,
    outcome: input.rules.getOutcome(state)
  };
}
