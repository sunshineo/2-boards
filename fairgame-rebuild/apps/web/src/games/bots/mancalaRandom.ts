import type { MancalaBoardView, MovePayload } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseMancalaRandomMove(
  input: BotMoveInput<MancalaBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const pit = chooseRandom(input.board.playablePits, random);
  return pit === null ? null : { pit };
}
