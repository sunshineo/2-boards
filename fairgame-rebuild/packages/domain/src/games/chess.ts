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

export type ChessCoordinateMove = {
  readonly from: string;
  readonly to: string;
  readonly promotion?: ChessPromotion;
};

export type ChessResignMove = {
  readonly resign: true;
};

export type ChessDrawOfferMove = {
  readonly drawOffer: true;
};

export type ChessAcceptDrawMove = {
  readonly acceptDraw: true;
};

export type ChessDeclineDrawMove = {
  readonly declineDraw: true;
};

export type ChessRequestTakebackMove = {
  readonly requestTakeback: true;
};

export type ChessAcceptTakebackMove = {
  readonly acceptTakeback: true;
};

export type ChessDeclineTakebackMove = {
  readonly declineTakeback: true;
};

export type ChessMove =
  | ChessCoordinateMove
  | ChessResignMove
  | ChessDrawOfferMove
  | ChessAcceptDrawMove
  | ChessDeclineDrawMove
  | ChessRequestTakebackMove
  | ChessAcceptTakebackMove
  | ChessDeclineTakebackMove;

export type ChessDrawOffer = {
  readonly offeredBy: SeatId;
};

export type ChessTakebackRequest = {
  readonly requestedBy: SeatId;
};

export type ChessMoveRecord = {
  readonly seat: SeatId;
  readonly color: ChessColor;
  readonly piece?: ChessPieceType;
  readonly from?: string;
  readonly to?: string;
  readonly san: string;
  readonly lan: string;
  readonly fenAfter?: string;
  readonly resignation?: true;
  readonly drawOffer?: true;
  readonly drawAccepted?: true;
  readonly drawDeclined?: true;
  readonly takebackRequest?: true;
  readonly takebackAccepted?: true;
  readonly takebackDeclined?: true;
  readonly captured?: ChessPieceType;
  readonly promotion?: ChessPromotion;
};

export type ChessLegalMove = {
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
  readonly initialFen: string;
  readonly fen: string;
  readonly seats: SeatPair;
  readonly whiteSeat: SeatId;
  readonly blackSeat: SeatId;
  readonly drawOffer: ChessDrawOffer | null;
  readonly takebackRequest: ChessTakebackRequest | null;
  readonly moveHistory: readonly ChessMoveRecord[];
  readonly outcome: BoardOutcome;
};

