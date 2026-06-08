import type {
  BoardId,
  BrowserChessBotDifficulty,
  ChessBoardView,
  MatchBoardView,
  ChessLegalMove,
  MatchView,
  MovePayload
} from "./types";
import { getWebGamePlugin } from "./games/registry";

export type BrowserChessBotStatus = "idle" | "loading" | "thinking" | "error";

export type BrowserChessBotPreset = {
  readonly skillLevel: number;
  readonly maximumMoveTimeMs: number;
};

export const browserChessBotPresets: Readonly<Record<BrowserChessBotDifficulty, BrowserChessBotPreset>> = {
  easy: { skillLevel: 2, maximumMoveTimeMs: 2_000 },
  normal: { skillLevel: 7, maximumMoveTimeMs: 3_500 },
  hard: { skillLevel: 12, maximumMoveTimeMs: 5_000 }
};

export type BrowserChessBotTiming = {
  readonly skillLevel: number;
  readonly minimumMoveTimeMs: number;
  readonly maximumMoveTimeMs: number;
};

const browserChessBotMinimumMoveTimeRatio = 0.5;
const defaultBrowserChessClockInitialMs = 300_000;

export type BrowserChessBotAction =
  | { readonly kind: "control"; readonly boardId: BoardId; readonly move: MovePayload }
  | { readonly kind: "engine"; readonly boardId: BoardId; readonly board: ChessBoardView };

export type BrowserChessBotEngine = {
  post(message: string): void;
  nextBestMove(): Promise<string>;
  dispose(): void;
};

export type BrowserChessBotController = {
  runForMatch(match: MatchView): Promise<void>;
  dispose(): void;
};

export type BrowserGameBotStatus = BrowserChessBotStatus;

export type BrowserGameBotController = {
  runForMatch(match: MatchView): Promise<void>;
  dispose(): void;
};

type BrowserChessBotControllerOptions = {
  readonly createEngine?: () => BrowserChessBotEngine;
  readonly submitMove: (input: { readonly boardId: BoardId; readonly move: MovePayload }) => Promise<void>;
  readonly onStatus?: (status: BrowserChessBotStatus) => void;
};

export function toChessMovePayloadFromUci(
  uciMove: string,
  legalMoves: readonly ChessLegalMove[]
): MovePayload | null {
  const normalized = uciMove.trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) return null;

  const from = normalized.slice(0, 2);
  const to = normalized.slice(2, 4);
  const promotion = normalized[4] as ChessLegalMove["promotion"] | undefined;
  const legalMove = legalMoves.find((move) => {
    if (move.from !== from || move.to !== to) return false;
    return (move.promotion ?? undefined) === promotion;
  });
  if (!legalMove) return null;

  return legalMove.promotion
    ? { from: legalMove.from, to: legalMove.to, promotion: legalMove.promotion }
    : { from: legalMove.from, to: legalMove.to };
}

export function selectBrowserChessBotAction(match: MatchView): BrowserChessBotAction | null {
  if (match.gameType !== "chess" || match.outcome.status !== "in_progress") return null;
  const automatedSeat = match.automatedSeat ?? match.bot ?? null;
  if (automatedSeat?.kind !== "browser-stockfish") return null;

  for (const board of match.boards) {
    if (board.kind !== "chess" || board.outcome.status !== "in_progress") continue;

    if (board.drawOffer && board.drawOffer.offeredBy !== automatedSeat.seat) {
      return { kind: "control", boardId: board.id, move: { declineDraw: true } };
    }

    if (board.takebackRequest && board.takebackRequest.requestedBy !== automatedSeat.seat) {
      return { kind: "control", boardId: board.id, move: { declineTakeback: true } };
    }

    if (board.seatsToAct.includes(automatedSeat.seat)) {
      return { kind: "engine", boardId: board.id, board };
    }
  }

  return null;
}

export function getBrowserChessBotTiming(match: MatchView): BrowserChessBotTiming {
  const automatedSeat = match.automatedSeat ?? match.bot ?? null;
  const preset = browserChessBotPresets[automatedSeat?.difficulty ?? "normal"];
  const clockScale = getBrowserChessBotClockScale(match.clock?.config.initialMs ?? defaultBrowserChessClockInitialMs);
  const maximumMoveTimeMs = Math.round(preset.maximumMoveTimeMs * clockScale);

  return {
    skillLevel: preset.skillLevel,
    minimumMoveTimeMs: Math.round(maximumMoveTimeMs * browserChessBotMinimumMoveTimeRatio),
    maximumMoveTimeMs
  };
}

