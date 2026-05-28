import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type DotsBoxesBox = SeatId | null;

export type DotsBoxesState = {
  readonly boxRows: number;
  readonly boxColumns: number;
  readonly drawnEdges: readonly string[];
  readonly boxes: readonly DotsBoxesBox[];
  readonly scores: Readonly<Record<SeatId, number>>;
  readonly seats: SeatPair;
  readonly nextSeat: SeatId | null;
  readonly outcome: BoardOutcome;
};

export type DotsBoxesMove = {
  readonly edge: string;
};

type ParsedEdge = {
  readonly orientation: "h" | "v";
  readonly row: number;
  readonly column: number;
};

export const dotsBoxesBoxRows = 3;
export const dotsBoxesBoxColumns = 3;

export const dotsBoxesRules: GameRules<DotsBoxesState, DotsBoxesMove> = {
  gameType: "dots-boxes",

  createInitialState({ firstSeat, seats }) {
    return {
      boxRows: dotsBoxesBoxRows,
      boxColumns: dotsBoxesBoxColumns,
      drawnEdges: [],
      boxes: Array<DotsBoxesBox>(dotsBoxesBoxRows * dotsBoxesBoxColumns).fill(null),
      scores: { seat1: 0, seat2: 0 },
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

    const edge = parseEdge(move.edge);
    if (!edge) {
      return { ok: false, reason: "invalid-edge" };
    }

    if (!isEdgeInsideBoard(state, edge)) {
      return { ok: false, reason: "edge-out-of-range" };
    }

    if (state.drawnEdges.includes(move.edge)) {
      return { ok: false, reason: "edge-already-drawn" };
    }

    return { ok: true };
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const edge = parseEdge(move.edge);
    if (!edge) {
      throw new Error("invalid-edge");
    }

    const drawnEdges = [...state.drawnEdges, move.edge];
    const drawnEdgeSet = new Set(drawnEdges);
    const boxes = [...state.boxes];
    let completedBoxes = 0;

    for (const boxIndex of getAdjacentBoxIndexes(state, edge)) {
      if (boxes[boxIndex] !== null) continue;

      if (isBoxComplete(state, boxIndex, drawnEdgeSet)) {
        boxes[boxIndex] = seat;
        completedBoxes += 1;
      }
    }

    const scores = { ...state.scores };
    scores[seat] += completedBoxes;
    const outcome = getDotsBoxesOutcome({ ...state, boxes, scores });

    return {
      ...state,
      drawnEdges,
      boxes,
      scores,
      nextSeat: getNextSeat(state, seat, completedBoxes, outcome),
      outcome
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

function parseEdge(edge: string): ParsedEdge | null {
  if (typeof edge !== "string") return null;

  const match = /^(h|v)-(0|[1-9]\d*)-(0|[1-9]\d*)$/.exec(edge);
  if (!match) return null;

  return {
    orientation: match[1] as "h" | "v",
    row: Number(match[2]),
    column: Number(match[3])
  };
}

function isEdgeInsideBoard(state: Pick<DotsBoxesState, "boxRows" | "boxColumns">, edge: ParsedEdge) {
  if (edge.orientation === "h") {
    return edge.row >= 0 && edge.row <= state.boxRows && edge.column >= 0 && edge.column < state.boxColumns;
  }

  return edge.row >= 0 && edge.row < state.boxRows && edge.column >= 0 && edge.column <= state.boxColumns;
}

function getAdjacentBoxIndexes(state: Pick<DotsBoxesState, "boxRows" | "boxColumns">, edge: ParsedEdge): number[] {
  if (edge.orientation === "h") {
    return [
      edge.row > 0 ? getBoxIndex(state, edge.row - 1, edge.column) : null,
      edge.row < state.boxRows ? getBoxIndex(state, edge.row, edge.column) : null
    ].filter((index): index is number => index !== null);
  }

  return [
    edge.column > 0 ? getBoxIndex(state, edge.row, edge.column - 1) : null,
    edge.column < state.boxColumns ? getBoxIndex(state, edge.row, edge.column) : null
  ].filter((index): index is number => index !== null);
}

function isBoxComplete(
  state: Pick<DotsBoxesState, "boxColumns">,
  boxIndex: number,
  drawnEdges: ReadonlySet<string>
) {
  const row = Math.floor(boxIndex / state.boxColumns);
  const column = boxIndex % state.boxColumns;

  return getBoxEdges(row, column).every((edge) => drawnEdges.has(edge));
}

function getBoxEdges(row: number, column: number) {
  return [`h-${row}-${column}`, `h-${row + 1}-${column}`, `v-${row}-${column}`, `v-${row}-${column + 1}`];
}

function getBoxIndex(state: Pick<DotsBoxesState, "boxColumns">, row: number, column: number) {
  return row * state.boxColumns + column;
}

function getDotsBoxesOutcome(state: Pick<DotsBoxesState, "boxes" | "scores" | "seats">): BoardOutcome {
  if (state.boxes.some((box) => box === null)) {
    return { status: "in_progress" };
  }

  const [firstSeat, secondSeat] = state.seats;
  const firstScore = state.scores[firstSeat];
  const secondScore = state.scores[secondSeat];

  if (firstScore === secondScore) {
    return { status: "draw", reason: "equal-boxes" };
  }

  const winner = firstScore > secondScore ? firstSeat : secondSeat;
  return {
    status: "win",
    winner,
    loser: getOtherSeat(state.seats, winner),
    reason: "more-boxes"
  };
}

function getNextSeat(
  state: Pick<DotsBoxesState, "seats">,
  seat: SeatId,
  completedBoxes: number,
  outcome: BoardOutcome
): SeatId | null {
  if (outcome.status !== "in_progress") return null;
  return completedBoxes > 0 ? seat : getOtherSeat(state.seats, seat);
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
