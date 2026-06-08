import type { ConnectFourBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseConnectFourRandomMove(
  input: BotMoveInput<ConnectFourBoardView>,
  random?: RandomSource
): MovePayload | null {
  const column = chooseRandom(input.board.playableColumns, random);
  return column === null ? null : { column };
}
