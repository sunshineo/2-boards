import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type BreakthroughCell = SeatId | null;

export type BreakthroughState = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly BreakthroughCell[];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type BreakthroughMove = {
  readonly from: number;
  readonly to: number;
};

export const breakthroughRows = 8;
export const breakthroughColumns = 8;

export const breakthroughRules: GameRules<BreakthroughState, BreakthroughMove> = {
  gameType: "breakthrough",

  createInitialState({ firstSeat, seats }) {
    const cells = Array<BreakthroughCell>(breakthroughRows * breakthroughColumns).fill(null);

    for (let column = 0; column < breakthroughColumns; column += 1) {
      cells[getIndex(0, column)] = "seat1";
      cells[getIndex(1, column)] = "seat1";
      cells[getIndex(6, column)] = "seat2";
      cells[getIndex(7, column)] = "seat2";
    }

    return {
      rows: breakthroughRows,
      columns: breakthroughColumns,
      cells,
      seats,
      nextSeat: firstSeat,
      outcome: { status: "in_progress" }
    };
  },

  getSeatsToAct(state) {
    return state.nextSeat ? [state.nextSeat] : [];
  },

  validateMove({ state, move, seat }) {
    if (state.outcome.status !== "in_progress") {
      return { ok: false, reason: "board-not-active" };
    }

    if (state.nextSeat !== seat) {
      return { ok: false, reason: "seat-not-to-act" };
    }

    if (!isCellIndex(state, move.from) || !isCellIndex(state, move.to)) {
      return { ok: false, reason: "cell-out-of-range" };
    }

    const movingPiece = state.cells[move.from];
    if (movingPiece === null) {
      return { ok: false, reason: "from-empty" };
    }

    if (movingPiece !== seat) {
      return { ok: false, reason: "piece-not-owned" };
    }

    const fromPosition = getPosition(state, move.from);
    const toPosition = getPosition(state, move.to);
    const rowDelta = toPosition.row - fromPosition.row;
    const columnDelta = toPosition.column - fromPosition.column;
    const direction = getDirection(seat);

    if (rowDelta !== direction || Math.abs(columnDelta) > 1) {
      return { ok: false, reason: "illegal-direction" };
    }

    const target = state.cells[move.to];
    if (columnDelta === 0) {
      if (target !== null) {
        return { ok: false, reason: "forward-destination-occupied" };
      }

      return { ok: true };
    }

    if (target === null || target === seat) {
      return { ok: false, reason: "diagonal-requires-opponent" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const cells = [...state.cells];
    cells[move.from] = null;
    cells[move.to] = seat;
    const outcome = getBreakthroughOutcome({ ...state, cells }, seat, move.to);

    return {
      ...state,
      cells,
      nextSeat: outcome.status === "in_progress" ? getOtherSeat(state.seats, seat) : null,
      outcome
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

function getBreakthroughOutcome(state: BreakthroughState, movedSeat: SeatId, to: number): BoardOutcome {
  if (getPosition(state, to).row === getFarRank(movedSeat)) {
    return {
      status: "win",
      winner: movedSeat,
      loser: getOtherSeat(state.seats, movedSeat),
      reason: "far-rank"
    };
  }

  const opponent = getOtherSeat(state.seats, movedSeat);
  if (!state.cells.includes(opponent)) {
    return {
      status: "win",
      winner: movedSeat,
      loser: opponent,
      reason: "opponent-eliminated"
    };
  }

  return { status: "in_progress" };
}

function getIndex(row: number, column: number) {
  return row * breakthroughColumns + column;
}

function getPosition(state: Pick<BreakthroughState, "columns">, cell: number) {
  return {
    row: Math.floor(cell / state.columns),
    column: cell % state.columns
  };
}

function isCellIndex(state: Pick<BreakthroughState, "cells">, cell: number) {
  return Number.isInteger(cell) && cell >= 0 && cell < state.cells.length;
}

function getDirection(seat: SeatId) {
  return seat === "seat1" ? 1 : -1;
}

function getFarRank(seat: SeatId) {
  return seat === "seat1" ? breakthroughRows - 1 : 0;
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
