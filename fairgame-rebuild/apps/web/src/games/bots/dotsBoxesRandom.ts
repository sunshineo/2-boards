import type { DotsBoxesBoardView, MovePayload } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseDotsBoxesRandomMove(
  input: BotMoveInput<DotsBoxesBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const edge = chooseRandom(input.board.playableEdges, random);
  return edge === null ? null : { edge };
}
