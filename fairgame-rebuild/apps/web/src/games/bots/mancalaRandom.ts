import type { MancalaBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseMancalaRandomMove(
  input: BotMoveInput<MancalaBoardView>,
  random?: RandomSource
): MovePayload | null {
  const pit = chooseRandom(input.board.playablePits, random);
  return pit === null ? null : { pit };
}
