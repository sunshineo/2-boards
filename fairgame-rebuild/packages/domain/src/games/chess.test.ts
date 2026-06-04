import { describe, expect, it } from "vitest";

import {
  chessRules,
  createChessStateFromFen,
  getChessLegalMoves,
  getChessCheckSquare,
  getChessMoveNumber,
  getChessPieceAt,
  getChessTurnColor,
  isChessInCheck,
  type ChessState
} from "./chess";

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
    expect(state.moveHistory[0]?.fenAfter).toBe(state.fen);
  });

  it("projects legal moves and turn metadata for the UI", () => {
    const state = initialState();

    expect(getChessTurnColor(state)).toBe("w");
    expect(isChessInCheck(state)).toBe(false);
    expect(getChessMoveNumber(state)).toBe(1);
    expect(getChessCheckSquare(state)).toBeNull();
    expect(getChessLegalMoves(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "e2", to: "e4", san: "e4", color: "w", piece: "p" }),
        expect.objectContaining({ from: "g1", to: "f3", san: "Nf3", color: "w", piece: "n" })
      ])
    );
  });

  it("projects the checked king square for board highlighting", () => {
    const state = createChessStateFromFen("4k3/8/8/8/8/8/8/4R2K b - - 0 1", seats, "seat1");

    expect(isChessInCheck(state)).toBe(true);
    expect(getChessTurnColor(state)).toBe("b");
    expect(getChessCheckSquare(state)).toBe("e8");
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

  it("allows either player to resign an unfinished board", () => {
    const state = initialState();
    const resigned = chessRules.applyMove({
      state,
      seat: "seat2",
      move: { resign: true } as never
    });

    expect(resigned.outcome).toEqual({
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "resignation"
    });
    expect(chessRules.getSeatsToAct(resigned)).toEqual([]);
    expect(resigned.moveHistory.at(-1)).toMatchObject({
      seat: "seat2",
      san: "resigns",
      resignation: true
    });
  });

  it("allows a board-local draw offer to be accepted by the opponent", () => {
    const state = initialState();
    const offered = chessRules.applyMove({
      state,
      seat: "seat2",
      move: { drawOffer: true } as never
    });

    expect((offered as ChessState & { drawOffer: unknown }).drawOffer).toEqual({ offeredBy: "seat2" });
    expect(offered.outcome).toEqual({ status: "in_progress" });
    expect(chessRules.getSeatsToAct(offered)).toEqual(["seat1"]);
    expect(offered.moveHistory.at(-1)).toMatchObject({
      seat: "seat2",
      san: "offers draw",
      drawOffer: true
    });

    const accepted = chessRules.applyMove({
      state: offered,
      seat: "seat1",
      move: { acceptDraw: true } as never
    });

    expect((accepted as ChessState & { drawOffer: unknown }).drawOffer).toBeNull();
    expect(accepted.outcome).toEqual({ status: "draw", reason: "agreement" });
    expect(chessRules.getSeatsToAct(accepted)).toEqual([]);
    expect(accepted.moveHistory.at(-1)).toMatchObject({
      seat: "seat1",
      san: "draw agreed",
      drawAccepted: true
    });
  });

  it("allows the opponent to decline a board-local draw offer", () => {
    const state = chessRules.applyMove({
      state: initialState(),
      seat: "seat2",
      move: { drawOffer: true } as never
    });

    const declined = chessRules.applyMove({
      state,
      seat: "seat1",
      move: { declineDraw: true } as never
    });

    expect((declined as ChessState & { drawOffer: unknown }).drawOffer).toBeNull();
    expect(declined.outcome).toEqual({ status: "in_progress" });
    expect(chessRules.getSeatsToAct(declined)).toEqual(["seat1"]);
    expect(declined.moveHistory.at(-1)).toMatchObject({
      seat: "seat1",
      san: "declines draw",
      drawDeclined: true
    });
  });

  it("allows a board-local takeback request to be accepted by the opponent", () => {
    const moved = play(initialState(), "seat1", "e2", "e4");
    const requested = chessRules.applyMove({
      state: moved,
      seat: "seat1",
      move: { requestTakeback: true } as never
    });

    expect((requested as ChessState & { takebackRequest: unknown }).takebackRequest).toEqual({
      requestedBy: "seat1"
    });
    expect(requested.fen).toBe(moved.fen);
    expect(requested.moveHistory.at(-1)).toMatchObject({
      seat: "seat1",
      san: "requests takeback",
      takebackRequest: true
    });

    const accepted = chessRules.applyMove({
      state: requested,
      seat: "seat2",
      move: { acceptTakeback: true } as never
    });

    expect((accepted as ChessState & { takebackRequest: unknown }).takebackRequest).toBeNull();
    expect(accepted.fen).toBe(initialState().fen);
    expect(getChessPieceAt(accepted, "e2")).toEqual({ color: "w", type: "p" });
    expect(getChessPieceAt(accepted, "e4")).toBeNull();
    expect(chessRules.getSeatsToAct(accepted)).toEqual(["seat1"]);
    expect(accepted.moveHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ san: "e4" })]));
    expect(accepted.moveHistory.at(-1)).toMatchObject({
      seat: "seat2",
      san: "takeback accepted",
      takebackAccepted: true
    });
  });

  it("allows the opponent to decline a board-local takeback request", () => {
    const moved = play(initialState(), "seat1", "e2", "e4");
    const requested = chessRules.applyMove({
      state: moved,
      seat: "seat1",
      move: { requestTakeback: true } as never
    });

    const declined = chessRules.applyMove({
      state: requested,
      seat: "seat2",
      move: { declineTakeback: true } as never
    });

    expect((declined as ChessState & { takebackRequest: unknown }).takebackRequest).toBeNull();
    expect(declined.fen).toBe(moved.fen);
    expect(getChessPieceAt(declined, "e4")).toEqual({ color: "w", type: "p" });
    expect(chessRules.getSeatsToAct(declined)).toEqual(["seat2"]);
    expect(declined.moveHistory.at(-1)).toMatchObject({
      seat: "seat2",
      san: "declines takeback",
      takebackDeclined: true
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