export function createBrowserChessBotController(
  options: BrowserChessBotControllerOptions
): BrowserChessBotController {
  let engine: BrowserChessBotEngine | null = null;
  let isRunning = false;
  let isDisposed = false;

  function getEngine() {
    if (!engine) {
      options.onStatus?.("loading");
      engine = (options.createEngine ?? createStockfishEngine)();
      engine.post("uci");
      engine.post("ucinewgame");
    }
    return engine;
  }

  return {
    async runForMatch(match) {
      if (isDisposed || isRunning) return;

      const action = selectBrowserChessBotAction(match);
      if (!action) {
        options.onStatus?.("idle");
        return;
      }

      isRunning = true;
      try {
        if (action.kind === "control") {
          await options.submitMove({ boardId: action.boardId, move: action.move });
          options.onStatus?.("idle");
          return;
        }

        const timing = getBrowserChessBotTiming(match);
        const activeEngine = getEngine();
        options.onStatus?.("thinking");
        activeEngine.post(`setoption name Skill Level value ${timing.skillLevel}`);
        activeEngine.post(`position fen ${action.board.fen}`);
        activeEngine.post(`go movetime ${timing.maximumMoveTimeMs}`);
        const searchStartedAtMs = Date.now();
        const bestMove = await activeEngine.nextBestMove();
        const remainingMinimumDelayMs = timing.minimumMoveTimeMs - (Date.now() - searchStartedAtMs);
        if (remainingMinimumDelayMs > 0) {
          await waitForBotMoveTime(remainingMinimumDelayMs);
        }
        const move = toChessMovePayloadFromUci(bestMove, action.board.legalMoves);
        if (!move) {
          options.onStatus?.("error");
          return;
        }

        await options.submitMove({ boardId: action.boardId, move });
        options.onStatus?.("idle");
      } catch {
        options.onStatus?.("error");
      } finally {
        isRunning = false;
      }
    },

    dispose() {
      isDisposed = true;
      engine?.dispose();
      engine = null;
      options.onStatus?.("idle");
    }
  };
}

export function createBrowserGameBotController(
  options: BrowserChessBotControllerOptions
): BrowserGameBotController {
  const chessController = createBrowserChessBotController(options);
  let isRunning = false;
  let isDisposed = false;

  return {
    async runForMatch(match) {
      if (isDisposed || isRunning) return;

      const automatedSeat = match.automatedSeat ?? match.bot ?? null;
      if (!automatedSeat || match.outcome.status !== "in_progress") {
        options.onStatus?.("idle");
        return;
      }

      if (automatedSeat.kind === "browser-stockfish") {
        isRunning = true;
        try {
          await chessController.runForMatch(match);
        } finally {
          isRunning = false;
        }
        return;
      }

      isRunning = true;
      try {
        const plugin = getWebGamePlugin(match.gameType);
        const bot = plugin?.bot;
        if (bot?.kind !== "random-legal") {
          options.onStatus?.("idle");
          return;
        }

        const board = selectRandomLegalBotBoard(match, automatedSeat.seat);
        if (!board) {
          options.onStatus?.("idle");
          return;
        }

        options.onStatus?.("thinking");
        await waitForBotMoveTime(250);
        const move = await bot.chooseMove({ board, seat: automatedSeat.seat });
        if (move) {
          await options.submitMove({ boardId: board.id, move });
        }
        options.onStatus?.("idle");
      } catch {
        options.onStatus?.("error");
      } finally {
        isRunning = false;
      }
    },

    dispose() {
      isDisposed = true;
      chessController.dispose();
      options.onStatus?.("idle");
    }
  };
}

function selectRandomLegalBotBoard(match: MatchView, seat: MatchView["seats"][number]): MatchBoardView | null {
  for (const board of match.boards) {
    if (board.kind !== match.gameType) continue;
    if (board.outcome.status !== "in_progress") continue;
    if (!board.seatsToAct.includes(seat)) continue;
    return board;
  }

  return null;
}

function getBrowserChessBotClockScale(clockInitialMs: number) {
  const threeMinutesMs = 180_000;
  const fiveMinutesMs = 300_000;
  const tenMinutesMs = 600_000;

  if (clockInitialMs <= threeMinutesMs) return 0.6;
  if (clockInitialMs <= fiveMinutesMs) {
    return 0.6 + ((clockInitialMs - threeMinutesMs) / (fiveMinutesMs - threeMinutesMs)) * 0.2;
  }
  if (clockInitialMs >= tenMinutesMs) return 1;
  return 0.8 + ((clockInitialMs - fiveMinutesMs) / (tenMinutesMs - fiveMinutesMs)) * 0.2;
}

function waitForBotMoveTime(moveTimeMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, moveTimeMs);
  });
}

export function createStockfishEngine(): BrowserChessBotEngine {
  const worker = new Worker("/vendor/stockfish/stockfish-18-lite-single.js");
  const bestMoveResolvers: ((move: string) => void)[] = [];

  worker.onmessage = (event: MessageEvent<string>) => {
    const message = String(event.data);
    if (!message.startsWith("bestmove ")) return;

    const move = message.split(/\s+/)[1] ?? "";
    const resolve = bestMoveResolvers.shift();
    resolve?.(move);
  };

  return {
    post(message) {
      worker.postMessage(message);
    },

    nextBestMove() {
      return new Promise<string>((resolve) => {
        bestMoveResolvers.push(resolve);
      });
    },

    dispose() {
      bestMoveResolvers.splice(0);
      worker.terminate();
    }
  };
}
