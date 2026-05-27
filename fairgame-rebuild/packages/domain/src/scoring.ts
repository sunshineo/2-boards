import type { BoardOutcome, SeatId } from "@fairgame/shared";

import type { FairMatch, MatchOutcome, MatchScore } from "./types";

const emptyScore: MatchScore = Object.freeze({
  seat1: 0,
  seat2: 0
});

export function createEmptyScore(): MatchScore {
  return { ...emptyScore };
}

export function scoreBoardOutcome(outcome: BoardOutcome): MatchScore {
  if (outcome.status === "win") {
    return {
      seat1: outcome.winner === "seat1" ? 1 : 0,
      seat2: outcome.winner === "seat2" ? 1 : 0
    };
  }

  if (outcome.status === "draw") {
    return {
      seat1: 0.5,
      seat2: 0.5
    };
  }

  return createEmptyScore();
}

export function addScores(left: MatchScore, right: MatchScore): MatchScore {
  return {
    seat1: left.seat1 + right.seat1,
    seat2: left.seat2 + right.seat2
  };
}

export function getMatchOutcome<TState>(match: FairMatch<TState>): MatchOutcome {
  const canceledBoard = match.boards.find((board) => board.outcome.status === "canceled");
  if (canceledBoard?.outcome.status === "canceled") {
    return {
      status: "canceled",
      reason: canceledBoard.outcome.reason
    };
  }

  const score = match.boards.reduce(
    (currentScore, board) => addScores(currentScore, scoreBoardOutcome(board.outcome)),
    createEmptyScore()
  );

  const hasUnfinishedBoard = match.boards.some((board) => board.outcome.status === "in_progress");
  if (hasUnfinishedBoard) {
    return {
      status: "in_progress",
      score
    };
  }

  return {
    status: "completed",
    score,
    winner: getScoreWinner(score)
  };
}

function getScoreWinner(score: MatchScore): SeatId | null {
  if (score.seat1 > score.seat2) return "seat1";
  if (score.seat2 > score.seat1) return "seat2";
  return null;
}
