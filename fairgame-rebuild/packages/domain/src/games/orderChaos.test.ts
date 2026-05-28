import { describe, expect, it } from "vitest";

import { orderChaosRules, type OrderChaosMark, type OrderChaosState } from "./orderChaos";

const seats = ["seat1", "seat2"] as const;

describe("orderChaosRules", () => {
  it("creates a six by six board with fixed Order and Chaos seats", () => {
    const state = orderChaosRules.createInitialState({ firstSeat: "seat2", seats });

    expect(state.rows).toBe(6);
    expect(state.columns).toBe(6);
    expect(state.cells).toHaveLength(36);
    expect(state.cells.every((cell) => cell === null)).toBe(true);
    expect(state.orderSeat).toBe("seat1");
    expect(state.chaosSeat).toBe("seat2");
    expect(orderChaosRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(orderChaosRules.getOutcome(state)).toEqual({ status: "in_progress" });
  });

  it("lets either player place either mark and alternates seats", () => {
    let state = initialState();

    state = play(state, "seat1", 0, "O");
    state = play(state, "seat2", 1, "X");

    expect(state.cells[0]).toBe("O");
    expect(state.cells[1]).toBe("X");
    expect(orderChaosRules.getSeatsToAct(state)).toEqual(["seat1"]);
  });

  it("rejects occupied cells, invalid marks, and wrong-seat moves", () => {
    const state = play(initialState(), "seat1", 0, "X");

    expect(orderChaosRules.validateMove({ state, seat: "seat2", move: { cell: 0, mark: "O" } })).toEqual({
      ok: false,
      reason: "cell-occupied"
    });
    expect(orderChaosRules.validateMove({ state, seat: "seat2", move: { cell: 1, mark: "Z" } as never })).toEqual({
      ok: false,
      reason: "invalid-mark"
    });
    expect(orderChaosRules.validateMove({ state, seat: "seat1", move: { cell: 1, mark: "X" } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });
  });

  it("gives Order a win for five matching contiguous marks", () => {
    const state = playSequence([
      ["seat1", 0, "X"],
      ["seat2", 6, "O"],
      ["seat1", 1, "X"],
      ["seat2", 7, "O"],
      ["seat1", 2, "X"],
      ["seat2", 8, "O"],
      ["seat1", 3, "X"],
      ["seat2", 9, "O"],
      ["seat1", 4, "X"]
    ]);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "order-five-in-row"
    });
    expect(orderChaosRules.getSeatsToAct(state)).toEqual([]);
  });

  it("gives Chaos a win when the board fills without five in a row", () => {
    const pattern: readonly OrderChaosMark[] = [
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O",
      "X",
      "X",
      "O",
      "O"
    ];

    const state = pattern.reduce(
      (current, mark, cell) => play(current, cell % 2 === 0 ? "seat1" : "seat2", cell, mark),
      initialState()
    );

    expect(state.cells).toEqual(pattern);
    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat2",
      loser: "seat1",
      reason: "chaos-board-full"
    });
  });
});

function initialState(): OrderChaosState {
  return orderChaosRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(moves: readonly (readonly ["seat1" | "seat2", number, OrderChaosMark])[]) {
  return moves.reduce((state, [seat, cell, mark]) => play(state, seat, cell, mark), initialState());
}

function play(state: OrderChaosState, seat: "seat1" | "seat2", cell: number, mark: OrderChaosMark) {
  return orderChaosRules.applyMove({ state, seat, move: { cell, mark } });
}
