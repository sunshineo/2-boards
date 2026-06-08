import type { MovePayload, OrderChaosBoardView } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseOrderChaosRandomMove(
  input: BotMoveInput<OrderChaosBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const cell = chooseRandom(input.board.playableCells, random);
  if (cell === null) return null;
  const mark = chooseRandom(["X", "O"] as const, random) ?? "X";
  return { cell, mark };
}
