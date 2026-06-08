import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createBrowserChessBotController,
  createBrowserGameBotController,
  getBrowserChessBotTiming,
  selectBrowserChessBotAction,
  toChessMovePayloadFromUci
} from "./browserChessBot";
import type { ChessBoardView, ConnectFourBoardView, MatchView, MovePayload } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

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
    vi.useFakeTimers();
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
    const match = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"],
      clockInitialMs: 300_000
    });
    const timing = getBrowserChessBotTiming(match);

    const runPromise = controller.runForMatch(match);
    await Promise.resolve();

    expect(messages).toContain(`setoption name Skill Level value ${timing.skillLevel}`);
    expect(messages).toContain("position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");
    expect(messages).toContain(`go movetime ${timing.maximumMoveTimeMs}`);
    expect(submitMove).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(timing.minimumMoveTimeMs);
    await runPromise;

    expect(submitMove).toHaveBeenCalledWith({ boardId: "A", move: { from: "e7", to: "e5" } });
  });

  it("scales bot search time and minimum delay by difficulty and game clock", () => {
    const shortEasyMatch = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"],
      clockInitialMs: 180_000
    });
    if (!shortEasyMatch.bot) throw new Error("Missing bot fixture");
    shortEasyMatch.bot.difficulty = "easy";

    expect(getBrowserChessBotTiming(shortEasyMatch)).toMatchObject({
      minimumMoveTimeMs: 600,
      maximumMoveTimeMs: 1_200
    });

    expect(
      getBrowserChessBotTiming(
        createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"], clockInitialMs: 180_000 })
      )
    ).toMatchObject({ minimumMoveTimeMs: 1_050, maximumMoveTimeMs: 2_100 });
    expect(
      getBrowserChessBotTiming(
        createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"], clockInitialMs: 300_000 })
      )
    ).toMatchObject({ minimumMoveTimeMs: 1_400, maximumMoveTimeMs: 2_800 });
    expect(
      getBrowserChessBotTiming(
        createBotMatch({ drawOffer: null, takebackRequest: null, seatsToAct: ["seat2"], clockInitialMs: 600_000 })
      )
    ).toMatchObject({ minimumMoveTimeMs: 1_750, maximumMoveTimeMs: 3_500 });

    const hardMatch = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"],
      clockInitialMs: 600_000
    });
    if (!hardMatch.bot) throw new Error("Missing bot fixture");
    hardMatch.bot.difficulty = "hard";

    expect(getBrowserChessBotTiming(hardMatch)).toMatchObject({ minimumMoveTimeMs: 2_500, maximumMoveTimeMs: 5_000 });
  });

  it("waits at least the minimum delay when a hard bot engine returns immediately", async () => {
    vi.useFakeTimers();
    const submitMove = vi.fn(async (_move: { boardId: "A" | "B"; move: MovePayload }) => undefined);
    const controller = createBrowserChessBotController({
      createEngine: () => ({
        post: vi.fn(),
        nextBestMove: async () => "e7e5",
        dispose: vi.fn()
      }),
      submitMove
    });
    const match = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"],
      clockInitialMs: 300_000
    });
    if (!match.bot) throw new Error("Missing bot fixture");
    match.bot.difficulty = "hard";
    const timing = getBrowserChessBotTiming(match);

    const runPromise = controller.runForMatch(match);
    await Promise.resolve();

    expect(submitMove).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(timing.minimumMoveTimeMs - 1);
    expect(submitMove).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await runPromise;

    expect(submitMove).toHaveBeenCalledWith({ boardId: "A", move: { from: "e7", to: "e5" } });
  });

  it("submits after the engine finishes once the minimum delay has elapsed", async () => {
    vi.useFakeTimers();
    const submitMove = vi.fn(async (_move: { boardId: "A" | "B"; move: MovePayload }) => undefined);
    const controller = createBrowserChessBotController({
      createEngine: () => ({
        post: vi.fn(),
        nextBestMove: () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve("e7e5"), 2_300);
          }),
        dispose: vi.fn()
      }),
      submitMove
    });
    const match = createBotMatch({
      drawOffer: null,
      takebackRequest: null,
      seatsToAct: ["seat2"],
      clockInitialMs: 300_000
    });
    if (!match.bot) throw new Error("Missing bot fixture");
    match.bot.difficulty = "hard";

    const runPromise = controller.runForMatch(match);
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(2_299);
    expect(submitMove).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(submitMove).toHaveBeenCalledWith({ boardId: "A", move: { from: "e7", to: "e5" } });

    await runPromise;
  });

  it("submits random-legal moves for a Connect Four automated seat", async () => {
    vi.useFakeTimers();
    const submitted: { boardId: "A" | "B"; move: MovePayload }[] = [];
    const controller = createBrowserGameBotController({
      submitMove: async (input) => {
        submitted.push(input);
      }
    });

    const runPromise = controller.runForMatch(createConnectFourBotMatch());
    await Promise.resolve();

    expect(submitted).toEqual([]);

    await vi.advanceTimersByTimeAsync(250);
    await runPromise;

    expect(submitted).toEqual([{ boardId: "B", move: { column: 0 } }]);
  });
});

function createBotMatch(options: {
  readonly drawOffer: ChessBoardView["drawOffer"];
  readonly takebackRequest: ChessBoardView["takebackRequest"];
  readonly seatsToAct: ChessBoardView["seatsToAct"];
  readonly clockInitialMs?: number | null;
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
    clock:
      options.clockInitialMs === undefined || options.clockInitialMs === null
        ? null
        : {
            config: { initialMs: options.clockInitialMs, incrementMs: 0 },
            seats: {
              seat1: { remainingMs: options.clockInitialMs, isRunning: false },
              seat2: { remainingMs: options.clockInitialMs, isRunning: false }
            },
            runningSeats: [],
            updatedAtMs: 0,
            serverNowMs: 0,
            status: "active",
            expiredSeats: []
          },
    boards: [board],
    bot: {
      seat: "seat2",
      kind: "browser-stockfish",
      gameType: "chess",
      difficulty: "normal",
      displayName: "Stockfish Normal"
    }
  };
}

function createConnectFourBotMatch(): MatchView {
  const createBoard = (
    id: "A" | "B",
    seatsToAct: ConnectFourBoardView["seatsToAct"],
    playableColumns: ConnectFourBoardView["playableColumns"]
  ): ConnectFourBoardView => ({
    kind: "connect4",
    id,
    firstSeat: "seat1",
    rows: 6,
    columns: 7,
    cells: Array.from({ length: 42 }, () => null),
    playableColumns,
    seatsToAct,
    outcome: { status: "in_progress" }
  });

  return {
    id: "match-connect4-bot",
    gameType: "connect4",
    gameLabel: "Connect Four",
    seats: ["seat1", "seat2"],
    joinedSeats: 2,
    maxSeats: 2,
    players: {
      seat1: { label: "Player 1", name: "Player 1" },
      seat2: { label: "Player 2", name: "Connect Four Bot" }
    },
    outcome: { status: "in_progress", score: { seat1: 0, seat2: 0 } },
    clock: null,
    boards: [createBoard("A", ["seat1"], [0]), createBoard("B", ["seat2"], [0])],
    automatedSeat: {
      seat: "seat2",
      kind: "random-legal",
      gameType: "connect4",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    }
  };
}
