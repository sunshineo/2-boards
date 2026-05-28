import { describe, expect, it } from "vitest";

import { reversiRules, type ReversiState } from "./reversi";

const seats = ["seat1", "seat2"] as const;

describe("reversiRules", () => {
  it("creates an eight-by-eight board with the initial four centered discs", () => {
    const state = initialState();

    expect(reversiRules.gameType).toBe("reversi");
    expect(state.rows).toBe(8);
    expect(state.columns).toBe(8);
    expect(state.cells).toHaveLength(64);
    expect(state.cells[index(4, 3)]).toBe("seat1");
    expect(state.cells[index(3, 4)]).toBe("seat1");
    expect(state.cells[index(3, 3)]).toBe("seat2");
    expect(state.cells[index(4, 4)]).toBe("seat2");
    expect(state.cells.filter(Boolean)).toHaveLength(4);
    expect(reversiRules.getSeatsToAct(state)).toEqual(["seat1"]);
    expect(reversiRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("applies legal moves and flips every bracketed line", () => {
    const state = play(initialState(), "seat1", index(3, 2));

    expect(state.cells[index(3, 2)]).toBe("seat1");
    expect(state.cells[index(3, 3)]).toBe("seat1");
    expect(reversiRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("flips bracketed discs in all eight directions", () => {
    const cells = Array<ReversiState["cells"][number]>(64).fill(null);
    for (const [row, column] of [
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 2],
      [3, 4],
      [4, 2],
      [4, 3],
      [4, 4]
    ]) {
      cells[index(row, column)] = "seat2";
    }
    for (const [row, column] of [
      [1, 1],
      [1, 3],
      [1, 5],
      [3, 1],
      [3, 5],
      [5, 1],
      [5, 3],
      [5, 5]
    ]) {
      cells[index(row, column)] = "seat1";
    }

    const state = play({ ...initialState(), cells, nextSeat: "seat1" }, "seat1", index(3, 3));

    expect(state.cells[index(3, 3)]).toBe("seat1");
    for (const [row, column] of [
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 2],
      [3, 4],
      [4, 2],
      [4, 3],
      [4, 4]
    ]) {
      expect(state.cells[index(row, column)]).toBe("seat1");
    }
  });

  it("rejects wrong-seat, out-of-range, occupied, non-flipping, and inactive-board moves", () => {
    const state = initialState();

    expect(reversiRules.validateMove({ state, seat: "seat2", move: { cell: index(3, 2) } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });
    expect(reversiRules.validateMove({ state, seat: "seat1", move: { cell: -1 } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(reversiRules.validateMove({ state, seat: "seat1", move: { cell: 64 } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(reversiRules.validateMove({ state, seat: "seat1", move: { cell: index(3, 3) } })).toEqual({
      ok: false,
      reason: "cell-occupied"
    });
    expect(reversiRules.validateMove({ state, seat: "seat1", move: { cell: index(0, 0) } })).toEqual({
      ok: false,
      reason: "move-does-not-flip"
    });

    expect(
      reversiRules.validateMove({
        state: {
          ...state,
          nextSeat: null,
          outcome: { status: "draw", reason: "disc-count" }
        },
        seat: "seat1",
        move: { cell: index(3, 2) }
      })
    ).toEqual({ ok: false, reason: "board-not-active" });
  });

  it("passes the turn back to the mover when the opponent has no legal move", () => {
    const cells = Array<ReversiState["cells"][number]>(64).fill("seat1");
    cells[0] = null;
    cells[1] = "seat2";
    cells[62] = "seat2";
    cells[63] = null;

    const state = play({ ...initialState(), cells, nextSeat: "seat1" }, "seat1", 0);

    expect(state.cells[1]).toBe("seat1");
    expect(reversiRules.getSeatsToAct(state)).toEqual(["seat1"]);
    expect(reversiRules.validateMove({ state, seat: "seat1", move: { cell: 63 } })).toEqual({
      ok: true
    });
    expect(reversiRules.validateMove({ state, seat: "seat2", move: { cell: 63 } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });
  });

  it("ends with a win by disc count when neither seat has a legal move", () => {
    const cells = Array<ReversiState["cells"][number]>(64).fill("seat1");
    cells[0] = null;
    cells[1] = "seat2";

    const state = play({ ...initialState(), cells, nextSeat: "seat1" }, "seat1", 0);

    expect(reversiRules.getSeatsToAct(state)).toEqual([]);
    expect(reversiRules.getOutcome(state)).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "disc-count"
    });
  });

  it("ends with a draw when final disc counts are equal", () => {
    const cells = Array<ReversiState["cells"][number]>(64).fill("seat2");
    cells[0] = null;
    cells[1] = "seat2";
    cells[2] = "seat1";
    for (let cell = 3; cell <= 31; cell += 1) {
      cells[cell] = "seat1";
    }

    const state = play({ ...initialState(), cells, nextSeat: "seat1" }, "seat1", 0);

    expect(reversiRules.getOutcome(state)).toEqual({ status: "draw", reason: "disc-count" });
    expect(state.cells.filter((cell) => cell === "seat1")).toHaveLength(32);
    expect(state.cells.filter((cell) => cell === "seat2")).toHaveLength(32);
  });
});

function initialState(): ReversiState {
  return reversiRules.createInitialState({ firstSeat: "seat1", seats });
}

function play(state: ReversiState, seat: "seat1" | "seat2", cell: number): ReversiState {
  return reversiRules.applyMove({ state, seat, move: { cell } });
}

function index(row: number, column: number): number {
  return row * 8 + column;
}
