import type { MovePayload, ReversiBoardView } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseReversiRandomMove(
  input: BotMoveInput<ReversiBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  return cell === null ? null : { cell };
}
