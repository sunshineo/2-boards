import type { MovePayload, OrderChaosBoardView } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseOrderChaosRandomMove(
  input: BotMoveInput<OrderChaosBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  if (cell === null) return null;
  const mark = chooseRandom(["X", "O"] as const, random) ?? "X";
  return { cell, mark };
}
