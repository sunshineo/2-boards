import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { GameRules, SeatPair, ValidationResult } from "../types.js";

export type ChessColor = "w" | "b";
export type ChessPieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type ChessPromotion = "q" | "r" | "b" | "n";

export type ChessPiece = {
  readonly color: ChessColor;
  readonly type: ChessPieceType;
};

export type ChessMove = {
  readonly from: string;
  readonly to: string;
  readonly promotion?: ChessPromotion;
};

export type ChessMoveRecord = {
  readonly seat: SeatId;
  readonly color: ChessColor;
  readonly piece: ChessPieceType;
  readonly from: string;
  readonly to: string;
  readonly san: string;
  readonly lan: string;
  readonly captured?: ChessPieceType;
  readonly promotion?: ChessPromotion;
};

export type ChessState = {
  readonly fen: string;
  readonly seats: SeatPair;
  readonly whiteSeat: SeatId;
  readonly blackSeat: SeatId;
  readonly moveHistory: readonly ChessMoveRecord[];
  readonly outcome: BoardOutcome;
};

export type ChessSquareView = {
  readonly square: string;
  readonly piece: ChessPiece | null;
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

export const chessRules: GameRules<ChessState, ChessMove> = {
  gameType: "chess",

  createInitialState({ firstSeat, seats }) {
    return createChessStateFromFen(new Chess().fen(), seats, firstSeat);
  },

  getSeatsToAct(state) {
    return state.outcome.status === "in_progress" ? [getSeatForTurn(state)] : [];
  },

  validateMove({ state, move, seat }) {
    if (state.outcome.status !== "in_progress") {
      return { ok: false, reason: "board-not-active" };
    }

    if (getSeatForTurn(state) !== seat) {
      return { ok: false, reason: "seat-not-to-act" };
    }

    if (!isMoveShape(move)) {
      return { ok: false, reason: "invalid-move" };
    }

    const chess = new Chess(state.fen);
    try {
      chess.move(toChessJsMove(move));
      return { ok: true };
    } catch {
      return { ok: false, reason: "illegal-move" };
    }
  },

  applyMove({ state, move, seat }) {
    assertValidMove(this.validateMove({ state, move, seat }));

    const chess = new Chess(state.fen);
    const appliedMove = chess.move(toChessJsMove(move));
    const nextFen = chess.fen();

    return {
      ...state,
      fen: nextFen,
      moveHistory: [
        ...state.moveHistory,
        {
          seat,
          color: appliedMove.color as ChessColor,
          piece: appliedMove.piece as ChessPieceType,
          from: appliedMove.from,
          to: appliedMove.to,
          san: appliedMove.san,
          lan: appliedMove.lan,
          ...(appliedMove.captured ? { captured: appliedMove.captured as ChessPieceType } : {}),
          ...(appliedMove.promotion ? { promotion: appliedMove.promotion as ChessPromotion } : {})
        }
      ],
      outcome: getChessOutcome(nextFen, state)
    };
  },

  getOutcome(state) {
    return state.outcome;
  }
};

export function createChessStateFromFen(fen: string, seats: SeatPair, whiteSeat: SeatId): ChessState {
  const stateWithoutOutcome = {
    fen,
    seats,
    whiteSeat,
    blackSeat: getOtherSeat(seats, whiteSeat),
    moveHistory: []
  };

  return {
    ...stateWithoutOutcome,
    outcome: getChessOutcome(fen, stateWithoutOutcome)
  };
}

export function getChessPieceAt(state: Pick<ChessState, "fen">, square: string): ChessPiece | null {
  const piece = new Chess(state.fen).get(square as Square);
  return piece ? { color: piece.color as ChessColor, type: piece.type as ChessPieceType } : null;
}

export function getChessSquares(state: ChessState): ChessSquareView[] {
  return ranks.flatMap((rank) =>
    files.map((file) => {
      const square = `${file}${rank}`;
      return {
        square,
        piece: getChessPieceAt(state, square)
      };
    })
  );
}

function getChessOutcome(
  fen: string,
  state: Pick<ChessState, "seats" | "whiteSeat" | "blackSeat">
): BoardOutcome {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    const loser = getSeatForColor(state, chess.turn() as ChessColor);
    return {
      status: "win",
      winner: getOtherSeat(state.seats, loser),
      loser,
      reason: "checkmate"
    };
  }

  if (chess.isStalemate()) return { status: "draw", reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { status: "draw", reason: "insufficient-material" };
  if (chess.isThreefoldRepetition()) return { status: "draw", reason: "threefold-repetition" };
  if (chess.isDrawByFiftyMoves()) return { status: "draw", reason: "fifty-move-rule" };
  if (chess.isDraw()) return { status: "draw", reason: "draw" };

  return { status: "in_progress" };
}

function toChessJsMove(move: ChessMove) {
  return move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to };
}

function isMoveShape(move: ChessMove): boolean {
  return typeof move.from === "string" && typeof move.to === "string";
}

function getSeatForTurn(state: ChessState): SeatId {
  return getSeatForColor(state, new Chess(state.fen).turn() as ChessColor);
}

function getSeatForColor(state: Pick<ChessState, "whiteSeat" | "blackSeat">, color: ChessColor): SeatId {
  return color === "w" ? state.whiteSeat : state.blackSeat;
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
