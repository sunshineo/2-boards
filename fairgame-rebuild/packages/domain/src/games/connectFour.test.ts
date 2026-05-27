import { describe, expect, it } from "vitest";

import { connectFourRules, type ConnectFourState } from "./connectFour";

const seats = ["seat1", "seat2"] as const;

describe("connectFourRules", () => {
  it("creates a six-row by seven-column board with the first seat to act", () => {
    const state = connectFourRules.createInitialState({ firstSeat: "seat2", seats });

    expect(state.rows).toBe(6);
    expect(state.columns).toBe(7);
    expect(state.cells).toHaveLength(42);
    expect(state.cells.every((cell) => cell === null)).toBe(true);
    expect(connectFourRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(connectFourRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("drops tokens to the lowest empty row in a column", () => {
    const first = play(initialState(), "seat1", 0);
    const second = play(first, "seat2", 0);

    expect(cellAt(second, 5, 0)).toBe("seat1");
    expect(cellAt(second, 4, 0)).toBe("seat2");
    expect(connectFourRules.getSeatsToAct(second)).toEqual(["seat1"]);
  });

  it("rejects wrong-seat moves and full columns", () => {
    let state = initialState();

    expect(connectFourRules.validateMove({ state, seat: "seat2", move: { column: 0 } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });

    for (const seat of ["seat1", "seat2", "seat1", "seat2", "seat1", "seat2"] as const) {
      state = play(state, seat, 0);
    }

    expect(connectFourRules.validateMove({ state, seat: "seat1", move: { column: 0 } })).toEqual({
      ok: false,
      reason: "column-full"
    });
  });

  it("detects a vertical win", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 0]
    ]);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "four-in-row"
    });
  });

  it("detects a horizontal win", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 0],
      ["seat1", 1],
      ["seat2", 1],
      ["seat1", 2],
      ["seat2", 2],
      ["seat1", 3]
    ]);

    expect(state.outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "four-in-row"
    });
  });

  it("detects a diagonal win", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 1],
      ["seat2", 2],
      ["seat1", 4],
      ["seat2", 2],
      ["seat1", 2],
      ["seat2", 3],
      ["seat1", 4],
      ["seat2", 3],
      ["seat1", 5],
      ["seat2", 3],
      ["seat1", 3]
    ]);

    expect(state.outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "four-in-row"
    });
  });

  it("detects a draw when the final move fills the board without four in a row", () => {
    const state = play(
      {
        ...initialState(),
        cells: [
          null,
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat1",
          "seat2",
          "seat2",
          "seat1",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat2",
          "seat2",
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat2",
          "seat1",
          "seat2",
          "seat1",
          "seat1",
          "seat1"
        ],
        nextSeat: "seat1"
      },
      "seat1",
      0
    );

    expect(state.outcome).toEqual({ status: "draw", reason: "board-full" });
    expect(connectFourRules.getSeatsToAct(state)).toEqual([]);
  });
});

function initialState(): ConnectFourState {
  return connectFourRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(moves: readonly (readonly ["seat1" | "seat2", number])[]) {
  return moves.reduce((state, [seat, column]) => play(state, seat, column), initialState());
}

function play(state: ConnectFourState, seat: "seat1" | "seat2", column: number) {
  return connectFourRules.applyMove({ state, seat, move: { column } });
}

function cellAt(state: ConnectFourState, row: number, column: number) {
  return state.cells[row * state.columns + column];
}
