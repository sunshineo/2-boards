import type {
  BoardId,
  BrowserChessBotDifficulty,
  ChessBoardView,
  ChessLegalMove,
  MatchView,
  MovePayload
} from "./types";

export type BrowserChessBotStatus = "idle" | "loading" | "thinking" | "error";

export type BrowserChessBotPreset = {
  readonly skillLevel: number;
  readonly moveTimeMs: number;
};

export const browserChessBotPresets: Readonly<Record<BrowserChessBotDifficulty, BrowserChessBotPreset>> = {
  easy: { skillLevel: 2, moveTimeMs: 1_200 },
  normal: { skillLevel: 7, moveTimeMs: 2_500 },
  hard: { skillLevel: 12, moveTimeMs: 5_000 }
};

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
  if (match.bot?.kind !== "browser-stockfish") return null;

  for (const board of match.boards) {
    if (board.kind !== "chess" || board.outcome.status !== "in_progress") continue;

    if (board.drawOffer && board.drawOffer.offeredBy !== match.bot.seat) {
      return { kind: "control", boardId: board.id, move: { declineDraw: true } };
    }

    if (board.takebackRequest && board.takebackRequest.requestedBy !== match.bot.seat) {
      return { kind: "control", boardId: board.id, move: { declineTakeback: true } };
    }

    if (board.seatsToAct.includes(match.bot.seat)) {
      return { kind: "engine", boardId: board.id, board };
    }
  }

  return null;
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

        const preset = browserChessBotPresets[match.bot?.difficulty ?? "normal"];
        const activeEngine = getEngine();
        options.onStatus?.("thinking");
        activeEngine.post(`setoption name Skill Level value ${preset.skillLevel}`);
        activeEngine.post(`position fen ${action.board.fen}`);
        activeEngine.post(`go movetime ${preset.moveTimeMs}`);
        const bestMove = await activeEngine.nextBestMove();
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
