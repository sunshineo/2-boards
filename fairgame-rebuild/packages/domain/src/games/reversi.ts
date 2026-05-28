import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type ReversiCell = SeatId | null;

export type ReversiState = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly ReversiCell[];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type ReversiMove = {
  readonly cell: number;
};

export const reversiRows = 8;
export const reversiColumns = 8;

const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
] as const;

export const reversiRules: GameRules<ReversiState, ReversiMove> = {
  gameType: "reversi",

  createInitialState({ firstSeat, seats }) {
    const cells = Array<ReversiCell>(reversiRows * reversiColumns).fill(null);
    cells[getIndex(reversiColumns, 4, 3)] = seats[0];
    cells[getIndex(reversiColumns, 3, 4)] = seats[0];
    cells[getIndex(reversiColumns, 3, 3)] = seats[1];
    cells[getIndex(reversiColumns, 4, 4)] = seats[1];

    return {
      rows: reversiRows,
      columns: reversiColumns,
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

    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell >= state.rows * state.columns) {
      return { ok: false, reason: "cell-out-of-range" };
    }

    if (state.cells[move.cell] !== null) {
      return { ok: false, reason: "cell-occupied" };
    }

    if (getFlippedCells(state, move.cell, seat).length === 0) {
      return { ok: false, reason: "move-does-not-flip" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const flippedCells = getFlippedCells(state, move.cell, seat);
    const cells = [...state.cells];
    cells[move.cell] = seat;
    for (const cell of flippedCells) {
      cells[cell] = seat;
    }

    const nextState = { ...state, cells };
    const otherSeat = getOtherSeat(state.seats, seat);
    if (hasLegalMove(nextState, otherSeat)) {
      return {
        ...nextState,
        nextSeat: otherSeat,
        outcome: { status: "in_progress" }
      };
    }

    if (hasLegalMove(nextState, seat)) {
      return {
        ...nextState,
        nextSeat: seat,
        outcome: { status: "in_progress" }
      };
    }

    return {
      ...nextState,
      nextSeat: null,
      outcome: getFinalOutcome(cells, state.seats)
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

function getFlippedCells(state: ReversiState, cell: number, seat: SeatId): number[] {
  if (cell < 0 || cell >= state.rows * state.columns || state.cells[cell] !== null) {
    return [];
  }

  const row = Math.floor(cell / state.columns);
  const column = cell % state.columns;
  const flippedCells: number[] = [];

  for (const [rowDelta, columnDelta] of directions) {
    const line = getFlippedCellsInDirection(state, row, column, rowDelta, columnDelta, seat);
    flippedCells.push(...line);
  }

  return flippedCells;
}

function getFlippedCellsInDirection(
  state: ReversiState,
  row: number,
  column: number,
  rowDelta: number,
  columnDelta: number,
  seat: SeatId
): number[] {
  const line: number[] = [];
  let nextRow = row + rowDelta;
  let nextColumn = column + columnDelta;

  while (isInsideBoard(state, nextRow, nextColumn)) {
    const nextCell = getIndex(state.columns, nextRow, nextColumn);
    const occupant = state.cells[nextCell];

    if (occupant === null) return [];
    if (occupant === seat) return line.length > 0 ? line : [];

    line.push(nextCell);
    nextRow += rowDelta;
    nextColumn += columnDelta;
  }

  return [];
}

function hasLegalMove(state: ReversiState, seat: SeatId): boolean {
  return state.cells.some((cell, index) => cell === null && getFlippedCells(state, index, seat).length > 0);
}

function getFinalOutcome(cells: readonly ReversiCell[], seats: SeatPair): BoardOutcome {
  const firstSeatCount = countDiscs(cells, seats[0]);
  const secondSeatCount = countDiscs(cells, seats[1]);

  if (firstSeatCount === secondSeatCount) {
    return { status: "draw", reason: "disc-count" };
  }

  const winner = firstSeatCount > secondSeatCount ? seats[0] : seats[1];
  return {
    status: "win",
    winner,
    loser: getOtherSeat(seats, winner),
    reason: "disc-count"
  };
}

function countDiscs(cells: readonly ReversiCell[], seat: SeatId): number {
  return cells.filter((cell) => cell === seat).length;
}

function getIndex(columns: number, row: number, column: number): number {
  return row * columns + column;
}

function isInsideBoard(state: Pick<ReversiState, "rows" | "columns">, row: number, column: number): boolean {
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
