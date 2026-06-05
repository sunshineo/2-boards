import { describe, expect, it, vi } from "vitest";

import {
  browserChessBotPresets,
  createBrowserChessBotController,
  selectBrowserChessBotAction,
  toChessMovePayloadFromUci
} from "./browserChessBot";
import type { ChessBoardView, MatchView, MovePayload } from "./types";

describe("browserChessBot", () => {
  it("maps UCI moves to legal move payloads including promotions", () => {
    const legalMoves = [
      { color: "w", piece: "p", from: "e7", to: "e8", promotion: "q", san: "e8=Q", lan: "e7e8q" },
      { color: "w", piece: "p", from: "e7", to: "e8", promotion: "n", san: "e8=N", lan: "e7e8n" }
    ] as const;

    expect(toChessMovePayloadFromUci("e7e8q", legalMoves)).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(toChessMovePayloadFromUci("e7e8r", legalMoves)).toBeNull();
  });

  it("selects draw and takeback declines before engine search", () => {
    const match = createBotMatch({
      drawOffer: { offeredBy: "seat1" },
      takebackRequest: null,
      seatsToAct: ["seat2"]
    });

    expect(selectBrowserChessBotAction(match)).toEqual({
      kind: "control",
      boardId: "A",
      move: { declineDraw: true }
    });
  });

  it("selects the first board where the bot needs a chess move", () => {
    const match = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"]
    });

    expect(selectBrowserChessBotAction(match)).toMatchObject({ kind: "engine", boardId: "A" });
  });

  it("does not select actions for non-bot matches", () => {
    const match = createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"] });
    delete match.bot;

    expect(selectBrowserChessBotAction(match)).toBeNull();
  });

  it("configures Stockfish with preset skill and movetime", async () => {
    const messages: string[] = [];
    const submitMove = vi.fn(async (_move: { boardId: "A" | "B"; move: MovePayload }) => undefined);
    const controller = createBrowserChessBotController({
      createEngine: () => ({
        post: (message) => messages.push(message),
        nextBestMove: async () => "e7e5",
        dispose: vi.fn()
      }),
      submitMove
    });

    await controller.runForMatch(
      createBotMatch({
        drawOffer: null,
        takebackRequest: null,
        seatsToAct: ["seat2"]
      })
    );

    expect(messages).toContain(`setoption name Skill Level value ${browserChessBotPresets.normal.skillLevel}`);
    expect(messages).toContain("position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");
    expect(messages).toContain(`go movetime ${browserChessBotPresets.normal.moveTimeMs}`);
    expect(submitMove).toHaveBeenCalledWith({ boardId: "A", move: { from: "e7", to: "e5" } });
  });
});

function createBotMatch(options: {
  readonly drawOffer: ChessBoardView["drawOffer"];
  readonly takebackRequest: ChessBoardView["takebackRequest"];
  readonly seatsToAct: ChessBoardView["seatsToAct"];
}): MatchView {
  const board: ChessBoardView = {
    kind: "chess",
    id: "A",
    firstSeat: "seat1",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
    turnColor: "b",
    isCheck: false,
    checkSquare: null,
    moveNumber: 1,
    whiteSeat: "seat1",
    blackSeat: "seat2",
    drawOffer: options.drawOffer,
    takebackRequest: options.takebackRequest,
    squares: [],
    legalMoves: [{ color: "b", piece: "p", from: "e7", to: "e5", san: "e5", lan: "e7e5" }],
    moveHistory: [],
    seatsToAct: options.seatsToAct,
    outcome: { status: "in_progress" }
  };

  return {
    id: "match-bot",
    gameType: "chess",
    gameLabel: "Chess",
    seats: ["seat1", "seat2"],
    joinedSeats: 2,
    maxSeats: 2,
    players: {
      seat1: { label: "Player 1", name: "Player 1" },
      seat2: { label: "Player 2", name: "Stockfish Normal" }
    },
    outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
    clock: null,
    boards: [board],
    bot: {
      seat: "seat2",
      kind: "browser-stockfish",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    }
  };
}
