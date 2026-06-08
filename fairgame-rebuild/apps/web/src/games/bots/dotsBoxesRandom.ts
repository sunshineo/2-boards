import type { DotsBoxesBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseDotsBoxesRandomMove(
  input: BotMoveInput<DotsBoxesBoardView>,
  random?: RandomSource
): MovePayload | null {
  const edge = chooseRandom(input.board.playableEdges, random);
  return edge === null ? null : { edge };
}
