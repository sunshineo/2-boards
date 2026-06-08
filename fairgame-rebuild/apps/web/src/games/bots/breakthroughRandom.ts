import type { BreakthroughBoardView, MovePayload } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseBreakthroughRandomMove(
  input: BotMoveInput<BreakthroughBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const move = chooseRandom(input.board.playableMoves, random);
  return move === null ? null : { from: move.from, to: move.to };
}
