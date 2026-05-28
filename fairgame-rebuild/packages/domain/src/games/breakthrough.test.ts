import { describe, expect, it } from "vitest";

import { breakthroughRules, type BreakthroughState } from "./breakthrough";

const seats = ["seat1", "seat2"] as const;

describe("breakthroughRules", () => {
  it("creates an eight-by-eight board with the first two rows assigned to seat1 and last two rows assigned to seat2", () => {
    const state = breakthroughRules.createInitialState({ firstSeat: "seat2", seats });

    expect(breakthroughRules.gameType).toBe("breakthrough");
    expect(state.rows).toBe(8);
    expect(state.columns).toBe(8);
    expect(state.cells).toHaveLength(64);
    expect(row(state, 0)).toEqual(Array(8).fill("seat1"));
    expect(row(state, 1)).toEqual(Array(8).fill("seat1"));
    expect(row(state, 2)).toEqual(Array(8).fill(null));
    expect(row(state, 5)).toEqual(Array(8).fill(null));
    expect(row(state, 6)).toEqual(Array(8).fill("seat2"));
    expect(row(state, 7)).toEqual(Array(8).fill("seat2"));
    expect(breakthroughRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(breakthroughRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("moves pawns forward into an empty square and alternates seats", () => {
    let state = initialState();

    state = play(state, "seat1", index(1, 3), index(2, 3));
    expect(cellAt(state, 1, 3)).toBeNull();
    expect(cellAt(state, 2, 3)).toBe("seat1");
    expect(breakthroughRules.getSeatsToAct(state)).toEqual(["seat2"]);

    state = play(state, "seat2", index(6, 4), index(5, 4));
    expect(cellAt(state, 6, 4)).toBeNull();
    expect(cellAt(state, 5, 4)).toBe("seat2");
    expect(breakthroughRules.getSeatsToAct(state)).toEqual(["seat1"]);
  });

  it("captures diagonally into an opponent-occupied square", () => {
    const state = play(
      {
        ...initialState(),
        cells: withCells([
          [3, 3, "seat1"],
          [4, 4, "seat2"],
          [6, 0, "seat2"]
        ])
      },
      "seat1",
      index(3, 3),
      index(4, 4)
    );

    expect(cellAt(state, 3, 3)).toBeNull();
    expect(cellAt(state, 4, 4)).toBe("seat1");
    expect(breakthroughRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("rejects invalid move coordinates and pawn ownership", () => {
    const state = initialState();

    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: -1, to: index(2, 0) } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(1, 0), to: 64 } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(2, 0), to: index(3, 0) } })).toEqual({
      ok: false,
      reason: "from-empty"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(6, 0), to: index(5, 0) } })).toEqual({
      ok: false,
      reason: "piece-not-owned"
    });
  });

  it("rejects wrong-seat and inactive-board moves", () => {
    const state = initialState();

    expect(breakthroughRules.validateMove({ state, seat: "seat2", move: { from: index(6, 0), to: index(5, 0) } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });

    expect(
      breakthroughRules.validateMove({
        state: {
          ...state,
          nextSeat: null,
          outcome: { status: "win", winner: "seat1", loser: "seat2", reason: "far-rank" }
        },
        seat: "seat1",
        move: { from: index(1, 0), to: index(2, 0) }
      })
    ).toEqual({ ok: false, reason: "board-not-active" });
  });

  it("rejects backward, sideways, occupied-forward, and non-capturing diagonal moves", () => {
    const state = initialState();

    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(1, 0), to: index(0, 0) } })).toEqual({
      ok: false,
      reason: "illegal-direction"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(1, 0), to: index(1, 1) } })).toEqual({
      ok: false,
      reason: "illegal-direction"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(0, 0), to: index(1, 0) } })).toEqual({
      ok: false,
      reason: "forward-destination-occupied"
    });
    expect(breakthroughRules.validateMove({ state, seat: "seat1", move: { from: index(1, 0), to: index(2, 1) } })).toEqual({
      ok: false,
      reason: "diagonal-requires-opponent"
    });
  });

  it("wins when a pawn reaches the far rank", () => {
    const state = play(
      {
        ...initialState(),
        cells: withCells([[6, 2, "seat1"]])
      },
      "seat1",
      index(6, 2),
      index(7, 2)
    );

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "far-rank"
    });
    expect(breakthroughRules.getSeatsToAct(state)).toEqual([]);
  });

  it("wins when the opponent has no pieces left", () => {
    const state = play(
      {
        ...initialState(),
        cells: withCells([
          [3, 3, "seat1"],
          [4, 4, "seat2"]
        ])
      },
      "seat1",
      index(3, 3),
      index(4, 4)
    );

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "opponent-eliminated"
    });
    expect(breakthroughRules.getSeatsToAct(state)).toEqual([]);
  });
});

function initialState(): BreakthroughState {
  return breakthroughRules.createInitialState({ firstSeat: "seat1", seats });
}

function play(state: BreakthroughState, seat: "seat1" | "seat2", from: number, to: number): BreakthroughState {
  return breakthroughRules.applyMove({ state, seat, move: { from, to } });
}

function row(state: BreakthroughState, rowIndex: number) {
  return state.cells.slice(rowIndex * state.columns, rowIndex * state.columns + state.columns);
}

function cellAt(state: BreakthroughState, rowIndex: number, column: number) {
  return state.cells[index(rowIndex, column)];
}

function index(rowIndex: number, column: number) {
  return rowIndex * 8 + column;
}

function withCells(pieces: readonly (readonly [number, number, "seat1" | "seat2"])[]) {
  const cells = Array<"seat1" | "seat2" | null>(64).fill(null);
  for (const [rowIndex, column, seat] of pieces) {
    cells[index(rowIndex, column)] = seat;
  }
  return cells;
}
