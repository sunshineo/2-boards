import type { GomokuBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseGomokuRandomMove(
  input: BotMoveInput<GomokuBoardView>,
  random?: RandomSource
): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  return cell === null ? null : { cell };
}
