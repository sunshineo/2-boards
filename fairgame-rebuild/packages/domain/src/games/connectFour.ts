import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type ConnectFourCell = SeatId | null;

export type ConnectFourState = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly ConnectFourCell[];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type ConnectFourMove = {
  readonly column: number;
};

export const connectFourRows = 6;
export const connectFourColumns = 7;

const winningDirections = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const;

export const connectFourRules: GameRules<ConnectFourState, ConnectFourMove> = {
  gameType: "connect4",

  createInitialState({ firstSeat, seats }) {
    return {
      rows: connectFourRows,
      columns: connectFourColumns,
      cells: Array<ConnectFourCell>(connectFourRows * connectFourColumns).fill(null),
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

    if (!Number.isInteger(move.column) || move.column < 0 || move.column >= state.columns) {
      return { ok: false, reason: "column-out-of-range" };
    }

    if (getDropRow(state, move.column) === null) {
      return { ok: false, reason: "column-full" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const dropRow = getDropRow(state, move.column);
    if (dropRow === null) {
      throw new Error("column-full");
    }

    const cells = [...state.cells];
    cells[getIndex(state, dropRow, move.column)] = seat;
    const outcome = getConnectFourOutcome({ ...state, cells });

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

function getConnectFourOutcome(state: ConnectFourState): BoardOutcome {
  for (let row = 0; row < state.rows; row += 1) {
    for (let column = 0; column < state.columns; column += 1) {
      const occupant = state.cells[getIndex(state, row, column)];
      if (!occupant) continue;

      if (hasFourFrom(state, row, column, occupant)) {
        return {
          status: "win",
          winner: occupant,
          loser: getOtherSeat(state.seats, occupant),
          reason: "four-in-row"
        };
      }
    }
  }

  if (state.cells.every(Boolean)) {
    return { status: "draw", reason: "board-full" };
  }

  return { status: "in_progress" };
}

function hasFourFrom(state: ConnectFourState, row: number, column: number, seat: SeatId) {
  return winningDirections.some(([rowDelta, columnDelta]) => {
    for (let step = 1; step < 4; step += 1) {
      const nextRow = row + rowDelta * step;
      const nextColumn = column + columnDelta * step;

      if (!isInsideBoard(state, nextRow, nextColumn)) return false;
      if (state.cells[getIndex(state, nextRow, nextColumn)] !== seat) return false;
    }

    return true;
  });
}

function getDropRow(state: ConnectFourState, column: number): number | null {
  for (let row = state.rows - 1; row >= 0; row -= 1) {
    if (state.cells[getIndex(state, row, column)] === null) return row;
  }

  return null;
}

function getIndex(state: Pick<ConnectFourState, "columns">, row: number, column: number) {
  return row * state.columns + column;
}

function isInsideBoard(state: ConnectFourState, row: number, column: number) {
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
