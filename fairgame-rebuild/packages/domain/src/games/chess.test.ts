import { describe, expect, it } from "vitest";

import { chessRules, createChessStateFromFen, getChessPieceAt, type ChessState } from "./chess";

const seats = ["seat1", "seat2"] as const;

describe("chessRules", () => {
  it("creates an initial board with the first seat playing white", () => {
    const state = chessRules.createInitialState({ firstSeat: "seat2", seats });

    expect(state.whiteSeat).toBe("seat2");
    expect(state.blackSeat).toBe("seat1");
    expect(chessRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(getChessPieceAt(state, "e2")).toEqual({ color: "w", type: "p" });
    expect(getChessPieceAt(state, "e7")).toEqual({ color: "b", type: "p" });
  });

  it("applies a legal coordinate move and records history", () => {
    const state = play(initialState(), "seat1", "e2", "e4");

    expect(getChessPieceAt(state, "e4")).toEqual({ color: "w", type: "p" });
    expect(getChessPieceAt(state, "e2")).toBeNull();
    expect(chessRules.getSeatsToAct(state)).toEqual(["seat2"]);
    expect(state.moveHistory[0]).toMatchObject({ from: "e2", to: "e4", san: "e4", seat: "seat1" });
  });

  it("rejects wrong-seat and illegal chess moves", () => {
    const state = initialState();

    expect(chessRules.validateMove({ state, seat: "seat2", move: { from: "e2", to: "e4" } })).toEqual({
      ok: false,
      reason: "seat-not-to-act"
    });
    expect(chessRules.validateMove({ state, seat: "seat1", move: { from: "e2", to: "e5" } })).toEqual({
      ok: false,
      reason: "illegal-move"
    });
  });

  it("detects checkmate as a generic board win", () => {
    const state = playSequence([
      ["seat1", "f2", "f3"],
      ["seat2", "e7", "e5"],
      ["seat1", "g2", "g4"],
      ["seat2", "d8", "h4"]
    ]);

    expect(state.outcome).toEqual({
      status: "win",
      winner: "seat2",
      loser: "seat1",
      reason: "checkmate"
    });
  });

  it("detects stalemate as a generic draw", () => {
    const state = createChessStateFromFen("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1", seats, "seat1");

    expect(chessRules.getOutcome(state)).toEqual({ status: "draw", reason: "stalemate" });
    expect(chessRules.getSeatsToAct(state)).toEqual([]);
  });

  it("supports castling", () => {
    const state = playSequence([
      ["seat1", "e2", "e4"],
      ["seat2", "e7", "e5"],
      ["seat1", "g1", "f3"],
      ["seat2", "b8", "c6"],
      ["seat1", "f1", "c4"],
      ["seat2", "g8", "f6"],
      ["seat1", "e1", "g1"]
    ]);

    expect(getChessPieceAt(state, "g1")).toEqual({ color: "w", type: "k" });
    expect(getChessPieceAt(state, "f1")).toEqual({ color: "w", type: "r" });
  });

  it("supports en passant", () => {
    const state = playSequence([
      ["seat1", "e2", "e4"],
      ["seat2", "a7", "a6"],
      ["seat1", "e4", "e5"],
      ["seat2", "d7", "d5"],
      ["seat1", "e5", "d6"]
    ]);

    expect(getChessPieceAt(state, "d6")).toEqual({ color: "w", type: "p" });
    expect(getChessPieceAt(state, "d5")).toBeNull();
  });

  it("supports promotion", () => {
    const state = createChessStateFromFen("4k3/P7/8/8/8/8/8/7K w - - 0 1", seats, "seat1");
    const promoted = chessRules.applyMove({
      state,
      seat: "seat1",
      move: { from: "a7", to: "a8", promotion: "q" }
    });

    expect(getChessPieceAt(promoted, "a8")).toEqual({ color: "w", type: "q" });
  });
});

function initialState(): ChessState {
  return chessRules.createInitialState({ firstSeat: "seat1", seats });
}

function playSequence(moves: readonly (readonly ["seat1" | "seat2", string, string])[]) {
  return moves.reduce((state, [seat, from, to]) => play(state, seat, from, to), initialState());
}

function play(state: ChessState, seat: "seat1" | "seat2", from: string, to: string): ChessState {
  return chessRules.applyMove({ state, seat, move: { from, to } });
}
