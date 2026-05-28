import { describe, expect, it } from "vitest";

import { gomokuRules, type GomokuState } from "./gomoku";

const seats = ["seat1", "seat2"] as const;

describe("gomokuRules", () => {
  it("creates a 15-row by 15-column board with the first seat to act", () => {
    const state = gomokuRules.createInitialState({ firstSeat: "seat2", seats });

    expect(gomokuRules.gameType).toBe("gomoku");
    expect(state.rows).toBe(15);
    expect(state.columns).toBe(15);
    expect(state.cells).toHaveLength(225);
    expect(state.cells.every((cell) => cell === null)).toBe(true);
    expect(gomokuRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(gomokuRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("places one stone on an empty cell and alternates turns", () => {
    const state = play(initialState(), "seat1", 112);

    expect(state.cells[112]).toBe("seat1");
    expect(gomokuRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("rejects occupied cells, out-of-range cells, wrong-seat moves, and inactive-board moves", () => {
    const initial = initialState();
    const next = play(initial, "seat1", 112);

    expect(gomokuRules.validateMove({ state: next, seat: "seat2", move: { cell: 112 } })).toEqual({
      ok: false,
      reason: "cell-occupied"
    });
    expect(gomokuRules.validateMove({ state: initial, seat: "seat2", move: { cell: 0 } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });

    for (const cell of [-1, 225, 1.5]) {
      expect(gomokuRules.validateMove({ state: initial, seat: "seat1", move: { cell } })).toEqual({
        ok: false,
        reason: "cell-out-of-range"
      });
    }

    expect(
      gomokuRules.validateMove({
        state: { ...initial, outcome: { status: "draw", reason: "board-full" } },
        seat: "seat1",
        move: { cell: 0 }
      })
    ).toEqual({ ok: false, reason: "board-not-active" });
  });

  it("detects horizontal five-in-row wins", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 15],
      ["seat1", 1],
      ["seat2", 16],
      ["seat1", 2],
      ["seat2", 17],
      ["seat1", 3],
      ["seat2", 18],
      ["seat1", 4]
    ]);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "five-in-row"
    });
    expect(gomokuRules.getSeatsToAct(state)).toEqual([]);
  });

  it("detects vertical five-in-row wins", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 15],
      ["seat2", 2],
      ["seat1", 30],
      ["seat2", 3],
      ["seat1", 45],
      ["seat2", 4],
      ["seat1", 60]
    ]);

    expect(state.outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "five-in-row"
    });
  });

  it("detects down-right diagonal five-in-row wins", () => {
    const state = playSequence([
      ["seat1", 0],
      ["seat2", 1],
      ["seat1", 16],
      ["seat2", 2],
      ["seat1", 32],
      ["seat2", 3],
      ["seat1", 48],
      ["seat2", 4],
      ["seat1", 64]
    ]);

    expect(state.outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "five-in-row"
    });
  });

  it("detects down-left diagonal five-in-row wins", () => {
    const state = playSequence([
      ["seat1", 4],
      ["seat2", 5],
      ["seat1", 18],
      ["seat2", 6],
      ["seat1", 32],
      ["seat2", 7],
      ["seat1", 46],
      ["seat2", 8],
      ["seat1", 60]
    ]);

    expect(state.outcome).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "five-in-row"
    });
  });

  it("detects a draw when the final move fills the board without five in a row", () => {
    const state = play(
      {
        ...initialState(),
        cells: drawReadyCells(),
        nextSeat: "seat2"
      },
      "seat2",
      224
    );

    expect(state.outcome).toEqual({ status: "draw", reason: "board-full" });
    expect(gomokuRules.getSeatsToAct(state)).toEqual([]);
  });
});

function initialState(): GomokuState {
  return gomokuRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(moves: readonly (readonly ["seat1" | "seat2", number])[]) {
  return moves.reduce((state, [seat, cell]) => play(state, seat, cell), initialState());
}

function play(state: GomokuState, seat: "seat1" | "seat2", cell: number): GomokuState {
  return gomokuRules.applyMove({ state, seat, move: { cell } });
}

function drawReadyCells(): GomokuState["cells"] {
  return Array.from({ length: 225 }, (_, cell) => {
    if (cell === 224) return null;

    const row = Math.floor(cell / 15);
    const column = cell % 15;
    return (Math.floor(column / 4) % 2) ^ (row % 2) ? "seat2" : "seat1";
  });
}
