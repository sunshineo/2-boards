import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type HexCell = SeatId | null;

export type HexState = {
  readonly size: number;
  readonly cells: readonly HexCell[];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type HexMove = {
  readonly cell: number;
};

export const hexBoardSize = 11;

const neighborDeltas = [
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0]
] as const;

export const hexRules: GameRules<HexState, HexMove> = {
  gameType: "hex",

  createInitialState({ firstSeat, seats }) {
    return {
      size: hexBoardSize,
      cells: Array<HexCell>(hexBoardSize * hexBoardSize).fill(null),
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

    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell >= state.size * state.size) {
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
    const outcome = getHexOutcome({ ...state, cells });

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

function getHexOutcome(state: HexState): BoardOutcome {
  const [seat1, seat2] = state.seats;

  if (hasTopBottomConnection(state, seat1)) {
    return {
      status: "win",
      winner: seat1,
      loser: seat2,
      reason: "connected-top-bottom"
    };
  }

  if (hasLeftRightConnection(state, seat2)) {
    return {
      status: "win",
      winner: seat2,
      loser: seat1,
      reason: "connected-left-right"
    };
  }

  if (state.cells.every((cell) => cell !== null)) {
    return { status: "draw", reason: "board-full" };
  }

  return { status: "in_progress" };
}

function hasTopBottomConnection(state: HexState, seat: SeatId): boolean {
  return hasConnection(
    state,
    seat,
    (index) => getRow(state, index) === 0,
    (index) => getRow(state, index) === state.size - 1
  );
}

function hasLeftRightConnection(state: HexState, seat: SeatId): boolean {
  return hasConnection(
    state,
    seat,
    (index) => getColumn(state, index) === 0,
    (index) => getColumn(state, index) === state.size - 1
  );
}

function hasConnection(
  state: HexState,
  seat: SeatId,
  isStart: (index: number) => boolean,
  isGoal: (index: number) => boolean
): boolean {
  const visited = new Set<number>();
  const stack: number[] = [];

  for (let index = 0; index < state.cells.length; index += 1) {
    if (state.cells[index] === seat && isStart(index)) {
      stack.push(index);
      visited.add(index);
    }
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) continue;
    if (isGoal(index)) return true;

    for (const neighbor of getNeighbors(state, index)) {
      if (visited.has(neighbor)) continue;
      if (state.cells[neighbor] !== seat) continue;

      visited.add(neighbor);
      stack.push(neighbor);
    }
  }

  return false;
}

function getNeighbors(state: HexState, index: number): number[] {
  const row = getRow(state, index);
  const column = getColumn(state, index);
  const neighbors: number[] = [];

  for (const [rowDelta, columnDelta] of neighborDeltas) {
    const nextRow = row + rowDelta;
    const nextColumn = column + columnDelta;
    if (isInsideBoard(state, nextRow, nextColumn)) {
      neighbors.push(getIndex(state, nextRow, nextColumn));
    }
  }

  return neighbors;
}

function getRow(state: Pick<HexState, "size">, index: number): number {
  return Math.floor(index / state.size);
}

function getColumn(state: Pick<HexState, "size">, index: number): number {
  return index % state.size;
}

function getIndex(state: Pick<HexState, "size">, row: number, column: number): number {
  return row * state.size + column;
}

function isInsideBoard(state: Pick<HexState, "size">, row: number, column: number): boolean {
  return row >= 0 && row < state.size && column >= 0 && column < state.size;
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
