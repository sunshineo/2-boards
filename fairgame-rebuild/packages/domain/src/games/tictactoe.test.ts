import { describe, expect, it } from "vitest";

import { applyMoveToMatch, createFairMatch } from "../engine";
import { getMatchOutcome } from "../scoring";
import { ticTacToeRules, type TicTacToeMove, type TicTacToeState } from "./tictactoe";

function play(state: TicTacToeState, seat: "seat1" | "seat2", cell: number): TicTacToeState {
  const move: TicTacToeMove = { cell };
  const validation = ticTacToeRules.validateMove({ state, seat, move });
  if (!validation.ok) throw new Error(validation.reason);
  return ticTacToeRules.applyMove({ state, seat, move });
}

describe("ticTacToeRules", () => {
  it("starts with the requested first seat", () => {
    const state = ticTacToeRules.createInitialState({
      firstSeat: "seat2",
      seats: ["seat1", "seat2"]
    });

    expect(ticTacToeRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(state.cells).toEqual([null, null, null, null, null, null, null, null, null]);
  });

  it("applies legal moves and alternates seats", () => {
    const initial = ticTacToeRules.createInitialState({
      firstSeat: "seat1",
      seats: ["seat1", "seat2"]
    });

    const next = play(initial, "seat1", 0);

    expect(next.cells[0]).toBe("seat1");
    expect(ticTacToeRules.getSeatsToAct(next)).toEqual(["seat2"]);
  });

  it("rejects occupied cells", () => {
    const initial = ticTacToeRules.createInitialState({
      firstSeat: "seat1",
      seats: ["seat1", "seat2"]
    });
    const next = play(initial, "seat1", 0);

    expect(
      ticTacToeRules.validateMove({
        state: next,
        seat: "seat2",
        move: { cell: 0 }
      })
    ).toEqual({ ok: false, reason: "cell-occupied" });
  });

  it("detects row wins", () => {
    let state = ticTacToeRules.createInitialState({ firstSeat: "seat1", seats: ["seat1", "seat2"] });
    state = play(state, "seat1", 0);
    state = play(state, "seat2", 3);
    state = play(state, "seat1", 1);
    state = play(state, "seat2", 4);
    state = play(state, "seat1", 2);

    expect(ticTacToeRules.getOutcome(state)).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "three-in-row"
    });
  });

  it("detects column wins", () => {
    let state = ticTacToeRules.createInitialState({ firstSeat: "seat1", seats: ["seat1", "seat2"] });
    state = play(state, "seat1", 0);
    state = play(state, "seat2", 1);
    state = play(state, "seat1", 3);
    state = play(state, "seat2", 2);
    state = play(state, "seat1", 6);

    expect(ticTacToeRules.getOutcome(state)).toMatchObject({
      status: "win",
      winner: "seat1",
      reason: "three-in-row"
    });
  });

  it("detects diagonal wins", () => {
    let state = ticTacToeRules.createInitialState({ firstSeat: "seat2", seats: ["seat1", "seat2"] });
    state = play(state, "seat2", 0);
    state = play(state, "seat1", 1);
    state = play(state, "seat2", 4);
    state = play(state, "seat1", 2);
    state = play(state, "seat2", 8);

    expect(ticTacToeRules.getOutcome(state)).toMatchObject({
      status: "win",
      winner: "seat2",
      reason: "three-in-row"
    });
  });

  it("detects draws", () => {
    let state = ticTacToeRules.createInitialState({ firstSeat: "seat1", seats: ["seat1", "seat2"] });
    state = play(state, "seat1", 0);
    state = play(state, "seat2", 1);
    state = play(state, "seat1", 2);
    state = play(state, "seat2", 4);
    state = play(state, "seat1", 3);
    state = play(state, "seat2", 5);
    state = play(state, "seat1", 7);
    state = play(state, "seat2", 6);
    state = play(state, "seat1", 8);

    expect(ticTacToeRules.getOutcome(state)).toEqual({ status: "draw", reason: "board-full" });
    expect(ticTacToeRules.getSeatsToAct(state)).toEqual([]);
  });

  it("integrates with the fair match engine wrong-seat rejection", () => {
    const match = createFairMatch({ id: "match-1", rules: ticTacToeRules });
    const result = applyMoveToMatch(match, ticTacToeRules, {
      boardId: "A",
      seat: "seat2",
      move: { cell: 0 }
    });

    expect(result).toEqual({ ok: false, reason: "seat-not-to-act", match });
  });

  it("scores a two-board TicTacToe match", () => {
    let match = createFairMatch({ id: "match-1", rules: ticTacToeRules });

    for (const command of [
      { boardId: "A" as const, seat: "seat1" as const, move: { cell: 0 } },
      { boardId: "A" as const, seat: "seat2" as const, move: { cell: 3 } },
      { boardId: "A" as const, seat: "seat1" as const, move: { cell: 1 } },
      { boardId: "A" as const, seat: "seat2" as const, move: { cell: 4 } },
      { boardId: "A" as const, seat: "seat1" as const, move: { cell: 2 } },
      { boardId: "B" as const, seat: "seat2" as const, move: { cell: 0 } },
      { boardId: "B" as const, seat: "seat1" as const, move: { cell: 3 } },
      { boardId: "B" as const, seat: "seat2" as const, move: { cell: 1 } },
      { boardId: "B" as const, seat: "seat1" as const, move: { cell: 4 } },
      { boardId: "B" as const, seat: "seat2" as const, move: { cell: 2 } }
    ]) {
      const result = applyMoveToMatch(match, ticTacToeRules, command);
      if (!result.ok) throw new Error(result.reason);
      match = result.match;
    }

    expect(getMatchOutcome(match)).toEqual({
      status: "completed",
      score: { seat1: 1, seat2: 1 },
      winner: null
    });
  });
});
