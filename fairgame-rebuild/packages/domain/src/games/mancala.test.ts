import { describe, expect, it } from "vitest";

import { mancalaRules, type MancalaState } from "./mancala";

const seats = ["seat1", "seat2"] as const;

describe("mancalaRules", () => {
  it("creates a six-pit Kalah board with four stones per pit", () => {
    const state = mancalaRules.createInitialState({ firstSeat: "seat2", seats });

    expect(state).toEqual({
      pitsPerSide: 6,
      stonesPerPit: 4,
      pits: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      stores: { seat1: 0, seat2: 0 },
      seats,
      nextSeat: "seat2",
      outcome: { status: "in_progress" }
    });
    expect(mancalaRules.gameType).toBe("mancala");
    expect(mancalaRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("sows from a legal own-side pit and alternates turns", () => {
    const state = play(initialState(), "seat1", 0);

    expect(state.pits).toEqual([0, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4]);
    expect(state.stores).toEqual({ seat1: 0, seat2: 0 });
    expect(mancalaRules.getSeatsToAct(state)).toEqual(["seat2"]);
  });

  it("treats move pits as local indexes on the mover's own side", () => {
    const state = play(mancalaRules.createInitialState({ firstSeat: "seat2", seats }), "seat2", 0);

    expect(state.pits).toEqual([4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 4]);
    expect(state.stores).toEqual({ seat1: 0, seat2: 0 });
    expect(mancalaRules.getSeatsToAct(state)).toEqual(["seat1"]);
  });

  it("rejects out-of-range, empty-pit, wrong-seat, and inactive-board moves", () => {
    const initial = initialState();

    expect(mancalaRules.validateMove({ state: initial, seat: "seat1", move: { pit: -1 } })).toEqual({
      ok: false,
      reason: "pit-out-of-range"
    });
    expect(mancalaRules.validateMove({ state: initial, seat: "seat1", move: { pit: 6 } })).toEqual({
      ok: false,
      reason: "pit-out-of-range"
    });
    expect(mancalaRules.validateMove({ state: initial, seat: "seat2", move: { pit: 0 } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });

    const emptyPitState: MancalaState = { ...initial, pits: [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] };
    expect(mancalaRules.validateMove({ state: emptyPitState, seat: "seat1", move: { pit: 0 } })).toEqual({
      ok: false,
      reason: "pit-empty"
    });

    const completedState: MancalaState = {
      ...initial,
      nextSeat: null,
      outcome: { status: "draw", reason: "stores-tied" }
    };
    expect(mancalaRules.validateMove({ state: completedState, seat: "seat1", move: { pit: 0 } })).toEqual({
      ok: false,
      reason: "board-not-active"
    });
  });

  it("grants another turn when the last stone lands in the mover's store", () => {
    const state = play(
      {
        ...initialState(),
        pits: [1, 0, 4, 0, 0, 0, 4, 4, 4, 4, 4, 4]
      },
      "seat1",
      2
    );

    expect(state.pits).toEqual([1, 0, 0, 1, 1, 1, 4, 4, 4, 4, 4, 4]);
    expect(state.stores).toEqual({ seat1: 1, seat2: 0 });
    expect(mancalaRules.getSeatsToAct(state)).toEqual(["seat1"]);
    expect(state.outcome).toEqual({ status: "in_progress" });
  });

  it("captures opposite stones when the last stone lands in an empty own pit", () => {
    const state = play(
      {
        ...initialState(),
        pits: [1, 0, 1, 0, 0, 0, 0, 0, 7, 0, 0, 1],
        stores: { seat1: 3, seat2: 2 }
      },
      "seat1",
      2
    );

    expect(state.pits).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(state.stores).toEqual({ seat1: 11, seat2: 2 });
    expect(mancalaRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(state.outcome).toEqual({ status: "in_progress" });
  });

  it("skips the opponent store while sowing", () => {
    const state = play(
      {
        ...initialState(),
        pits: [1, 0, 0, 0, 0, 8, 4, 4, 4, 4, 4, 4],
        stores: { seat1: 0, seat2: 0 }
      },
      "seat1",
      5
    );

    expect(state.pits).toEqual([2, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5]);
    expect(state.stores).toEqual({ seat1: 1, seat2: 0 });
  });

  it("sweeps remaining stones and declares a win when a side becomes empty", () => {
    const state = play(
      {
        ...initialState(),
        pits: [0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0],
        stores: { seat1: 10, seat2: 8 }
      },
      "seat1",
      5
    );

    expect(state.pits).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.stores).toEqual({ seat1: 11, seat2: 10 });
    expect(mancalaRules.getSeatsToAct(state)).toEqual([]);
    expect(mancalaRules.getOutcome(state)).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "store-count"
    });
  });

  it("sweeps remaining stones and declares a draw when stores are tied", () => {
    const state = play(
      {
        ...initialState(),
        pits: [0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0],
        stores: { seat1: 10, seat2: 9 }
      },
      "seat1",
      5
    );

    expect(state.pits).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.stores).toEqual({ seat1: 11, seat2: 11 });
    expect(mancalaRules.getOutcome(state)).toEqual({ status: "draw", reason: "stores-tied" });
  });
});

function initialState(): MancalaState {
  return mancalaRules.createInitialState({ firstSeat: "seat1", seats });
}

function play(state: MancalaState, seat: "seat1" | "seat2", pit: number) {
  return mancalaRules.applyMove({ state, seat, move: { pit } });
}