export type ChessSquareView = {
  readonly square: string;
  readonly piece: ChessPiece | null;
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const promotionPieces = ["q", "r", "b", "n"] as const;

export const chessRules: GameRules<ChessState, ChessMove> = {
  gameType: "chess",

  createInitialState({ firstSeat, seats }) {
    return createChessStateFromFen(new Chess().fen(), seats, firstSeat);
  },

  getSeatsToAct(state) {
    return state.outcome.status === "in_progress" ? [getSeatForTurn(state)] : [];
  },

  canSubmitMove({ state, move, seat }) {
    if (isBoardControlMove(move)) {
      return chessRules.validateMove({ state, move, seat });
    }

    return chessRules.getSeatsToAct(state).includes(seat)
      ? { ok: true }
      : { ok: false, reason: "seat-not-to-act" };
  },

  validateMove({ state, move, seat }) {
    if (state.outcome.status !== "in_progress") {
      return { ok: false, reason: "board-not-active" };
    }

    if (isResignMove(move)) {
      return { ok: true };
    }

    if (isDrawOfferMove(move)) {
      return state.drawOffer ? { ok: false, reason: "draw-offer-active" } : { ok: true };
    }

    if (isAcceptDrawMove(move) || isDeclineDrawMove(move)) {
      if (!state.drawOffer) return { ok: false, reason: "draw-offer-not-found" };
      if (state.drawOffer.offeredBy === seat) return { ok: false, reason: "draw-offer-own" };
      return { ok: true };
    }

    if (isRequestTakebackMove(move)) {
      if (state.takebackRequest) return { ok: false, reason: "takeback-request-active" };
      return getLatestCoordinateMoveIndex(state.moveHistory) === -1
        ? { ok: false, reason: "takeback-target-not-found" }
        : { ok: true };
    }

    if (isAcceptTakebackMove(move) || isDeclineTakebackMove(move)) {
      if (!state.takebackRequest) return { ok: false, reason: "takeback-request-not-found" };
      if (state.takebackRequest.requestedBy === seat) return { ok: false, reason: "takeback-request-own" };
      return { ok: true };
    }

    if (getSeatForTurn(state) !== seat) {
      return { ok: false, reason: "seat-not-to-act" };
    }

    if (state.takebackRequest) {
      return { ok: false, reason: "takeback-request-active" };
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

    if (isResignMove(move)) {
      return {
        ...state,
        drawOffer: null,
        takebackRequest: null,
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "resigns",
            lan: "resign",
            fenAfter: state.fen,
            resignation: true
          }
        ],
        outcome: {
          status: "win",
          winner: getOtherSeat(state.seats, seat),
          loser: seat,
          reason: "resignation"
        }
      };
    }

    if (isDrawOfferMove(move)) {
      return {
        ...state,
        takebackRequest: null,
        drawOffer: { offeredBy: seat },
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "offers draw",
            lan: "draw-offer",
            fenAfter: state.fen,
            drawOffer: true
          }
        ]
      };
    }

    if (isAcceptDrawMove(move)) {
      return {
        ...state,
        drawOffer: null,
        takebackRequest: null,
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "draw agreed",
            lan: "draw-accepted",
            fenAfter: state.fen,
            drawAccepted: true
          }
        ],
        outcome: {
          status: "draw",
          reason: "agreement"
        }
      };
    }

    if (isDeclineDrawMove(move)) {
      return {
        ...state,
        drawOffer: null,
        takebackRequest: null,
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "declines draw",
            lan: "draw-declined",
            fenAfter: state.fen,
            drawDeclined: true
          }
        ]
      };
    }

    if (isRequestTakebackMove(move)) {
      return {
        ...state,
        drawOffer: null,
        takebackRequest: { requestedBy: seat },
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "requests takeback",
            lan: "takeback-request",
            fenAfter: state.fen,
            takebackRequest: true
          }
        ]
      };
    }

    if (isAcceptTakebackMove(move)) {
      const moveIndex = getLatestCoordinateMoveIndex(state.moveHistory);
      const previousFen = getFenBeforeMove(state, moveIndex);
      return {
        ...state,
        fen: previousFen,
        drawOffer: null,
        takebackRequest: null,
        moveHistory: [
          ...state.moveHistory.slice(0, moveIndex),
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "takeback accepted",
            lan: "takeback-accepted",
            fenAfter: previousFen,
            takebackAccepted: true
          }
        ],
        outcome: getChessOutcome(previousFen, state)
      };
    }

    if (isDeclineTakebackMove(move)) {
      return {
        ...state,
        takebackRequest: null,
        moveHistory: [
          ...state.moveHistory,
          {
            seat,
            color: getColorForSeat(state, seat),
            san: "declines takeback",
            lan: "takeback-declined",
            fenAfter: state.fen,
            takebackDeclined: true
          }
        ]
      };
    }

    const chess = new Chess(state.fen);
    const appliedMove = chess.move(toChessJsMove(move));
    const nextFen = chess.fen();

    return {
      ...state,
      fen: nextFen,
      drawOffer: null,
      takebackRequest: null,
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
          fenAfter: nextFen,
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
    initialFen: fen,
    fen,
    seats,
    whiteSeat,
    blackSeat: getOtherSeat(seats, whiteSeat),
    drawOffer: null,
    takebackRequest: null,
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

export function getChessLegalMoves(state: ChessState): ChessLegalMove[] {
  if (state.outcome.status !== "in_progress") return [];

  return new Chess(state.fen).moves({ verbose: true }).map((move) => ({
    color: move.color as ChessColor,
    piece: move.piece as ChessPieceType,
    from: move.from,
    to: move.to,
    san: move.san,
    lan: move.lan,
    ...(move.captured ? { captured: move.captured as ChessPieceType } : {}),
    ...(move.promotion ? { promotion: move.promotion as ChessPromotion } : {})
  }));
}

export function getChessPremoveMoves(state: Pick<ChessState, "fen" | "outcome">, square: string): ChessLegalMove[] {
  if (state.outcome.status !== "in_progress" || !isChessSquare(square)) return [];

  const from = square;
  const chess = new Chess(state.fen);
  const piece = chess.get(from);
  if (!piece) return [];

  chess.setTurn(piece.color);
  const movesByCoordinate = new Map<string, ChessLegalMove>();
  const addMove = (move: ChessLegalMove) => {
    const key = `${move.from}:${move.to}:${move.promotion ?? ""}`;
    if (!movesByCoordinate.has(key)) {
      movesByCoordinate.set(key, move);
    }
  };

  for (const move of chess.moves({ verbose: true, square: from })) {
    addMove({
      color: move.color as ChessColor,
      piece: move.piece as ChessPieceType,
      from: move.from,
      to: move.to,
      san: move.san,
      lan: move.lan,
      ...(move.captured ? { captured: move.captured as ChessPieceType } : {}),
      ...(move.promotion ? { promotion: move.promotion as ChessPromotion } : {})
    });
  }

  for (const to of getChessSquareNames()) {
    if (to === from || !chess.attackers(to, piece.color).includes(from)) continue;

    for (const move of createChessPremoveAttackMoves({ color: piece.color, type: piece.type }, from, to)) {
      addMove(move);
    }
  }

  return [...movesByCoordinate.values()];
}

export function getChessTurnColor(state: Pick<ChessState, "fen">): ChessColor {
  return new Chess(state.fen).turn() as ChessColor;
}

export function isChessInCheck(state: Pick<ChessState, "fen">): boolean {
  return new Chess(state.fen).inCheck();
}

export function getChessCheckSquare(state: Pick<ChessState, "fen">): string | null {
  const chess = new Chess(state.fen);
  if (!chess.inCheck()) return null;

  const turnColor = chess.turn() as ChessColor;
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}`;
      const piece = getChessPieceAt(state, square);
      if (piece?.color === turnColor && piece.type === "k") return square;
    }
  }
  return null;
}

export function getChessMoveNumber(state: Pick<ChessState, "fen">): number {
  const moveNumber = Number.parseInt(state.fen.split(" ")[5] ?? "1", 10);
  return Number.isNaN(moveNumber) ? 1 : moveNumber;
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

function toChessJsMove(move: ChessCoordinateMove) {
  return move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to };
}

function isMoveShape(move: ChessMove): boolean {
  return (
    isResignMove(move) ||
    isDrawOfferMove(move) ||
    isAcceptDrawMove(move) ||
    isDeclineDrawMove(move) ||
    isRequestTakebackMove(move) ||
    isAcceptTakebackMove(move) ||
    isDeclineTakebackMove(move) ||
    (typeof move.from === "string" && typeof move.to === "string")
  );
}

function isBoardControlMove(
  move: ChessMove
): move is
  | ChessResignMove
  | ChessDrawOfferMove
  | ChessAcceptDrawMove
  | ChessDeclineDrawMove
  | ChessRequestTakebackMove
  | ChessAcceptTakebackMove
  | ChessDeclineTakebackMove {
  return (
    isResignMove(move) ||
    isDrawOfferMove(move) ||
    isAcceptDrawMove(move) ||
    isDeclineDrawMove(move) ||
    isRequestTakebackMove(move) ||
    isAcceptTakebackMove(move) ||
    isDeclineTakebackMove(move)
  );
}

function isResignMove(move: ChessMove): move is ChessResignMove {
  return "resign" in move && move.resign === true;
}

function isDrawOfferMove(move: ChessMove): move is ChessDrawOfferMove {
  return "drawOffer" in move && move.drawOffer === true;
}

function isAcceptDrawMove(move: ChessMove): move is ChessAcceptDrawMove {
  return "acceptDraw" in move && move.acceptDraw === true;
}

function isDeclineDrawMove(move: ChessMove): move is ChessDeclineDrawMove {
  return "declineDraw" in move && move.declineDraw === true;
}

function isRequestTakebackMove(move: ChessMove): move is ChessRequestTakebackMove {
  return "requestTakeback" in move && move.requestTakeback === true;
}

function isAcceptTakebackMove(move: ChessMove): move is ChessAcceptTakebackMove {
  return "acceptTakeback" in move && move.acceptTakeback === true;
}

function isDeclineTakebackMove(move: ChessMove): move is ChessDeclineTakebackMove {
  return "declineTakeback" in move && move.declineTakeback === true;
}

function getLatestCoordinateMoveIndex(moveHistory: readonly ChessMoveRecord[]) {
  for (let index = moveHistory.length - 1; index >= 0; index -= 1) {
    const move = moveHistory[index];
    if (move?.from && move.to && move.fenAfter) return index;
  }
  return -1;
}

function getFenBeforeMove(state: ChessState, moveIndex: number) {
  for (let index = moveIndex - 1; index >= 0; index -= 1) {
    const move = state.moveHistory[index];
    if (move?.from && move.to && move.fenAfter) return move.fenAfter;
  }
  return state.initialFen;
}

function getSeatForTurn(state: ChessState): SeatId {
  return getSeatForColor(state, new Chess(state.fen).turn() as ChessColor);
}

function getSeatForColor(state: Pick<ChessState, "whiteSeat" | "blackSeat">, color: ChessColor): SeatId {
  return color === "w" ? state.whiteSeat : state.blackSeat;
}

function getColorForSeat(state: Pick<ChessState, "whiteSeat" | "blackSeat">, seat: SeatId): ChessColor {
  return state.whiteSeat === seat ? "w" : "b";
}

function getOtherSeat(seats: SeatPair, seat: SeatId): SeatId {
  return seat === seats[0] ? seats[1] : seats[0];
}

function getChessSquareNames(): Square[] {
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}` as Square));
}

function isChessSquare(square: string): square is Square {
  return /^[a-h][1-8]$/.test(square);
}

function createChessPremoveAttackMoves(piece: ChessPiece, from: Square, to: Square): ChessLegalMove[] {
  const isPromotion = piece.type === "p" && (to.endsWith("8") || to.endsWith("1"));
  if (!isPromotion) {
    return [
      {
        color: piece.color,
        piece: piece.type,
        from,
        to,
        san: `${from}${to}`,
        lan: `${from}${to}`
      }
    ];
  }

  return promotionPieces.map((promotion) => ({
    color: piece.color,
    piece: piece.type,
    from,
    to,
    san: `${from}${to}${promotion}`,
    lan: `${from}${to}${promotion}`,
    promotion
  }));
}

function assertValidMove(result: ValidationResult): asserts result is { readonly ok: true } {
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
