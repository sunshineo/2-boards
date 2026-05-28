import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type OrderChaosMark = "X" | "O";
export type OrderChaosCell = OrderChaosMark | null;

export type OrderChaosState = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly OrderChaosCell[];
  readonly seats: SeatPair;
  readonly orderSeat: SeatId;
  readonly chaosSeat: SeatId;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type OrderChaosMove = {
  readonly cell: number;
  readonly mark: OrderChaosMark;
};

const orderChaosRows = 6;
const orderChaosColumns = 6;

const winningDirections = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const;

export const orderChaosRules: GameRules<OrderChaosState, OrderChaosMove> = {
  gameType: "order-chaos",

  createInitialState({ firstSeat, seats }) {
    return {
      rows: orderChaosRows,
      columns: orderChaosColumns,
      cells: Array<OrderChaosCell>(orderChaosRows * orderChaosColumns).fill(null),
      seats,
      orderSeat: seats[0],
      chaosSeat: seats[1],
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

    if (!isOrderChaosMark(move.mark)) {
      return { ok: false, reason: "invalid-mark" };
    }

    if (state.cells[move.cell] !== null) {
      return { ok: false, reason: "cell-occupied" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const cells = [...state.cells];
    cells[move.cell] = move.mark;
    const outcome = getOrderChaosOutcome({ ...state, cells });

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

function getOrderChaosOutcome(state: OrderChaosState): BoardOutcome {
  if (hasFiveInARow(state)) {
    return {
      status: "win",
      winner: state.orderSeat,
      loser: state.chaosSeat,
      reason: "order-five-in-row"
    };
  }

  if (state.cells.every(Boolean)) {
    return {
      status: "win",
      winner: state.chaosSeat,
      loser: state.orderSeat,
      reason: "chaos-board-full"
    };
  }

  return { status: "in_progress" };
}

function hasFiveInARow(state: OrderChaosState): boolean {
  for (let row = 0; row < state.rows; row += 1) {
    for (let column = 0; column < state.columns; column += 1) {
      const cell = state.cells[getIndex(state, row, column)];
      if (!cell) continue;

      if (winningDirections.some(([rowDelta, columnDelta]) => hasFiveFrom(state, row, column, rowDelta, columnDelta, cell))) {
        return true;
      }
    }
  }

  return false;
}

function hasFiveFrom(
  state: OrderChaosState,
  row: number,
  column: number,
  rowDelta: number,
  columnDelta: number,
  mark: OrderChaosMark
): boolean {
  for (let step = 1; step < 5; step += 1) {
    const nextRow = row + rowDelta * step;
    const nextColumn = column + columnDelta * step;

    if (!isInsideBoard(state, nextRow, nextColumn)) return false;
    if (state.cells[getIndex(state, nextRow, nextColumn)] !== mark) return false;
  }

  return true;
}

function getIndex(state: Pick<OrderChaosState, "columns">, row: number, column: number) {
  return row * state.columns + column;
}

function isInsideBoard(state: OrderChaosState, row: number, column: number) {
  return row >= 0 && row < state.rows && column >= 0 && column < state.columns;
}

function isOrderChaosMark(value: unknown): value is OrderChaosMark {
  return value === "X" || value === "O";
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
