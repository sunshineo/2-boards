import type { ChessLegalMove, ChessMove } from "@fairgame/domain";
import type { BoardId, SeatId } from "@fairgame/shared";

import type { ChessBoardView } from "./gameRegistry.js";
import type { MatchView } from "./matchView.js";

export type DebugChessBotConfig = {
  readonly enabled: boolean;
  readonly name: string;
  readonly seat: "seat2";
};

export type DebugChessBotCommand = {
  readonly boardId: BoardId;
  readonly move: ChessMove;
};

const centerTargetScore: Readonly<Record<string, number>> = {
  e4: 50,
  e5: 50,
  d4: 45,
  d5: 45,
  c4: 15,
  c5: 15,
  f4: 15,
  f5: 15,
  e3: 8,
  e6: 8,
  d3: 6,
  d6: 6
};

const pieceValues: Readonly<Record<string, number>> = {
  p: 100,
  n: 300,
  b: 320,
  r: 500,
  q: 900,
  k: 0
};

export function selectDebugChessBotCommand(match: MatchView, seat: SeatId): DebugChessBotCommand | null {
  if (match.gameType !== "chess" || match.outcome.status !== "in_progress") return null;

  for (const board of match.boards) {
    if (board.kind !== "chess" || board.outcome.status !== "in_progress") continue;

    const responseMove = getPendingResponseMove(board, seat);
    if (responseMove) {
      return { boardId: board.id, move: responseMove };
    }

    if (!board.seatsToAct.includes(seat)) continue;

    const selectedMove = selectCoordinateMove(board.legalMoves);
    if (!selectedMove) continue;

    return {
      boardId: board.id,
      move: selectedMove.promotion
        ? { from: selectedMove.from, to: selectedMove.to, promotion: selectedMove.promotion }
        : { from: selectedMove.from, to: selectedMove.to }
    };
  }

  return null;
}

function getPendingResponseMove(board: ChessBoardView, seat: SeatId): ChessMove | null {
  if (board.takebackRequest && board.takebackRequest.requestedBy !== seat) {
    return { declineTakeback: true };
  }

  if (board.drawOffer && board.drawOffer.offeredBy !== seat) {
    return { declineDraw: true };
  }

  return null;
}

function selectCoordinateMove(legalMoves: readonly ChessLegalMove[]): ChessLegalMove | null {
  return [...legalMoves].sort(compareMoves)[0] ?? null;
}

function compareMoves(left: ChessLegalMove, right: ChessLegalMove): number {
  const scoreDelta = scoreMove(right) - scoreMove(left);
  if (scoreDelta !== 0) return scoreDelta;
  return getMoveKey(left).localeCompare(getMoveKey(right));
}

function scoreMove(move: ChessLegalMove): number {
  let score = centerTargetScore[move.to] ?? 0;

  if (move.san.includes("#")) score += 100_000;
  if (move.san.includes("+")) score += 2_000;
  if (move.captured) score += 1_000 + (pieceValues[move.captured] ?? 0);
  if (move.promotion) score += pieceValues[move.promotion] ?? 0;
  if (move.san === "O-O" || move.san === "O-O-O") score += 30;
  if (move.piece === "n" || move.piece === "b") score += 10;

  return score;
}

function getMoveKey(move: ChessLegalMove): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}
