import type { GomokuBoardView, MovePayload } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseGomokuRandomMove(
  input: BotMoveInput<GomokuBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const cell = chooseRandom(input.board.playableCells, random);
  return cell === null ? null : { cell };
}
