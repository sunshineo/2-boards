import { describe, expect, it } from "vitest";

import { dotsBoxesRules, type DotsBoxesState } from "./dotsBoxes";

const seats = ["seat1", "seat2"] as const;

describe("dotsBoxesRules", () => {
  it("creates a three-by-three box grid with no drawn edges", () => {
    const state = dotsBoxesRules.createInitialState({ firstSeat: "seat2", seats });

    expect(dotsBoxesRules.gameType).toBe("dots-boxes");
    expect(state.boxRows).toBe(3);
    expect(state.boxColumns).toBe(3);
    expect(state.drawnEdges).toEqual([]);
    expect(state.boxes).toHaveLength(9);
    expect(state.boxes.every((box) => box === null)).toBe(true);
    expect(state.scores).toEqual({ seat1: 0, seat2: 0 });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(dotsBoxesRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("draws legal edges and alternates seats when no box is completed", () => {
    const state = play(initialState(), "seat1", "h-0-0");

    expect(state.drawnEdges).toEqual(["h-0-0"]);
    expect(state.boxes).toEqual(Array(9).fill(null));
    expect(state.scores).toEqual({ seat1: 0, seat2: 0 });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("rejects invalid edge ids, duplicate edges, and wrong-seat moves", () => {
    const state = play(initialState(), "seat1", "h-0-0");

    expect(dotsBoxesRules.validateMove({ state, seat: "seat2", move: { edge: "h-4-0" } })).toEqual({
      ok: false,
      reason: "edge-out-of-range"
    });
    expect(dotsBoxesRules.validateMove({ state, seat: "seat2", move: { edge: "x-0-0" } })).toEqual({
      ok: false,
      reason: "invalid-edge"
    });
    expect(dotsBoxesRules.validateMove({ state, seat: "seat2", move: { edge: "h-0-0" } })).toEqual({
      ok: false,
      reason: "edge-already-drawn"
    });
    expect(dotsBoxesRules.validateMove({ state, seat: "seat1", move: { edge: "h-0-1" } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });
  });

  it("assigns completed boxes and grants another turn", () => {
    const state = playSequence([
      ["seat1", "h-0-0"],
      ["seat2", "h-0-1"],
      ["seat1", "v-0-0"],
      ["seat2", "h-0-2"],
      ["seat1", "v-0-1"],
      ["seat2", "v-0-3"],
      ["seat1", "h-1-0"]
    ]);

    expect(state.boxes[0]).toBe("seat1");
    expect(state.scores).toEqual({ seat1: 1, seat2: 0 });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual(["seat1"]);
    expect(state.outcome).toEqual({ status: "in_progress" });
  });

  it("assigns multiple boxes completed by one edge", () => {
    const state = dotsBoxesRules.applyMove({
      state: {
        ...initialState(),
        drawnEdges: ["h-0-0", "v-0-0", "h-1-0", "h-0-1", "v-0-2", "h-1-1"],
        nextSeat: "seat1"
      },
      seat: "seat1",
      move: { edge: "v-0-1" }
    });

    expect(state.boxes[0]).toBe("seat1");
    expect(state.boxes[1]).toBe("seat1");
    expect(state.scores).toEqual({ seat1: 2, seat2: 0 });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual(["seat1"]);
  });

  it("declares a winner when the final box is owned by the higher score", () => {
    const state = dotsBoxesRules.applyMove({
      state: {
        ...initialState(),
        drawnEdges: ["h-2-2", "v-2-2", "v-2-3", ...allEdgesExcept("h-3-2", "h-2-2", "v-2-2", "v-2-3")],
        boxes: ["seat1", "seat1", "seat1", "seat1", "seat1", "seat2", "seat2", "seat2", null],
        scores: { seat1: 5, seat2: 3 },
        nextSeat: "seat1"
      },
      seat: "seat1",
      move: { edge: "h-3-2" }
    });

    expect(state.boxes[8]).toBe("seat1");
    expect(state.scores).toEqual({ seat1: 6, seat2: 3 });
    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "more-boxes"
    });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual([]);
  });

  it("declares a draw when the final scores are tied", () => {
    const state = dotsBoxesRules.applyMove({
      state: {
        ...initialState(),
        drawnEdges: allEdgesExcept("h-3-2"),
        boxes: ["seat1", "seat1", "seat1", "seat1", "seat2", "seat2", "seat2", "seat2", "seat1"],
        scores: { seat1: 4, seat2: 4 },
        nextSeat: "seat2"
      },
      seat: "seat2",
      move: { edge: "h-3-2" }
    });

    expect(state.scores).toEqual({ seat1: 4, seat2: 4 });
    expect(state.outcome).toEqual({ status: "draw", reason: "equal-boxes" });
    expect(dotsBoxesRules.getSeatsToAct(state)).toEqual([]);
  });

  it("rejects moves after a board has ended", () => {
    const state: DotsBoxesState = {
      ...initialState(),
      drawnEdges: allEdges(),
      boxes: Array(9).fill("seat1"),
      scores: { seat1: 9, seat2: 0 },
      nextSeat: null,
      outcome: {
        status: "win",
        winner: "seat1",
        loser: "seat2",
        reason: "more-boxes"
      }
    };

    expect(dotsBoxesRules.validateMove({ state, seat: "seat1", move: { edge: "h-0-0" } })).toEqual({
      ok: false,
      reason: "board-not-active"
    });
  });
});

function initialState(): DotsBoxesState {
  return dotsBoxesRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(moves: readonly (readonly ["seat1" | "seat2", string])[]) {
  return moves.reduce((state, [seat, edge]) => play(state, seat, edge), initialState());
}

function play(state: DotsBoxesState, seat: "seat1" | "seat2", edge: string) {
  return dotsBoxesRules.applyMove({ state, seat, move: { edge } });
}

function allEdges(): string[] {
  return [
    ...Array.from({ length: 4 }, (_, row) => Array.from({ length: 3 }, (__, column) => `h-${row}-${column}`)).flat(),
    ...Array.from({ length: 3 }, (_, row) => Array.from({ length: 4 }, (__, column) => `v-${row}-${column}`)).flat()
  ];
}

function allEdgesExcept(...excluded: string[]): string[] {
  const excludedEdges = new Set(excluded);
  return allEdges().filter((edge) => !excludedEdges.has(edge));
}
