import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export const gomokuRows = 15;
export const gomokuColumns = 15;

export type GomokuCell = SeatId | null;

export type GomokuState = {
  readonly rows: typeof gomokuRows;
  readonly columns: typeof gomokuColumns;
  readonly cells: readonly GomokuCell[];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type GomokuMove = {
  readonly cell: number;
};

const winningDirections = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const;

export const gomokuRules: GameRules<GomokuState, GomokuMove> = {
  gameType: "gomoku",

  createInitialState({ firstSeat, seats }) {
    return {
      rows: gomokuRows,
      columns: gomokuColumns,
      cells: Array<GomokuCell>(gomokuRows * gomokuColumns).fill(null),
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

    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell >= state.cells.length) {
      return { ok: false, reason: "cell-out-of-range" };
    }

    if (state.cells[move.cell] !== null) {
      return { ok: false, reason: "cell-occupied" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const cells = [...state.cells];
    cells[move.cell] = seat;
    const outcome = getGomokuOutcome({ ...state, cells });

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

function getGomokuOutcome(state: GomokuState): BoardOutcome {
  for (let row = 0; row < state.rows; row += 1) {
    for (let column = 0; column < state.columns; column += 1) {
      const occupant = state.cells[getIndex(state, row, column)];
      if (!occupant) continue;

      if (hasFiveFrom(state, row, column, occupant)) {
        return {
          status: "win",
          winner: occupant,
          loser: getOtherSeat(state.seats, occupant),
          reason: "five-in-row"
        };
      }
    }
  }

  if (state.cells.every(Boolean)) {
    return { status: "draw", reason: "board-full" };
  }

  return { status: "in_progress" };
}

function hasFiveFrom(state: GomokuState, row: number, column: number, seat: SeatId) {
  return winningDirections.some(([rowDelta, columnDelta]) => {
    for (let step = 1; step < 5; step += 1) {
      const nextRow = row + rowDelta * step;
      const nextColumn = column + columnDelta * step;

      if (!isInsideBoard(state, nextRow, nextColumn)) return false;
      if (state.cells[getIndex(state, nextRow, nextColumn)] !== seat) return false;
    }

    return true;
  });
}

function getIndex(state: Pick<GomokuState, "columns">, row: number, column: number) {
  return row * state.columns + column;
}

function isInsideBoard(state: GomokuState, row: number, column: number) {
  return row >= 0 && row < state.rows && column >= 0 && column < state.columns;
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
