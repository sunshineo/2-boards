import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type TicTacToeCell = SeatId | null;

export type TicTacToeState = {
  readonly cells: readonly [
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell,
    TicTacToeCell
  ];
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type TicTacToeMove = {
  readonly cell: number;
};

type MutableTicTacToeCells = [
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell,
  TicTacToeCell
];

const emptyCells = [null, null, null, null, null, null, null, null, null] as const;

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
] as const;

export const ticTacToeRules: GameRules<TicTacToeState, TicTacToeMove> = {
  gameType: "tictactoe",

  createInitialState({ firstSeat, seats }) {
    return {
      cells: [...emptyCells],
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

    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8) {
      return { ok: false, reason: "cell-out-of-range" };
    }

    if (state.cells[move.cell] !== null) {
      return { ok: false, reason: "cell-occupied" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const cells = [...state.cells] as MutableTicTacToeCells;
    cells[move.cell] = seat;
    const outcome = getTicTacToeOutcome(cells, state.seats);

    return {
      cells,
      seats: state.seats,
      nextSeat: outcome.status === "in_progress" ? getOtherSeat(state.seats, seat) : null,
      outcome
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

function getTicTacToeOutcome(cells: TicTacToeState["cells"], seats: SeatPair): BoardOutcome {
  for (const [first, second, third] of winningLines) {
    const occupant = cells[first];
    if (occupant && occupant === cells[second] && occupant === cells[third]) {
      return {
        status: "win",
        winner: occupant,
        loser: getOtherSeat(seats, occupant),
        reason: "three-in-row"
      };
    }
  }

  if (cells.every(Boolean)) {
    return { status: "draw", reason: "board-full" };
  }

  return { status: "in_progress" };
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
