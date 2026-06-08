import type { MatchBoardView, SeatId } from "../../types";

export type RandomSource = () => number;

export function chooseRandom<T>(items: readonly T[], random: RandomSource = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? null;
}

export function canRandomBotAct(board: MatchBoardView, seat: SeatId) {
  return board.outcome.status === "in_progress" && board.seatsToAct.includes(seat);
}
