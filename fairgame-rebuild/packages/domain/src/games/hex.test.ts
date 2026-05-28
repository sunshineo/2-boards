import { describe, expect, it } from "vitest";

import { hexRules, type HexMove, type HexState } from "./hex";

const seats = ["seat1", "seat2"] as const;

describe("hexRules", () => {
  it("creates an eleven-by-eleven board with the requested first seat to act", () => {
    const state = hexRules.createInitialState({ firstSeat: "seat2", seats });

    expect(hexRules.gameType).toBe("hex");
    expect(state.size).toBe(11);
    expect(state.cells).toHaveLength(121);
    expect(state.cells.every((cell) => cell === null)).toBe(true);
    expect(state.seats).toBe(seats);
    expect(hexRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(hexRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("places one stone on an empty cell and alternates seats", () => {
    const state = play(initialState(), "seat1", 60);

    expect(state.cells[60]).toBe("seat1");
    expect(hexRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("rejects out-of-range, occupied, wrong-seat, and inactive-board moves", () => {
    const initial = initialState();

    expect(hexRules.validateMove({ state: initial, seat: "seat1", move: { cell: -1 } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(hexRules.validateMove({ state: initial, seat: "seat1", move: { cell: 121 } })).toEqual({
      ok: false,
      reason: "cell-out-of-range"
    });
    expect(hexRules.validateMove({ state: initial, seat: "seat2", move: { cell: 0 } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });

    const next = play(initial, "seat1", 0);
    expect(hexRules.validateMove({ state: next, seat: "seat2", move: { cell: 0 } })).toEqual({
      ok: false,
      reason: "cell-occupied"
    });

    expect(
      hexRules.validateMove({
        state: { ...next, outcome: { status: "draw", reason: "board-full" } },
        seat: "seat2",
        move: { cell: 1 }
      })
    ).toEqual({ ok: false, reason: "board-not-active" });
  });

  it("detects a seat1 top-to-bottom connection", () => {
    const moves: readonly (readonly ["seat1" | "seat2", number])[] = [
      ["seat1", 0],
      ["seat2", 10],
      ["seat1", 11],
      ["seat2", 21],
      ["seat1", 22],
      ["seat2", 32],
      ["seat1", 33],
      ["seat2", 43],
      ["seat1", 44],
      ["seat2", 54],
      ["seat1", 55],
      ["seat2", 65],
      ["seat1", 66],
      ["seat2", 76],
      ["seat1", 77],
      ["seat2", 87],
      ["seat1", 88],
      ["seat2", 98],
      ["seat1", 99],
      ["seat2", 109],
      ["seat1", 110]
    ];

    const state = playSequence(initialState(), moves);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "connected-top-bottom"
    });
    expect(hexRules.getSeatsToAct(state)).toEqual([]);
  });

  it("detects a seat2 left-to-right connection", () => {
    const state = playSequence(hexRules.createInitialState({ firstSeat: "seat2", seats }), [
      ["seat2", 0],
      ["seat1", 110],
      ["seat2", 1],
      ["seat1", 111],
      ["seat2", 2],
      ["seat1", 112],
      ["seat2", 3],
      ["seat1", 113],
      ["seat2", 4],
      ["seat1", 114],
      ["seat2", 5],
      ["seat1", 115],
      ["seat2", 6],
      ["seat1", 116],
      ["seat2", 7],
      ["seat1", 117],
      ["seat2", 8],
      ["seat1", 118],
      ["seat2", 9],
      ["seat1", 119],
      ["seat2", 10]
    ]);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat2",
      loser: "seat1",
      reason: "connected-left-right"
    });
    expect(hexRules.getSeatsToAct(state)).toEqual([]);
  });

  it("draws when the board becomes full without a detected connection", () => {
    const blockedCells = Array.from({ length: 121 }, () => "blocked") as unknown as HexState["cells"];
    const cells = [...blockedCells];
    cells[60] = null;
    const state: HexState = {
      ...initialState(),
      cells,
      nextSeat: "seat1"
    };

    const next = play(state, "seat1", 60);

    expect(next.outcome).toEqual({ status: "draw", reason: "board-full" });
    expect(hexRules.getSeatsToAct(next)).toEqual([]);
  });
});

function initialState(): HexState {
  return hexRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(state: HexState, moves: readonly (readonly ["seat1" | "seat2", number])[]) {
  return moves.reduce((nextState, [seat, cell]) => play(nextState, seat, cell), state);
}

function play(state: HexState, seat: "seat1" | "seat2", cell: number): HexState {
  const move: HexMove = { cell };
  const validation = hexRules.validateMove({ state, seat, move });
  if (!validation.ok) throw new Error(validation.reason);
  return hexRules.applyMove({ state, seat, move });
}
